/**
 * 边注布局纯函数（M3 碰撞定位核心）——无 DOM 依赖，vitest 直测。
 *
 * 模型：
 *  - 输入为文档序（源码顺序）的边注序列，每条含锚点位 anchorTop 与自身高度 height
 *  - 双链贪心：右栏优先落位（top = max(锚点, 该链上一条 bottom + gap)），
 *    左链同锚点的 drift（top − 锚点）更小时分流左栏；平局选右
 *  - 漂移回升：滚动修正——某条 drift 超过阈值且其链上一条已完全滚出视口上沿时，
 *    回升到 max(锚点, 视口上沿)。视口外的前注不再占位；视口内仍严格不重叠
 *  - frozenTop：hover 冻结项直接使用调用方给定的 top 与 frozenSide，不参与计算，
 *    但其 bottom 继续占位（防止 hover 中重排导致指针脱离目标）
 */

/**
 * @param {Array<{anchorTop: number, height: number, frozenTop?: number, frozenSide?: 'left'|'right'}>} notes
 * @param {{gap?: number, viewportTop?: number|null, driftThreshold?: number}} opts
 *   viewportTop：视口上沿的文档坐标；null 表示静态布局（不回升）
 * @returns {Array<{side: 'left'|'right', top: number}>}
 */
export function layoutNotes(notes, { gap = 16, viewportTop = null, driftThreshold = 96 } = {}) {
  const chainBottom = { left: -Infinity, right: -Infinity };
  return notes.map((note) => {
    if (note.frozenTop != null) {
      const side = note.frozenSide ?? 'right';
      chainBottom[side] = note.frozenTop + note.height;
      return { side, top: note.frozenTop };
    }

    const a = note.anchorTop;
    const rightTop = Math.max(a, chainBottom.right + gap);
    const leftTop = Math.max(a, chainBottom.left + gap);
    const side = leftTop - a < rightTop - a ? 'left' : 'right';

    const staticTop = side === 'left' ? leftTop : rightTop;
    let top = staticTop;
    if (
      viewportTop != null &&
      staticTop - a > driftThreshold &&
      chainBottom[side] <= viewportTop
    ) {
      // 回升只能向上拉（不超过静态位），下限取锚点与视口上沿的较高者
      top = Math.min(staticTop, Math.max(a, viewportTop));
    }

    chainBottom[side] = top + note.height;
    return { side, top };
  });
}
