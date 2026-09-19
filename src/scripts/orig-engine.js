const PREF_KEY = 'orig';

/** 角标挂点：标题/段落直接塞尾部；列表/引用落到最后一个子块，避免按钮落在合法子元素之外 */
function badgeHost(target) {
  if (target.tagName === 'UL' || target.tagName === 'OL' || target.tagName === 'BLOCKQUOTE') {
    return target.lastElementChild ?? target;
  }
  return target;
}

/**
 * 原文对照交互（M5，posts）：段尾角标单段开合 + 全局按钮批量开合。
 * 状态优先级 = localStorage 读者偏好（全局按钮写入，跨页延续）> 构建期 frontmatter 默认（is-open 预置）> 收起；
 * 段级开合仅会话内生效，不落盘。
 */
export function initOrigEngine() {
  const blocks = [...document.querySelectorAll('.orig-block')];
  if (!blocks.length) return;
  const globalBtn = document.getElementById('orig-toggle');
  const isOpen = (el) => el.classList.contains('is-open');
  const badges = new Map();

  const syncBadge = (el) => badges.get(el)?.setAttribute('aria-pressed', String(isOpen(el)));
  const syncGlobal = () =>
    globalBtn?.setAttribute('aria-pressed', String(blocks.every(isOpen)));

  for (const el of blocks) {
    const target = el.previousElementSibling;
    if (!target) continue;
    const badge = document.createElement('button');
    badge.type = 'button';
    badge.className = 'orig-toggle';
    badge.textContent = '原文';
    badge.setAttribute('aria-pressed', String(isOpen(el)));
    badge.addEventListener('click', (event) => {
      event.stopPropagation();
      el.classList.toggle('is-open');
      syncBadge(el);
      syncGlobal();
    });
    badgeHost(target).append(badge);
    badges.set(el, badge);
  }

  globalBtn?.addEventListener('click', () => {
    const open = !blocks.every(isOpen);
    for (const el of blocks) {
      el.classList.toggle('is-open', open);
      syncBadge(el);
    }
    try {
      localStorage.setItem(PREF_KEY, open ? 'on' : 'off');
    } catch {}
    syncGlobal();
  });

  syncGlobal();
}
