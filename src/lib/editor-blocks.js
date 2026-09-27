/**
 * M9 块模型（同构纯函数，无 node 依赖——浏览器编辑页与中间件共用）。
 *
 * 数据模型：文档 = frontmatter（有序键值）+ blocks[]；每块单一 type 字段
 * （p / h2 / h3 / essay / note / code / image）——块格式互斥由数据模型结构性
 * 保证：切格式 = 改 type，不存在「1 套 2」的嵌套路径。行内内容（含
 * :note-m[词句]{#id} 行内锚）保留 markdown 源文本，随 p 块文本原样往返。
 *
 * 解析策略：行扫描 + 容器配对；未识别的行（列表/引用/裸 html 等）原样并入
 * p 块文本，保证 parse → serialize 对常规既有文档字节级往返（连续空行规整
 * 为单空行）；预览照常走构建管线渲染，不受影响。
 */
import { findQuote } from '../plugins/segment.js';

const NOTE_OPEN = /^:::note-m\{#([A-Za-z0-9_-]+)\}\s*$/;
const ESSAY_OPEN = /^:::essay\s*$/;
const CONTAINER_CLOSE = /^:::\s*$/;
const HEADING = /^(#{2,3})\s+(.*)$/;
const FENCE_OPEN = /^```(.*)$/;
const IMAGE = /^!\[([^\]]*)\]\(\s*<?([^)>\s]+)>?(?:\s+"([^"]*)")?\s*\)\s*$/;
const FM_LINE = /^([A-Za-z][A-Za-z0-9_-]*):\s?(.*)$/;
const FM_ARRAY = /^\[(.*)\]$/;

/** 引用串规范化：与构建检索同一空间（空白折叠为单空格、去首尾） */
export function normalizeQuote(s) {
  return String(s ?? '').replace(/\s+/g, ' ').trim();
}

/** frontmatter：解析为有序键值（保留 raw 供往返），value 为 string | string[] */
export function parseFrontmatter(text) {
  const entries = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    const m = line.match(FM_LINE);
    if (!m) continue;
    const [, key, raw] = m;
    const arr = raw.match(FM_ARRAY);
    entries.push(
      arr
        ? { key, raw, value: arr[1].split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean) }
        : { key, raw, value: raw.replace(/^['"]|['"]$/g, '') }
    );
  }
  return entries;
}

export function serializeFrontmatter(entries) {
  return entries.map((e) => `${e.key}: ${e.raw}`).join('\n');
}

/** 正文 → blocks[] */
export function parseBlocks(text) {
  const blocks = [];
  const lines = text.split('\n');
  let para = [];

  const flushPara = () => {
    const t = para.join('\n');
    if (t.trim()) blocks.push({ type: 'p', text: t.replace(/^\n+|\n+$/g, '') });
    para = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const note = line.match(NOTE_OPEN);
    const essay = line.match(ESSAY_OPEN);
    const heading = line.match(HEADING);
    const fence = line.match(FENCE_OPEN);
    const image = para.length === 0 && lines[i + 1]?.trim() === '' ? line.match(IMAGE) : null;

    if (note || essay || heading || fence || image || line.trim() === '') {
      flushPara();
    } else {
      para.push(line);
      continue;
    }

    if (line.trim() === '') continue;

    if (heading) {
      blocks.push({ type: heading[1] === '##' ? 'h2' : 'h3', text: heading[2] });
    } else if (image) {
      blocks.push({ type: 'image', src: image[2], alt: image[1], title: image[3] ?? '' });
    } else if (fence) {
      const buf = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) buf.push(lines[i++]);
      blocks.push({ type: 'code', lang: fence[1].trim(), text: buf.join('\n') });
    } else if (essay) {
      const buf = [];
      i++;
      while (i < lines.length && !CONTAINER_CLOSE.test(lines[i])) buf.push(lines[i++]);
      blocks.push({ type: 'essay', text: buf.join('\n').trim() });
    } else if (note) {
      const buf = [];
      i++;
      while (i < lines.length && !CONTAINER_CLOSE.test(lines[i])) buf.push(lines[i++]);
      // 首块引用 = 引用串（notes.js 约定）：开头的连续 `> ` 行，其余为边注正文
      let k = 0;
      const quoteLines = [];
      while (k < buf.length && /^>/.test(buf[k])) quoteLines.push(buf[k++].replace(/^>\s?/, ''));
      while (k < buf.length && !buf[k].trim()) k++; // 引用与正文间的空行
      blocks.push({
        type: 'note',
        id: note[1],
        quote: normalizeQuote(quoteLines.join(' ')),
        body: buf.slice(k).join('\n').trim(),
      });
    }
  }
  flushPara();
  return blocks;
}

/** md 全文 → { frontmatter, blocks } */
export function parseDoc(md) {
  let fmText = '';
  let body = md;
  if (md.startsWith('---\n')) {
    const end = md.slice(4).search(/^---\s*$/m);
    if (end !== -1) {
      fmText = md.slice(4, end + 4);
      body = md.slice(md.indexOf('\n', end + 4) + 1);
      if (body.startsWith('\n')) body = body.slice(1);
    }
  }
  return { frontmatter: parseFrontmatter(fmText), blocks: parseBlocks(body) };
}

export function serializeDoc(doc) {
  const fm = doc.frontmatter.length
    ? `---\n${serializeFrontmatter(doc.frontmatter)}\n---\n\n`
    : '';
  const body = doc.blocks.map(serializeBlock).join('\n\n');
  return `${fm}${body}\n`;
}

export function serializeBlock(b) {
  switch (b.type) {
    case 'h2':
      return `## ${b.text}`;
    case 'h3':
      return `### ${b.text}`;
    case 'essay':
      return `:::essay\n${b.text}\n:::`;
    case 'note': {
      const quote = b.quote ? `> ${b.quote}\n\n` : '';
      return `:::note-m{#${b.id}}\n${quote}${b.body}\n:::`;
    }
    case 'code':
      return `\`\`\`${b.lang}\n${b.text}\n\`\`\``;
    case 'image':
      return `![${b.alt}](${b.src}${b.title ? ` "${b.title}"` : ''})`;
    default:
      return b.text;
  }
}

/** 下一个边注 id：扫描 note 块 id 与行内锚 id 的数字后缀取最大 +1 */
export function nextNoteId(blocks) {
  let max = 0;
  for (const b of blocks) {
    if (b.type === 'note') {
      const n = Number(b.id.match(/(\d+)$/)?.[1]);
      if (n > max) max = n;
    } else if (b.type === 'p') {
      for (const m of b.text.matchAll(/:note-m\[[^\]]*\]\{#([A-Za-z0-9_-]+)\}/g)) {
        const n = Number(m[1].match(/(\d+)$/)?.[1]);
        if (n > max) max = n;
      }
    }
  }
  return `n${max + 1}`;
}

/**
 * 行内 markdown → 近似渲染文本（编辑器侧引用串命中统计的检索空间）：
 * 构建（rehype）在渲染后的段落文本上检索；编辑器在源文本上剥离行内语法
 * 近似之。最终裁决仍归保存前的管线重放——此处的偏差只影响即时提示。
 */
export function inlineToText(md) {
  return normalizeQuote(
    String(md ?? '')
      .replace(/:note-m\[([^\]]*)\]\{#[^}]*\}/g, '$1')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/[*_`~]+/g, '')
      .replace(/^>\s?/gm, '')
  );
}

/**
 * 引用串命中统计（findQuote 与构建同一份代码）：返回命中次数与首个命中块
 * 下标。count !== 1 即失配/歧义——与 rehypeNoteSegment 的 strict 判定同构。
 */
export function countQuoteHits(blocks, quote) {
  const q = normalizeQuote(quote);
  let count = 0;
  let blockIndex = -1;
  blocks.forEach((b, i) => {
    if (b.type !== 'p') return;
    const hits = findQuote(inlineToText(b.text), q);
    if (hits.length > 0 && blockIndex === -1) blockIndex = i;
    count += hits.length;
  });
  return { count, blockIndex };
}

/**
 * 边注锚归属 + 树形导轨（M9.6）：note 块 → 锚块下标。行内锚（quote 空）扫
 * p/essay 文本按 id 直配（textDirective 层面生效，不限段落）；引用式走
 * countQuoteHits 同一检索，唯一命中才算配对——多命中歧义按失配，与 strict
 * 判定同构。导轨只画「紧跟锚块之后的连续边注组」：组前块即锚段（组内任一
 * 注锚到它）；锚到别处的注 rail='none' 仅缩进不画线（被 ↑↓ 挪离锚段同理），
 * 避免连接线误导从属。miss = 失配（渲染/保存会报错，列表同步标红）。
 */
export function noteRails(blocks) {
  const anchorOf = (note) => {
    if (note.quote) {
      const { count, blockIndex } = countQuoteHits(blocks, note.quote);
      return count === 1 ? blockIndex : -1;
    }
    const re = new RegExp(`:note-m\\[[^\\]]*\\]\\{#${note.id}\\}`);
    return blocks.findIndex((x) => (x.type === 'p' || x.type === 'essay') && re.test(x.text ?? ''));
  };
  const rails = new Array(blocks.length).fill(null);
  for (let i = 0; i < blocks.length; i++) {
    if (blocks[i].type !== 'note') continue;
    const start = i;
    while (i < blocks.length && blocks[i].type === 'note') i++;
    const anchors = [];
    for (let k = start; k < i; k++) anchors.push(anchorOf(blocks[k]));
    const runAnchor = anchors.includes(start - 1) ? start - 1 : -2;
    let last = -1;
    anchors.forEach((a, n) => {
      if (a === runAnchor) last = n;
    });
    anchors.forEach((a, n) => {
      rails[start + n] = {
        anchor: a,
        rail: a === runAnchor ? (n === last ? 'end' : 'through') : 'none',
        miss: a === -1,
      };
    });
    i--; // 外层 for 会 ++，回退到组尾让后续块照常处理
  }
  return rails;
}
