/**
 * 标题导航（M6）：折叠/展开状态机 + scroll-spy。
 * 断点只改渲染形态（CSS 媒询：桌面左缘窄轨 → fixed 面板 / 窄屏角标 → 居中模态 + scrim），
 * 状态语义单布尔；与 notes-engine 零共享（导航展开 ≠ 边注选中召唤，只共享 scrim 模式与令牌）。
 */
export function initTocEngine() {
  const nav = document.getElementById('toc');
  if (!nav) return;
  const tab = nav.querySelector('.toc-tab');
  const links = [...nav.querySelectorAll('.toc-panel a')];

  const isOpen = () => nav.dataset.open === 'true';
  const setOpen = (open) => {
    nav.dataset.open = String(open);
    tab.setAttribute('aria-expanded', String(open));
  };
  tab.addEventListener('click', () => setOpen(!isOpen()));
  nav.querySelector('.toc-scrim').addEventListener('click', () => setOpen(false));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen()) setOpen(false);
  });

  // 窄屏导航完即收起（模态不滞留挡文）；桌面面板常驻供阅读中持续定位；
  // 点击即点亮目标——跳转可能被页尾钳制（尾节标题进不了观察条带），不能等 spy 纠正
  const byId = new Map(links.map((a) => [decodeURIComponent(a.hash.slice(1)), a]));
  const narrow = () => matchMedia('(max-width: 1100px)').matches;
  links.forEach((a) =>
    a.addEventListener('click', () => {
      setActive(decodeURIComponent(a.hash.slice(1)));
      if (narrow()) setOpen(false);
    })
  );

  // scroll-spy：标题穿过视口顶部条带即点亮；条带内无标题时保持上一个（快速滚动不闪烁）。
  // 尾节例外——页尾内容不足一屏时浏览器把跳转钳短，尾标题永远进不了顶部条带，
  // 故尾节用全视口观察（进入视口即亮：它是最后一节，此时前面各节均已读过）
  const setActive = (id) => {
    const hit = byId.get(id);
    if (!hit) return;
    for (const a of links) a.classList.toggle('is-here', a === hit);
  };
  const targets = [...byId.keys()]
    .map((id) => document.getElementById(id))
    .filter(Boolean);
  if (!targets.length) return;
  setActive(targets[0].id); // 页面顶部时首节预点亮

  const onSpy = (entries) => {
    // 同批多命中时取文档序最靠后者（后节覆盖前节）
    const hit = entries
      .filter((en) => en.isIntersecting)
      .sort((a, b) => targets.indexOf(a.target) - targets.indexOf(b.target))
      .pop();
    if (hit) setActive(hit.target.id);
  };
  const spy = new IntersectionObserver(onSpy, { rootMargin: '0px 0px -75% 0px' });
  const tailSpy = new IntersectionObserver(onSpy, {});
  targets.forEach((t, i) => (i === targets.length - 1 ? tailSpy : spy).observe(t));
}
