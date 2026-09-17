/**
 * M2 转换层：引用式锚定检索 + 区间分段渲染。
 * findQuote / segmentRanges / flattenBlock / segmentParagraph 为纯函数（vitest 覆盖）；
 * rehypeNoteSegment 为 rehype 接线（Astro markdown.rehypePlugins 消费，strict 默认开）。
 *
 * 核心模型：段落规范化文本被标注边界切分成首尾相接的基本段（cells）——
 * 每个字符恰好属于一个基本段，因此不存在「间隙」光标问题；
 * 标注基本段以 span[data-notes] 包裹，未标注基本段原样输出，相邻同注段在根层合并。
 */

/**
 * 引用串在文本中的全部匹配区间 [start, end)（多匹配 = 引用歧义，交由调用方裁决）。
 */
export function findQuote(text, quote) {
  if (!quote) return [];
  const out = [];
  let i = text.indexOf(quote);
  while (i !== -1) {
    out.push([i, i + quote.length]);
    i = text.indexOf(quote, i + 1);
  }
  return out;
}

/**
 * 区间 → 基本段：所有标注区间在边界点切分，首尾相接平铺 [0, length)，
 * 每段挂覆盖它的 note id 列表（排序输出，与收集顺序无关）。
 * 这是表达部分重叠的唯一正解（HTML 是树，嵌套 span 是假解法）。
 */
export function segmentRanges(length, ranges) {
  const bounds = new Set([0, length]);
  for (const r of ranges) {
    bounds.add(r.start);
    bounds.add(r.end);
  }
  const bs = [...bounds].sort((a, b) => a - b);
  const segs = [];
  for (let i = 0; i < bs.length - 1; i++) {
    const start = bs[i];
    const end = bs[i + 1];
    const notes = [
      ...new Set(ranges.filter((r) => r.start <= start && end <= r.end).map((r) => r.id)),
    ].sort();
    segs.push({ start, end, notes });
  }
  return segs;
}

/**
 * 段落 → 规范化文本（空白折叠为单空格、去尾随）+ 每字符到 {node, local} 的映射。
 * 引用串与检索都在规范化空间进行，天然免疫换行/缩进差异。
 */
export function flattenBlock(p) {
  let text = '';
  const map = [];
  const walk = (n) => {
    if (n.type === 'text') {
      for (let i = 0; i < n.value.length; i++) {
        const ch = n.value[i];
        if (/\s/.test(ch)) {
          if (text.length > 0 && text[text.length - 1] !== ' ') {
            text += ' ';
            map.push({ node: n, local: i });
          }
        } else {
          text += ch;
          map.push({ node: n, local: i });
        }
      }
    } else if (Array.isArray(n.children)) {
      n.children.forEach(walk);
    }
  };
  walk(p);
  while (text.endsWith(' ')) {
    text = text.slice(0, -1);
    map.pop();
  }
  return { text, map };
}

/**
 * 段落重建：按基本段切分 p 的子树，标注基本段以 span[data-notes] 包裹
 * （返回新 children 数组；返回 null 表示无需分段）。
 * 切点落在行内元素内部时递归切分该元素；带 id 的元素被切开时 id 归首片（onWarn 通知）。
 */
export function segmentParagraph(p, ranges, { onWarn } = {}) {
  const { text, map } = flattenBlock(p);
  const cells = segmentRanges(text.length, ranges);
  if (cells.length === 0 || cells.every((c) => c.notes.length === 0)) return null;

  // 节点级元数据：文本节点的保留字符原始位映射 + 归一化长度表
  const nodeInfo = new Map(); // textNode -> { start, locals: [rawIndex...] }
  for (let i = 0; i < map.length; i++) {
    const entry = map[i];
    let info = nodeInfo.get(entry.node);
    if (!info) {
      info = { start: i, locals: [] };
      nodeInfo.set(entry.node, info);
    }
    info.locals.push(entry.local);
  }
  const lenOf = new Map();
  const measure = (n) => {
    if (n.type === 'text') {
      const len = nodeInfo.get(n)?.locals.length ?? 0;
      lenOf.set(n, len);
      return len;
    }
    let total = 0;
    for (const c of n.children ?? []) total += measure(c);
    lenOf.set(n, total);
    return total;
  };
  measure(p);

  const warned = new Set();

  const sliceText = (node, s, e) => {
    const info = nodeInfo.get(node);
    const relS = s - info.start;
    const relE = e - info.start;
    const L = info.locals;
    const rawS = relS <= 0 ? 0 : L[relS - 1] + 1;
    const rawE = relE >= L.length ? node.value.length : L[relE];
    return { type: 'text', value: node.value.slice(rawS, rawE).replace(/\s+/g, ' ') };
  };

  const isEmpty = (piece) =>
    !piece || (piece.type === 'text' ? piece.value === '' : piece.children.length === 0);

  // 追加 + 相邻文本节点归并（跨基本段的切片拼回连续文本）
  const pushCoalesced = (arr, piece) => {
    if (isEmpty(piece)) return;
    const last = arr[arr.length - 1];
    if (piece.type === 'text' && last && last.type === 'text') {
      last.value += piece.value;
      return;
    }
    arr.push(piece);
  };

  // 嵌套元素的分段：返回 {first, pieces}，pieces[i] = 覆盖 cells[first+i] 的节点
  // （元素横跨多个基本段时逐段克隆；带 id 时首片保留、余片摘除并告警）
  const build = (el, base) => {
    const len = lenOf.get(el);
    let first = 0;
    while (first < cells.length && cells[first].end <= base) first++;
    if (first >= cells.length) return { first: cells.length, pieces: [] };
    let last = cells.length - 1;
    while (last > first && cells[last].start >= base + len) last--;
    if (first === last && cells[first].start <= base && cells[first].end >= base + len) {
      return { first, pieces: [el] }; // 单基本段全覆盖：整体保留
    }

    let keptId = false;
    const pieces = [];
    let ci = 0;
    let off = base;
    for (let k = first; k <= last; k++) {
      const cell = cells[k];
      const props = { ...el.properties };
      if (el.properties?.id) {
        if (keptId) {
          props.id = undefined;
          if (!warned.has(el)) {
            warned.add(el);
            onWarn?.(`边注锚点 #${el.properties.id} 被引用区间切分，id 保留于首片`);
          }
        } else keptId = true;
      }
      const clone = { type: 'element', tagName: el.tagName, properties: props, children: [] };
      const segStart = Math.max(cell.start, base);
      const segEnd = Math.min(cell.end, base + len);
      let pos = segStart;
      while (pos < segEnd && ci < el.children.length) {
        const child = el.children[ci];
        const cend = off + lenOf.get(child);
        const takeS = Math.max(pos, off);
        const takeE = Math.min(segEnd, cend);
        if (takeE > takeS) {
          let piece = null;
          if (child.type === 'text') {
            piece = sliceText(child, takeS, takeE);
          } else {
            const sub = build(child, off);
            piece = sub.pieces[k - sub.first] ?? null;
          }
          pushCoalesced(clone.children, piece);
        }
        if (takeE === cend) {
          ci++;
          off = cend;
        }
        pos = takeE;
      }
      pieces.push(clone);
    }
    return { first, pieces };
  };

  // 根层消费：基本段首尾相接，光标 (ci, off) 单调前进，无间隙、无重复
  const children = [];
  let ci = 0;
  let off = 0;
  cells.forEach((cell, k) => {
    const group = [];
    let pos = cell.start;
    while (pos < cell.end && ci < p.children.length) {
      const child = p.children[ci];
      const cend = off + lenOf.get(child);
      const takeS = Math.max(pos, off);
      const takeE = Math.min(cell.end, cend);
      if (takeE > takeS) {
        let piece = null;
        if (child.type === 'text') {
          piece = sliceText(child, takeS, takeE);
        } else {
          const sub = build(child, off);
          piece = sub.pieces[k - sub.first] ?? null;
        }
        pushCoalesced(group, piece);
      }
      if (takeE === cend) {
        ci++;
        off = cend;
      }
      pos = takeE;
    }
    if (group.length === 0) return;
    if (cell.notes.length === 0) {
      for (const piece of group) pushCoalesced(children, piece);
      return;
    }
    const notes = cell.notes.join(' ');
    const last = children[children.length - 1];
    if (
      last &&
      last.type === 'element' &&
      last.tagName === 'span' &&
      last.properties['data-notes'] === notes
    ) {
      for (const piece of group) pushCoalesced(last.children, piece); // 相邻同注合并
      return;
    }
    children.push({
      type: 'element',
      tagName: 'span',
      properties: { 'data-notes': notes },
      children: group,
    });
  });
  return children;
}

const classArrayOf = (el) => {
  const c = el.properties?.class;
  return Array.isArray(c) ? c : typeof c === 'string' ? c.split(/\s+/).filter(Boolean) : [];
};

/**
 * rehype 接线：收集边注容器的 data-quote-anchor → 在段落规范化文本中检索定位
 * （边注内部不参与检索；零匹配/多匹配 strict 下构建失败）→ aside 挂 data-anchor、
 * 摘除暂存属性 → 命中段落做区间分段。重复 note id 视为配置错误。
 */
export function rehypeNoteSegment(options = {}) {
  const strict = options.strict !== false;
  return (tree, file) => {
    const fail = (msg, node) => (strict ? file.fail(msg, node) : file.message(msg, node));
    const quotes = [];
    const paragraphs = [];
    const spanIds = new Map(); // 行内锚 id（可与对应 aside 的 data-anchor 同值——那是配对不是重复）
    const asideIds = new Map();

    const walk = (parent) => {
      for (const child of parent.children ?? []) {
        if (child.type !== 'element') continue;
        if (classArrayOf(child).includes('margin-note')) {
          const id = child.properties['data-anchor'];
          const q = child.properties['data-quote-anchor'] ?? child.properties.dataQuoteAnchor;
          if (id != null) {
            if (asideIds.has(id)) fail(`重复的边注 id：#${id}（两个边注容器）`, child);
            else asideIds.set(id, child);
          }
          if (q != null) quotes.push({ aside: child, id, quote: String(q) });
          continue; // 边注内部不参与检索与分段
        }
        if (child.properties?.id && classArrayOf(child).includes('note-anchor')) {
          if (spanIds.has(child.properties.id)) {
            fail(`重复的行内锚 id：#${child.properties.id}（两个行内锚点）`, child);
          } else spanIds.set(child.properties.id, child);
        }
        if (child.tagName === 'p') paragraphs.push(child);
        walk(child);
      }
    };
    walk(tree);

    const flat = new Map(paragraphs.map((p) => [p, flattenBlock(p)]));
    const rangesByP = new Map();
    for (const { aside, id, quote } of quotes) {
      let hit = null;
      let count = 0;
      for (const p of paragraphs) {
        const { text } = flat.get(p);
        for (const [s, e] of findQuote(text, quote)) {
          count++;
          hit = { p, start: s, end: e };
        }
      }
      if (count === 0) {
        fail(`引用失配（未命中）：「${quote}」`, aside);
        continue;
      }
      if (count > 1) {
        fail(`引用歧义（命中 ${count} 处）：「${quote}」`, aside);
        continue;
      }
      delete aside.properties['data-quote-anchor'];
      delete aside.properties.dataQuoteAnchor;
      aside.properties['data-anchor'] = id;
      if (!rangesByP.has(hit.p)) rangesByP.set(hit.p, []);
      rangesByP.get(hit.p).push({ start: hit.start, end: hit.end, id });
    }

    for (const [p, ranges] of rangesByP) {
      const children = segmentParagraph(p, ranges, {
        onWarn: (msg) => file.message(msg, p),
      });
      if (children) p.children = children;
    }
  };
}
