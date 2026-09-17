/**
 * M3 桌面边注引擎（>1100px 平铺形态）。
 *
 * 职责：断点激活 → 批量测量（锚点位/高度缓存）→ layoutNotes 纯函数排程 → 批量写 top/side。
 * 滚动路径零布局读取：锚点位与高度仅在 measure() 刷新（激活/resize/字体就绪/load），
 * scroll 只读 scrollY 做回升修正，rAF 节流。窄屏（≤1100px）摘除模式属性，回落 CSS 内联降级。
 *
 * 断点 1101px 与 global.css 的 1100px 降级断点配对，改动须两处同步。
 */
import { layoutNotes } from './notes-layout.js';

const MQ_DESKTOP = '(min-width: 1101px)';
const VP_PAD = 24;        // 回升时边注距视口上沿的缓冲（px）
const DRIFT_THRESHOLD = 96; // drift 超过此值才参与视口回升（px，约 4 行边注文字）

export function initNotesEngine() {
  const layoutEl = document.querySelector('.note-layout');
  const mainEl = layoutEl?.querySelector('.note-main');
  if (!layoutEl || !mainEl) return;
  const asides = [...layoutEl.querySelectorAll('.margin-note[data-anchor]')];
  if (asides.length === 0) return;

  const model = asides.map((el) => ({
    el,
    id: el.dataset.anchor,
    anchorTop: 0,
    height: 0,
    top: 0,
    side: 'right',
    frozen: false,
  }));
  const base = { top: 0 }; // .note-main 的文档 top（absolute 定位原点）
  let active = false;
  let gap = 16;

  // 令牌换算：--note-gap 等 rem 值 → px（承 M1.5 约束：尺寸只出自 theme.css）
  function tokenPx(name, fallback) {
    const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    const m = raw.match(/^(-?[\d.]+)(px|rem|em)?$/);
    if (!m) return fallback;
    const v = parseFloat(m[1]);
    if (m[2] === 'px' || !m[2]) return v;
    return v * parseFloat(getComputedStyle(document.documentElement).fontSize);
  }

  // 锚点解析：行内锚（span.note-anchor#id，可能被分段切开、id 归首片）或引用式区间首段
  const findAnchor = (id) =>
    mainEl.querySelector(`.note-anchor[id="${id}"], [data-notes~="${id}"]`);

  function measure() {
    base.top = mainEl.getBoundingClientRect().top + window.scrollY;
    for (const m of model) {
      const a = findAnchor(m.id);
      m.anchorTop = a ? a.getBoundingClientRect().top + window.scrollY - base.top : 0;
    }
    for (const m of model) m.height = m.el.getBoundingClientRect().height;
  }

  function apply(plan) {
    model.forEach((m, i) => {
      m.side = plan[i].side;
      m.top = plan[i].top;
      m.el.style.top = `${Math.round(m.top)}px`;
      m.el.classList.toggle('is-left', m.side === 'left');
    });
  }

  function relayout({ withViewport = false } = {}) {
    if (!active) return;
    const plan = layoutNotes(
      model.map((m) => ({
        anchorTop: m.anchorTop,
        height: m.height,
        frozenTop: m.frozen ? m.top : undefined,
        frozenSide: m.side,
      })),
      {
        gap,
        viewportTop: withViewport ? window.scrollY - base.top - VP_PAD : null,
        driftThreshold: DRIFT_THRESHOLD,
      }
    );
    apply(plan);
  }

  function activate() {
    if (active) return;
    active = true;
    gap = tokenPx('--note-gap', 16);
    layoutEl.setAttribute('data-notes-float', '');
    measure();
    relayout();
  }

  function deactivate() {
    if (!active) return;
    active = false;
    layoutEl.removeAttribute('data-notes-float');
    for (const m of model) {
      m.el.style.removeProperty('top');
      m.el.classList.remove('is-left');
    }
  }

  const mq = window.matchMedia(MQ_DESKTOP);
  const onMq = () => (mq.matches ? activate() : deactivate());
  mq.addEventListener('change', onMq);

  const rafWrap = (fn) => {
    let frame = 0;
    return () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        fn();
      });
    };
  };
  const onScroll = rafWrap(() => relayout({ withViewport: true }));
  const onResize = rafWrap(() => {
    if (!active) return;
    gap = tokenPx('--note-gap', 16);
    measure();
    relayout();
  });
  const remeasure = rafWrap(() => {
    if (!active) return;
    measure();
    relayout();
  });

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onResize);
  window.addEventListener('load', remeasure);
  document.fonts?.ready.then(remeasure);

  onMq();
}
