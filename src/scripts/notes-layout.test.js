import { describe, expect, it } from 'vitest';
import { layoutNotes } from './notes-layout.js';

const n = (anchorTop, height, extra = {}) => ({ anchorTop, height, ...extra });

describe('layoutNotes：贪心碰撞', () => {
  it('空输入返回空', () => {
    expect(layoutNotes([])).toEqual([]);
  });

  it('单条边注贴锚点、落右栏', () => {
    expect(layoutNotes([n(100, 50)])).toEqual([{ side: 'right', top: 100 }]);
  });

  it('互不重叠时各自贴锚点', () => {
    const plan = layoutNotes([n(0, 50), n(200, 50), n(400, 50)]);
    expect(plan.map((p) => p.top)).toEqual([0, 200, 400]);
    expect(plan.every((p) => p.side === 'right')).toBe(true);
  });

  it('双链都占时，锚点撞上链底的一侧沿链下推 top = max(锚点, 链底 + gap)', () => {
    // n1 → 右(0)；n2 左链空 → 左(10)；n3：右链底 100 → top 116（drift 96），
    // 左链底 110 → top 126（drift 106）→ 右链胜出但被推下
    const plan = layoutNotes([n(0, 100), n(10, 100), n(20, 100)], { gap: 16 });
    expect(plan[0]).toEqual({ side: 'right', top: 0 });
    expect(plan[1]).toEqual({ side: 'left', top: 10 });
    expect(plan[2]).toEqual({ side: 'right', top: 116 });
  });
});

describe('layoutNotes：左右分流', () => {
  it('右链 drift 累积大、左链空 → 分流左栏且贴锚点', () => {
    const plan = layoutNotes([n(0, 200), n(10, 200)], { gap: 16 });
    expect(plan[0]).toMatchObject({ side: 'right', top: 0 });
    expect(plan[1]).toEqual({ side: 'left', top: 10 });
  });

  it('两链都被占用时择 drift 小者（分流后可回右）', () => {
    const plan = layoutNotes([n(0, 50), n(60, 300), n(310, 50)], { gap: 16 });
    // n2：右 66（drift 6）、左 60（drift 0）→ 左
    expect(plan[1]).toEqual({ side: 'left', top: 60 });
    // n3：右链底 50 → top 310（drift 0）；左链底 360 → top 376（drift 66）→ 回右
    expect(plan[2]).toEqual({ side: 'right', top: 310 });
  });

  it('两链 drift 相等时平局选右', () => {
    const plan = layoutNotes([n(0, 100), n(200, 100)], { gap: 16 });
    expect(plan[1]).toEqual({ side: 'right', top: 200 });
  });
});

describe('layoutNotes：漂移回升（viewportTop 传入时）', () => {
  // 密集场景：n1 右(0)；n2 左(10)；n3 右链底 300 → 静态 top 316（drift 296）
  const DENSE = [n(0, 300), n(10, 300), n(20, 300)];

  it('前一条滚出视口上沿后，边注回升贴视口上沿（不超过静态位）', () => {
    // n3 右链底 300 <= vp 305 → top = min(静态 316, max(锚点 20, 305)) = 305
    const plan = layoutNotes(DENSE, { gap: 16, viewportTop: 305 });
    expect(plan[2]).toEqual({ side: 'right', top: 305 });
  });

  it('回升上限不超过静态位（视口上沿仍在静态位之下时取视口上沿）', () => {
    // vp 350 > 静态 top 316 → 停在 316
    const plan = layoutNotes(DENSE, { gap: 16, viewportTop: 350 });
    expect(plan[2].top).toBe(316);
  });

  it('视口上沿越过回升区间后停在静态位，不追踪视口', () => {
    // 边注文档区间被钳在 [锚点, 静态位]，滚过即随文档离场，不做全程 sticky
    const plan = layoutNotes(DENSE, { gap: 16, viewportTop: 400 });
    expect(plan[2]).toEqual({ side: 'right', top: 316 });
  });

  it('drift 在阈值内不回升', () => {
    // n3 静态 116，drift 96 恰在阈值上不触发
    const plan = layoutNotes([n(0, 100), n(10, 100), n(20, 100)], { gap: 16, viewportTop: 500 });
    expect(plan[2]).toEqual({ side: 'right', top: 116 });
  });

  it('链上一条仍可见（bottom > viewportTop）时不回升', () => {
    const plan = layoutNotes(DENSE, { gap: 16, viewportTop: 250 });
    expect(plan[2]).toEqual({ side: 'right', top: 316 });
  });

  it('viewportTop 为 null 即静态布局，不回升', () => {
    const plan = layoutNotes(DENSE, { gap: 16 });
    expect(plan[2]).toEqual({ side: 'right', top: 316 });
  });
});

describe('layoutNotes：hover 冻结', () => {
  it('冻结项用给定 top/side，其 bottom 继续为链占位', () => {
    const plan = layoutNotes(
      [n(0, 100), n(10, 100, { frozenTop: 500, frozenSide: 'right' }), n(20, 100)],
      { gap: 16 }
    );
    expect(plan[1]).toEqual({ side: 'right', top: 500 });
    // n3：右链底 600 → top 616（drift 596）；左链空 → top 20 → 左
    expect(plan[2]).toEqual({ side: 'left', top: 20 });
  });

  it('冻结项未给 frozenSide 时按右栏占位', () => {
    const plan = layoutNotes([n(0, 100, { frozenTop: 50 }), n(10, 100)], { gap: 16 });
    expect(plan[0]).toEqual({ side: 'right', top: 50 });
    // n2：右链底 150 → top 166（drift 156）；左链空 → top 10 → 左
    expect(plan[1]).toEqual({ side: 'left', top: 10 });
  });
});
