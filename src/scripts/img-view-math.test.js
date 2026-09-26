import { describe, expect, it } from 'vitest';
import {
  SCALE_MAX,
  SCALE_MIN,
  clampPan,
  clampScale,
  fitScale,
  pinchScale,
  wheelScale,
  zoomAt,
} from './img-view-math.js';

describe('clampScale：缩放范围钳制', () => {
  it('越界钳到边界，界内原样', () => {
    expect(clampScale(0.01)).toBe(SCALE_MIN);
    expect(clampScale(99)).toBe(SCALE_MAX);
    expect(clampScale(1.5)).toBe(1.5);
  });
});

describe('fitScale：初始视图', () => {
  it('小图 1x（不放大）', () => {
    expect(fitScale(80, 80, 1200, 800)).toBe(1);
  });
  it('大图等比缩小到入屏（取更紧的轴）', () => {
    expect(fitScale(1600, 360, 1200, 800)).toBeCloseTo(1200 / 1600);
    expect(fitScale(400, 1600, 1200, 800)).toBeCloseTo(800 / 1600);
  });
  it('非法尺寸兜底 1x', () => {
    expect(fitScale(0, 100, 1200, 800)).toBe(1);
    expect(fitScale(100, 100, 0, 0)).toBe(1);
  });
});

describe('zoomAt：指针锚点缩放', () => {
  it('锚点下的图内容保持不动（缩放前后图空间坐标一致）', () => {
    const st = { s: 1, tx: 40, ty: -20 };
    const px = 130;
    const py = 55;
    const next = zoomAt(st, 2, px, py);
    // 图空间坐标 q = (p - t) / s 在前后应相等
    expect((px - next.tx) / next.s).toBeCloseTo((px - st.tx) / st.s);
    expect((py - next.ty) / next.s).toBeCloseTo((py - st.ty) / st.s);
  });
  it('已居中的图以中心为锚纯缩放（t 保持 0）', () => {
    const st = { s: 1, tx: 0, ty: 0 };
    const next = zoomAt(st, 3, 0, 0);
    expect(next).toEqual({ s: 3, tx: 0, ty: 0 });
  });
  it('图心偏离中心时，中心锚缩放按倍率放大偏移（锚点不动、偏移×倍率）', () => {
    const next = zoomAt({ s: 1, tx: 12, ty: -7 }, 3, 0, 0);
    expect(next).toEqual({ s: 3, tx: 36, ty: -21 });
  });
});

describe('clampPan：平移边界', () => {
  it('图小于视口的轴回中', () => {
    const st = { s: 1, tx: 999, ty: -999 };
    expect(clampPan(st, 400, 300, 1200, 800)).toEqual({ s: 1, tx: 0, ty: 0 });
  });
  it('图大于视口钳在边缘内（半差 = (渲染宽-视口宽)/2）', () => {
    const st = { s: 2, tx: 5000, ty: -5000 };
    const out = clampPan(st, 1600, 360, 1200, 800);
    expect(out.tx).toBeCloseTo((1600 * 2 - 1200) / 2);
    expect(out.ty).toBe(0); // 高 720 < 800，纵轴回中
  });
  it('界内平移原样保留', () => {
    const st = { s: 2, tx: -300, ty: 100 };
    expect(clampPan(st, 1600, 800, 1200, 800)).toEqual(st);
  });
});

describe('wheelScale：滚轮缩放', () => {
  it('向上滚放大、向下滚缩小', () => {
    expect(wheelScale(1, -100)).toBeGreaterThan(1);
    expect(wheelScale(1, 100)).toBeLessThan(1);
  });
  it('钳在范围边界', () => {
    expect(wheelScale(SCALE_MAX, -10000)).toBe(SCALE_MAX);
    expect(wheelScale(SCALE_MIN, 10000)).toBe(SCALE_MIN);
  });
});

describe('pinchScale：双指缩放', () => {
  it('按距离比缩放', () => {
    expect(pinchScale(1, 100, 220)).toBeCloseTo(2.2);
    expect(pinchScale(2, 200, 100)).toBeCloseTo(1);
  });
  it('dist0 非法（0/负）保持当前并仅钳制', () => {
    expect(pinchScale(1.5, 0, 500)).toBe(1.5);
    expect(pinchScale(1.5, -3, 500)).toBe(1.5);
  });
});
