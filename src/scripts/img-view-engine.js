// M8 点击缩放预览引擎：正文图 → 全屏查看器（承 toc-engine 先例：DOM 层自建、零运行时依赖）
// 数学全在 img-view-math.js（可单测）：滚轮/双击/双指缩放（指针锚点）+ 拖拽平移（边界钳制）
// 浮层 fixed 覆盖式不动正文 DOM——规避 notes-engine 重排耦合（承 M6 TOC 定案）
import { clampPan, clampScale, fitScale, pinchScale, wheelScale, zoomAt } from './img-view-math.js';

const ANIM_MS = 220;

export function initImgViewEngine(root = document) {
  const imgs = [...root.querySelectorAll('.note-main img')].filter((el) => !el.closest('a'));
  if (imgs.length === 0) return; // 无正文图：no-op 零开销

  let overlay = null;
  let stage = null;
  let img = null;
  let closeBtn = null;
  let srcEl = null; // 打开来源图（还焦 + FLIP 起点/终点）
  let st = { s: 1, tx: 0, ty: 0 };
  let nat = { w: 1, h: 1 };
  let fitT = { s: 1, tx: 0, ty: 0 }; // fit 目标态（初值/「0」复位/双击回程）
  const pointers = new Map();
  let pinchDist = 0;
  let dragged = false;
  let lastFocus = null;
  let prevOverflow = '';
  let animTimer = 0;

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const view = () => ({ w: window.innerWidth, h: window.innerHeight });
  const center = (e) => ({ x: e.clientX - window.innerWidth / 2, y: e.clientY - window.innerHeight / 2 });

  function apply() {
    img.style.transform = `translate(-50%, -50%) translate(${st.tx}px, ${st.ty}px) scale(${st.s})`;
  }

  function animTo(target) {
    if (reduced.matches) {
      st = target;
      apply();
      return;
    }
    img.classList.add('is-anim');
    st = target;
    apply();
    window.clearTimeout(animTimer);
    animTimer = window.setTimeout(() => img.classList.remove('is-anim'), ANIM_MS + 40);
  }

  function measure() {
    const v = view();
    nat = { w: img.naturalWidth || 1, h: img.naturalHeight || 1 };
    fitT = { s: fitScale(nat.w, nat.h, v.w, v.h), tx: 0, ty: 0 };
  }

  function buildViewer() {
    overlay = document.createElement('div');
    overlay.className = 'img-view';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', '图片预览');
    overlay.tabIndex = -1;
    overlay.style.display = 'none';
    overlay.innerHTML = [
      '<div class="img-view-backdrop"></div>',
      '<div class="img-view-stage"><img class="img-view-img" alt=""></div>',
      '<button type="button" class="img-view-close" aria-label="关闭预览">✕</button>',
    ].join('');
    stage = overlay.querySelector('.img-view-stage');
    img = overlay.querySelector('.img-view-img');
    closeBtn = overlay.querySelector('.img-view-close');

    stage.addEventListener('pointerdown', onPointerDown);
    stage.addEventListener('pointermove', onPointerMove);
    stage.addEventListener('pointerup', onPointerUp);
    stage.addEventListener('pointercancel', onPointerUp);
    stage.addEventListener('dblclick', onDblClick);
    stage.addEventListener('click', onStageClick);
    closeBtn.addEventListener('click', close);
    overlay.addEventListener('wheel', onWheel, { passive: false });
    overlay.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onResize);
    document.body.appendChild(overlay);
  }

  function open(el) {
    if (!overlay) buildViewer();
    srcEl = el;
    lastFocus = el;
    img.src = el.currentSrc || el.src;
    img.alt = el.alt || '';
    const ready = () => {
      measure();
      const v = view();
      const r = el.getBoundingClientRect();
      st = {
        s: clampScale(r.width / nat.w || fitT.s),
        tx: r.left + r.width / 2 - v.w / 2,
        ty: r.top + r.height / 2 - v.h / 2,
      };
      apply();
      prevOverflow = document.documentElement.style.overflow;
      document.documentElement.style.overflow = 'hidden'; // 打开期间滚动锁定（M4 模态无此先例，M8 新定）
      // 双 rAF：首帧落 FLIP 起点，次帧过渡到居中 fit
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          overlay.style.display = '';
          overlay.classList.add('is-open');
          animTo({ ...fitT });
          closeBtn.focus();
        }),
      );
    };
    if (img.complete && img.naturalWidth) ready();
    else img.addEventListener('load', ready, { once: true });
  }

  function close() {
    if (!overlay || !overlay.classList.contains('is-open')) return;
    overlay.classList.remove('is-open');
    const finish = () => {
      document.documentElement.style.overflow = prevOverflow;
      pointers.clear();
      pinchDist = 0;
      overlay.style.display = 'none';
      lastFocus?.focus();
    };
    // 反向 FLIP 回原图位；来源已离树（翻页缓存等）则径直收场
    if (reduced.matches || !srcEl || !srcEl.isConnected) {
      finish();
      return;
    }
    const v = view();
    const r = srcEl.getBoundingClientRect();
    animTo({
      s: clampScale((r.width / nat.w) || fitT.s),
      tx: r.left + r.width / 2 - v.w / 2,
      ty: r.top + r.height / 2 - v.h / 2,
    });
    window.setTimeout(finish, ANIM_MS + 30);
  }

  // —— 手势：拖拽平移 + 双指 pinch（pointer events 统一鼠标/触摸）——
  function onPointerDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    try {
      stage.setPointerCapture(e.pointerId); // 合成/已释放指针会抛 NotFoundError，捕获降级为冒泡路径
    } catch {}
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
    }
    dragged = false;
  }

  function onPointerMove(e) {
    if (!pointers.has(e.pointerId)) return;
    const prev = pointers.get(e.pointerId);
    const cur = { x: e.clientX, y: e.clientY };
    pointers.set(e.pointerId, cur);
    const v = view();

    if (pointers.size === 1) {
      const dx = cur.x - prev.x;
      const dy = cur.y - prev.y;
      if (dx || dy) dragged = true;
      st = clampPan({ s: st.s, tx: st.tx + dx, ty: st.ty + dy }, nat.w, nat.h, v.w, v.h);
      apply();
    } else if (pointers.size === 2) {
      dragged = true;
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const next = pinchScale(st.s, pinchDist, d);
      const mid = { x: (a.x + b.x) / 2 - v.w / 2, y: (a.y + b.y) / 2 - v.h / 2 };
      st = clampPan(zoomAt(st, next, mid.x, mid.y), nat.w, nat.h, v.w, v.h);
      apply();
      pinchDist = d;
    }
  }

  function onPointerUp(e) {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinchDist = 0;
  }

  // —— 缩放：滚轮（指针锚点）/ 双击 fit↔2×fit ——
  function onWheel(e) {
    e.preventDefault();
    const delta = e.deltaY * (e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 300 : 1);
    const next = wheelScale(st.s, delta);
    const p = center(e);
    st = clampPan(zoomAt(st, next, p.x, p.y), nat.w, nat.h, view().w, view().h);
    apply();
  }

  function onDblClick(e) {
    e.preventDefault();
    const targetScale = st.s <= fitT.s * 1.001 ? clampScale(fitT.s * 2) : fitT.s;
    const p = center(e);
    animTo(clampPan(zoomAt(st, targetScale, p.x, p.y), nat.w, nat.h, view().w, view().h));
  }

  function onStageClick(e) {
    if (dragged) return; // 拖拽/捏合尾随的 click 不当关闭
    if (e.target === stage) close(); // 点图外空白即关（点图上留给缩放语义）
  }

  // —— 键盘：Esc 关闭、+/- 步进缩放、0 复位 fit ——
  function onKeyDown(e) {
    if (e.key === 'Escape') {
      close();
    } else if (e.key === '+' || e.key === '=') {
      zoomStep(1.25);
    } else if (e.key === '-') {
      zoomStep(1 / 1.25);
    } else if (e.key === '0') {
      animTo({ ...fitT });
    }
  }

  function zoomStep(factor) {
    const v = view();
    animTo(clampPan(zoomAt(st, clampScale(st.s * factor), 0, 0), nat.w, nat.h, v.w, v.h));
  }

  function onResize() {
    if (overlay.style.display === 'none') return;
    const v = view();
    fitT = { s: fitScale(nat.w, nat.h, v.w, v.h), tx: 0, ty: 0 };
    st = clampPan(st, nat.w, nat.h, v.w, v.h);
    apply();
  }

  // 正文图接管：tabindex + role 让键盘可达；被 <a> 包裹的图已在过滤时跳过（点击跟链接走）
  for (const el of imgs) {
    el.classList.add('is-zoomable');
    el.tabIndex = 0;
    el.setAttribute('role', 'button');
    el.setAttribute('aria-label', `放大预览：${el.alt || '图片'}`);
    el.addEventListener('click', () => open(el));
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        open(el);
      }
    });
  }
}
