/**
 * M9.5 编辑↔预览滚动联动：锚点插值映射（纯函数，vitest 覆盖）。
 * 源容器 scrollTop → 目标容器 scrollTop：在锚点对（两侧同序块的位置）之间线性
 * 插值，首尾以 (0,0)/(srcMax,dstMax) 伪锚点封边——文档头尾（frontmatter 表单/
 * 页头）没有对应锚点，按整体比例延伸。
 * 锚点单调化：src 重复丢弃、dst 回退/越界钳到合法域，免疫测量噪声
 * （note 锚点在宿主段内部，可能与宿主段锚点同位）。
 * 锚点的 src 固定为编辑侧坐标：预览→编辑方向须先 invertAnchors 交换轴，
 * 否则拿编辑坐标当预览输入断点、把预览坐标写回编辑 scrollTop（单调仍跟滚
 * 但处处错位）。DOM 侧的锚点枚举（.eb ↔ 预览顶层元素，note 块取正文锚
 * 元素）在 editor-engine.js，此处只做数学。
 */
export function mapScroll(scrollTop, srcMax, dstMax, anchors = []) {
  if (!(srcMax > 0) || !(dstMax > 0)) return 0;
  const pts = [[0, 0]];
  let ps = 0;
  let pd = 0;
  for (const a of anchors) {
    const s = a?.src;
    const d = a?.dst;
    if (!Number.isFinite(s) || !Number.isFinite(d)) continue;
    if (s <= ps || s >= srcMax) continue;
    const dc = Math.min(Math.max(d, pd), dstMax);
    pts.push([s, dc]);
    ps = s;
    pd = dc;
  }
  pts.push([srcMax, dstMax]);
  const t = Math.min(Math.max(scrollTop, 0), srcMax);
  let i = 0;
  while (i < pts.length - 2 && t >= pts[i + 1][0]) i++;
  const [s0, d0] = pts[i];
  const [s1, d1] = pts[i + 1];
  return s1 > s0 ? d0 + ((t - s0) / (s1 - s0)) * (d1 - d0) : d0;
}

/**
 * 反向联动轴交换：锚点 src 固定为编辑侧坐标，预览作源时以此交换成
 * 「预览侧 → 编辑侧」，两侧共用同一份测量、互为逆映射。
 */
export function invertAnchors(anchors = []) {
  return anchors.map((a) => ({ src: a?.dst, dst: a?.src }));
}
