// M8 缩放预览纯数学（承 notes-layout 先例：引擎 DOM 层之外的可测核心）
// 状态模型 { s, tx, ty }：s = intrinsic 像素倍率；tx/ty = 图中心相对视口中心的偏移(px)
// 配合 CSS transform: translate(-50%,-50%) translate(tx,ty) scale(s)（origin 居中）
export const SCALE_MIN = 0.2;
export const SCALE_MAX = 8;

export function clampScale(scale, min = SCALE_MIN, max = SCALE_MAX) {
  return Math.min(max, Math.max(min, scale));
}

// 初始视图 fit-to-viewport：图完整入屏且不放大（小图 1x，大图等比缩小）
export function fitScale(natW, natH, viewW, viewH) {
  if (!natW || !natH || !viewW || !viewH) return 1;
  return Math.min(1, viewW / natW, viewH / natH);
}

// 以 (px, py)（相对视口中心）为锚缩放：锚点下的图内容在缩放前后保持不动
export function zoomAt({ s, tx, ty }, nextScale, px, py) {
  const ratio = nextScale / s;
  return { s: nextScale, tx: px - (px - tx) * ratio, ty: py - (py - ty) * ratio };
}

// 平移边界：图小于视口的轴回中（0），大于则钳在边缘内（不丢图）
export function clampPan({ s, tx, ty }, natW, natH, viewW, viewH) {
  const limit = (nat, view) => {
    const rendered = nat * s;
    return rendered <= view ? 0 : (rendered - view) / 2;
  };
  const mx = limit(natW, viewW);
  const my = limit(natH, viewH);
  // + 0 归一 -0：Math.min(0, -0) 产 -0，避免样式串出现 -0px 且利于严格相等断言
  return { s, tx: Math.min(mx, Math.max(-mx, tx)) + 0, ty: Math.min(my, Math.max(-my, ty)) + 0 };
}

// 滚轮：向上（deltaY<0）放大；指数因子使快慢滚轮手感一致（deltaY 归一化归引擎）
export function wheelScale(current, deltaY) {
  return clampScale(current * Math.exp(-deltaY * 0.0016));
}

// 双指：两点距离比缩放（dist0 为上一帧距离）
export function pinchScale(current, dist0, dist1) {
  if (!(dist0 > 0) || !Number.isFinite(dist1)) return clampScale(current);
  return clampScale(current * (dist1 / dist0));
}
