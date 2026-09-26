/**
 * 首页双维过滤（M7；M7.1 多选标签）：chip click 显隐 + 系列视图按序重排 + 深链还原。
 * 互斥定案（26-09-26）：标签×系列、系列×系列互斥（选系列清标签、选标签清系列、URL 两维同现系列优先）；
 * 标签×标签可叠加，AND 交集逐层收窄（再点同一 chip 取消）。「全部」chip 一键清空。
 * 空态：有过滤且交集为 ∅ → 显示「无匹配文章」提示。
 * 显隐模型 = 全集常驻 DOM（前提 = 构建期不分页）；无 JS 时 chips 是无效按钮但列表完整可读（渐进增强）。
 * URL 状态 = ?tag=a&tag=b（重复参数，任意字符安全）+ ?series=x（单值，两维不同现）；
 * pushState 写入、载入/popstate 还原；交互一律 click（承 M3 定案）。
 */
export function initFilterEngine() {
  const bar = document.querySelector('[data-filter-bar]');
  const list = document.querySelector('[data-filter-list]');
  const empty = document.querySelector('.filter-empty');
  if (!bar || !list) return;

  // 构建序 = 日期倒序原貌，退出系列视图按它复位
  const items = [...list.children].map((el, i) => {
    let tags = [];
    try {
      tags = JSON.parse(el.dataset.tags || '[]');
    } catch {}
    const raw = el.dataset.order;
    return {
      el,
      buildIndex: i,
      tags,
      series: el.dataset.series || '',
      order: raw === undefined || raw === '' ? Infinity : Number(raw), // Number('') === 0，须显式挡
    };
  });
  const chips = [...bar.querySelectorAll('.filter-chip')];
  const seriesChips = chips.filter((c) => c.dataset.filter === 'series');
  const tagChips = chips.filter((c) => c.dataset.filter === 'tag');

  let activeSeries = null; // 单选（互斥：非 null 时标签必空）
  let activeTags = new Set(); // 多选 AND

  const hasFilter = () => activeSeries !== null || activeTags.size > 0;

  const matches = (it) => {
    if (activeSeries !== null) return it.series === activeSeries;
    if (activeTags.size > 0) return [...activeTags].every((t) => it.tags.includes(t));
    return true;
  };

  const setBadge = (it, index, total) => {
    let badge = it.el.querySelector('.filter-badge');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'filter-badge';
      it.el.querySelector('a').after(badge);
    }
    badge.textContent = `第 ${index}/${total} 篇`;
  };

  const apply = () => {
    for (const chip of chips) {
      const { filter, value } = chip.dataset;
      const on =
        filter === 'all'
          ? !hasFilter()
          : filter === 'series'
            ? value === activeSeries
            : activeTags.has(value);
      chip.setAttribute('aria-pressed', String(on));
    }
    const visible = items.filter(matches);
    // 系列视图按 seriesOrder 重排（缺序尾置、同位保构建序）；其余情形按构建序复位
    const ordered =
      activeSeries !== null
        ? [...visible].sort((a, b) => a.order - b.order || a.buildIndex - b.buildIndex)
        : items;
    for (const it of items) {
      it.el.hidden = !visible.includes(it);
      it.el.querySelector('.filter-badge')?.remove(); // 角标仅系列视图在场
    }
    if (activeSeries !== null) ordered.forEach((it, i) => setBadge(it, i + 1, ordered.length));
    for (const it of ordered) list.appendChild(it.el); // 依目标序逐个搬移到末尾即完成重排
    if (empty) empty.hidden = !(hasFilter() && visible.length === 0);
  };

  const syncUrl = () => {
    const url = new URL(location.href);
    url.searchParams.delete('tag');
    url.searchParams.delete('series');
    if (activeSeries !== null) url.searchParams.set('series', activeSeries);
    for (const t of activeTags) url.searchParams.append('tag', t);
    history.pushState({ series: activeSeries, tags: [...activeTags] }, '', url);
  };

  const fromUrl = () => {
    const params = new URLSearchParams(location.search);
    const s = params.get('series');
    // 深链值须对应现存 chip（防手滑/失效标签留下假选中）；两维同现系列优先（与 UI 互斥方向一致）
    if (s !== null && seriesChips.some((c) => c.dataset.value === s)) {
      activeSeries = s;
      activeTags = new Set();
      return;
    }
    activeSeries = null;
    activeTags = new Set(params.getAll('tag').filter((t) => tagChips.some((c) => c.dataset.value === t)));
  };

  chips.forEach((chip) =>
    chip.addEventListener('click', () => {
      const { filter, value } = chip.dataset;
      if (filter === 'all') {
        activeSeries = null;
        activeTags = new Set();
      } else if (filter === 'series') {
        activeSeries = activeSeries === value ? null : value;
        activeTags = new Set(); // 互斥：选系列清标签
      } else {
        activeSeries = null; // 互斥：选标签清系列
        const next = new Set(activeTags);
        if (next.has(value)) next.delete(value);
        else next.add(value);
        activeTags = next;
      }
      apply();
      syncUrl();
    })
  );
  window.addEventListener('popstate', () => {
    fromUrl();
    apply();
  });

  fromUrl();
  apply();
}
