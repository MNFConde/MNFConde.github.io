/**
 * 边注交互引擎（桌面 >1100px 平铺；窄屏行为见 M4 聚焦模式切片）。
 *
 * 职责：
 *  - 碰撞布局：断点激活 → 批量测量（锚点位/高度缓存）→ layoutNotes 纯函数排程 → 批量写 top/side。
 *    滚动路径零布局读取（scroll 只读 scrollY），rAF 节流。
 *  - click 联动状态机（M3 切片3）：点击正文区间/边注 → 两端点亮 + 对应边注 pinned 浮层
 *    （top 临时改写为 max(锚点, 视口上沿+pad)，z-index/阴影浮于其它边注之上，其余边注不动）；
 *    点击空白/Escape 清除、点击另一目标切换、再次点击同一目标取消。窄屏聚焦模式（M4）复用
 *    同一状态机，只换渲染分支。
 *
 * 断点 1101px 与 global.css 的 1100px 降级断点配对，改动须两处同步。
 */
import { layoutNotes } from './notes-layout.js';

const MQ_DESKTOP = '(min-width: 1101px)';
const VP_PAD = 24;          // 视口上沿缓冲（px）
const DRIFT_THRESHOLD = 96; // drift 超过此值才参与视口回升（px）

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
  }));
  const base = { top: 0 }; // .note-main 的文档 top（absolute 定位原点）
  let active = false;
  let gap = 16;
  let activeIds = new Set();
  let pinnedIds = new Set();

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
      model.map((m) => ({ anchorTop: m.anchorTop, height: m.height })),
      {
        gap,
        viewportTop: withViewport ? window.scrollY - base.top - VP_PAD : null,
        driftThreshold: DRIFT_THRESHOLD,
      }
    );
    apply(plan);
  }

  // pinned 浮层位：钳在锚点与视口上沿之间，随滚动跟随（召唤态的 sticky，
  // 与常驻布局「不追踪视口」定案不冲突——显式召唤 ≠ 常驻几何）
  function updatePinned() {
    if (!active || pinnedIds.size === 0) return;
    const vpTop = window.scrollY - base.top + VP_PAD;
    for (const m of model) {
      if (pinnedIds.has(m.id)) {
        m.el.style.top = `${Math.round(Math.max(m.anchorTop, vpTop))}px`;
      }
    }
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
    clearSelection();
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
  const onScroll = rafWrap(() => {
    if (pinnedIds.size > 0) updatePinned(); // 选中期间其余边注冻结在静态位，只跟随 pinned
    else relayout({ withViewport: true });
  });
  const onResize = rafWrap(() => {
    if (!active) return;
    gap = tokenPx('--note-gap', 16);
    measure();
    relayout();
    updatePinned();
  });
  const remeasure = rafWrap(() => {
    if (!active) return;
    measure();
    relayout();
    updatePinned();
  });

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onResize);
  window.addEventListener('load', remeasure);
  document.fonts?.ready.then(remeasure);

  // —— 高亮管理（映射/管理基建，桌面 pinned 与窄屏模态两分支共用）——
  function setActive(ids) {
    activeIds = ids;
    layoutEl.classList.add('has-focus');
    for (const m of model) m.el.classList.toggle('is-active', ids.has(m.id));
    for (const el of layoutEl.querySelectorAll('[data-notes], .note-anchor')) {
      const elIds = el.dataset.notes ? el.dataset.notes.split(/\s+/) : [el.id];
      el.classList.toggle('is-active', elIds.some((x) => ids.has(x)));
    }
  }

  function clearSelection() {
    if (activeIds.size === 0 && pinnedIds.size === 0) return;
    activeIds = new Set();
    pinnedIds.clear();
    layoutEl.classList.remove('has-focus', 'has-pin');
    for (const el of layoutEl.querySelectorAll('.is-active, .is-pinned')) {
      el.classList.remove('is-active', 'is-pinned');
    }
    if (active) relayout(); // pinned 恢复静态排程位；其余边注全程未动
  }

  const targetIds = (el) => {
    const note = el.closest?.('.margin-note');
    if (note) return new Set([note.dataset.anchor]);
    const t = el.closest?.('[data-notes], .note-anchor');
    if (!t) return null;
    return new Set(t.dataset.notes ? t.dataset.notes.split(/\s+/) : [t.id]);
  };

  const sameSet = (a, b) => a.size === b.size && [...a].every((x) => b.has(x));

  function applySelection(ids) {
    setActive(ids);
    if (!active) return; // 窄屏（M4 聚焦分支）只高亮，浮层属于桌面形态
    pinnedIds = new Set([...ids].filter((id) => model.some((m) => m.id === id)));
    layoutEl.classList.add('has-pin');
    for (const m of model) m.el.classList.toggle('is-pinned', pinnedIds.has(m.id));
    updatePinned();
  }

  layoutEl.addEventListener('click', (e) => {
    if (e.target.closest?.('.note-copy')) return; // 复制按钮是独立点击目标
    if (getSelection()?.toString()) return; // 拖选文本不是选中意图
    const ids = targetIds(e.target);
    if (!ids) return;
    if (sameSet(ids, activeIds)) clearSelection();
    else applySelection(ids);
  });
  document.addEventListener('click', (e) => {
    if (!targetIds(e.target)) clearSelection();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') clearSelection();
  });

  // —— 交互：单条边注 hover 复制 + 双击侧栏空白全选边注 ——
  // 拖拽级按栏隔离为浏览器原生限制（选区跟 DOM 序），复制/全选走程序化路径
  const noteText = (m) => {
    const clone = m.el.cloneNode(true);
    clone.querySelector('.note-copy')?.remove();
    return (clone.textContent ?? '').replace(/\s+/g, ' ').trim();
  };

  const writeClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // 非安全上下文兜底（localhost/https 之外 clipboard API 不可用）
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('style', 'position:fixed;opacity:0');
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
  };

  for (const m of model) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'note-copy';
    btn.textContent = '复制';
    btn.setAttribute('aria-label', `复制边注 ${m.id}`);
    btn.addEventListener('click', async () => {
      await writeClipboard(noteText(m));
      btn.textContent = '已复制';
      setTimeout(() => {
        btn.textContent = '复制';
      }, 1200);
    });
    m.el.appendChild(btn);
  }

  // 双击侧栏空白：边注文本收集进屏外克隆容器并程序化选中（Selection 可跨
  // user-select:none），用户 Ctrl+C 即得全部边注；边注全亮作选中反馈
  let cloneBox = null;
  const clearClone = () => {
    cloneBox?.remove();
    cloneBox = null;
  };
  layoutEl.addEventListener('dblclick', (e) => {
    if (e.target !== layoutEl) return; // 仅侧栏空白（正文/边注元素不触发）
    clearClone();
    cloneBox = document.createElement('div');
    cloneBox.className = 'notes-clone-box';
    for (const m of model) {
      const p = document.createElement('p');
      p.textContent = noteText(m);
      cloneBox.appendChild(p);
    }
    document.body.appendChild(cloneBox);
    const range = document.createRange();
    range.selectNodeContents(cloneBox);
    const sel = getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    setActive(new Set(model.map((m) => m.id)));
    setTimeout(() => {
      if (cloneBox) {
        clearClone();
        clearSelection();
      }
    }, 1600);
  });
  document.addEventListener(
    'click',
    (e) => {
      if (cloneBox && !cloneBox.contains(e.target)) {
        clearClone();
        getSelection()?.removeAllRanges();
      }
    },
    true
  );

  onMq();
}
