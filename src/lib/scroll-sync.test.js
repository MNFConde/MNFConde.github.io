import { describe, expect, it } from 'vitest';
import { invertAnchors, mapScroll } from './scroll-sync.js';

describe('mapScroll：锚点插值滚动映射（M9.5）', () => {
  it('无锚点 → 纯比例映射（锚点表不可用时的退化形态）', () => {
    expect(mapScroll(250, 500, 1000)).toBe(500);
    expect(mapScroll(0, 500, 1000)).toBe(0);
    expect(mapScroll(500, 500, 1000)).toBe(1000);
  });

  it('锚点区间内线性插值', () => {
    const anchors = [
      { src: 100, dst: 200 },
      { src: 300, dst: 600 },
    ];
    expect(mapScroll(100, 500, 1000, anchors)).toBe(200);
    expect(mapScroll(200, 500, 1000, anchors)).toBe(400); // 区间中点
    expect(mapScroll(300, 500, 1000, anchors)).toBe(600);
  });

  it('首锚点之前 / 尾锚点之后由伪锚点按比例延伸', () => {
    const anchors = [
      { src: 100, dst: 200 },
      { src: 300, dst: 600 },
    ];
    expect(mapScroll(50, 500, 1000, anchors)).toBe(100); // (0,0)→(100,200) 半程
    expect(mapScroll(400, 500, 1000, anchors)).toBe(800); // (300,600)→(500,1000) 半程
  });

  it('scrollTop 越界钳位', () => {
    expect(mapScroll(-50, 500, 1000)).toBe(0);
    expect(mapScroll(900, 500, 1000)).toBe(1000);
  });

  it('不可滚动侧（srcMax/dstMax ≤ 0）→ 0', () => {
    expect(mapScroll(100, 0, 1000)).toBe(0);
    expect(mapScroll(100, 500, 0)).toBe(0);
  });

  it('测量噪声免疫：src 重复丢弃、dst 回退钳到前值', () => {
    const anchors = [
      { src: 100, dst: 200 },
      { src: 100, dst: 999 }, // src 与前锚点同位 → 丢弃
      { src: 200, dst: 150 }, // dst 回退（note 锚点在宿主段内部）→ 钳到 200
      { src: 300, dst: 500 },
    ];
    expect(mapScroll(150, 500, 1000, anchors)).toBe(200); // (100,200)-(200,200) 平坦段
    expect(mapScroll(250, 500, 1000, anchors)).toBe(350); // (200,200)-(300,500) 半程
  });

  it('dst 越过 dstMax 钳到 dstMax（防御性，正常测量不会出现）', () => {
    const anchors = [{ src: 200, dst: 1200 }];
    expect(mapScroll(200, 500, 1000, anchors)).toBe(1000);
    expect(mapScroll(100, 500, 1000, anchors)).toBe(500); // (0,0)→(200,1000) 半程
  });

  it('非法锚点（NaN/Infinity/缺字段）跳过不参与插值', () => {
    const anchors = [
      { src: Number.NaN, dst: 100 },
      { src: 150, dst: undefined },
      { src: 300, dst: 600 },
      null,
    ];
    expect(mapScroll(300, 500, 1000, anchors)).toBe(600);
    expect(mapScroll(150, 500, 1000, anchors)).toBe(300); // 只剩 (0,0)→(300,600) 半程
  });
});

describe('invertAnchors：反向联动轴交换', () => {
  it('交换 src/dst（预览→编辑方向以预览侧为输入轴）', () => {
    expect(
      invertAnchors([
        { src: 100, dst: 200 },
        { src: 300, dst: 600 },
      ]),
    ).toEqual([
      { src: 200, dst: 100 },
      { src: 600, dst: 300 },
    ]);
  });

  it('与 mapScroll 组合成逆映射：预览位置经反转锚点落回对应编辑位置', () => {
    const anchors = [
      { src: 100, dst: 200 },
      { src: 300, dst: 600 },
    ];
    // 正向：编辑 100→预览 200；反向：预览 200（预览侧滚动上限 1000）→编辑 100（编辑侧上限 500）
    expect(mapScroll(100, 500, 1000, anchors)).toBe(200);
    expect(mapScroll(200, 1000, 500, invertAnchors(anchors))).toBe(100);
    expect(mapScroll(600, 1000, 500, invertAnchors(anchors))).toBe(300);
  });

  it('空表/缺字段锚点安全透传（mapScroll 侧会跳过非法锚点）', () => {
    expect(invertAnchors([])).toEqual([]);
    expect(invertAnchors([{ src: 1 }])).toEqual([{ src: undefined, dst: 1 }]);
  });
});
