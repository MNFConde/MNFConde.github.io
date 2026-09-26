/**
 * 首页双维过滤（M7）：chip click 显隐 + 系列视图按序重排 + 深链还原。
 * 显隐模型 = 全集常驻 DOM（前提 = 构建期不分页）；无 JS 时 chips 是无效按钮但列表完整可读（渐进增强）。
 * URL 状态 = ?tag= / ?series=（单一激活过滤器，两参数不同现）；pushState 写入、载入/popstate 还原；
 * 交互一律 click（承 M3 定案），再点同一 chip 即取消回全量。
 */
export function initFilterEngine() {
  const bar = document.querySelector('[data-filter-bar]');
  const list = document.querySelector('[data-filter-list]');
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

  let active = null; // { dim: 'tag' | 'series', value }

  const matches = (it) =>
    !active || (active.dim === 'tag' ? it.tags.includes(active.value) : it.series === active.value);

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
      const on = !!active && chip.dataset.filter === active.dim && chip.dataset.value === active.value;
      chip.setAttribute('aria-pressed', String(on));
    }
    const visible = items.filter(matches);
    // 系列视图按 seriesOrder 重排（缺序尾置、同位保构建序）；其余情形按构建序复位
    const ordered =
      active?.dim === 'series'
        ? [...visible].sort((a, b) => a.order - b.order || a.buildIndex - b.buildIndex)
        : items;
    for (const it of items) {
      it.el.hidden = !visible.includes(it);
      it.el.querySelector('.filter-badge')?.remove(); // 角标仅系列视图在场
    }
    if (active?.dim === 'series') ordered.forEach((it, i) => setBadge(it, i + 1, ordered.length));
    for (const it of ordered) list.appendChild(it.el); // 依目标序逐个搬移到末尾即完成重排
  };

  const syncUrl = () => {
    const url = new URL(location.href);
    url.searchParams.delete('tag');
    url.searchParams.delete('series');
    if (active) url.searchParams.set(active.dim, active.value);
    history.pushState({ filter: active }, '', url);
  };

  const fromUrl = () => {
    const params = new URLSearchParams(location.search);
    const found = ['tag', 'series']
      .map((dim) => ({ dim, value: params.get(dim) }))
      .find((p) => p.value !== null);
    // 深链值须对应现存 chip（防手滑/失效标签留下空列表）
    active =
      found && chips.some((c) => c.dataset.filter === found.dim && c.dataset.value === found.value)
        ? found
        : null;
  };

  chips.forEach((chip) =>
    chip.addEventListener('click', () => {
      const same = !!active && active.dim === chip.dataset.filter && active.value === chip.dataset.value;
      active = same ? null : { dim: chip.dataset.filter, value: chip.dataset.value };
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
