import { describe, expect, it } from 'vitest';
import { collectSeries, collectTags, seriesContext, seriesMembers } from './taxonomy.js';

const entry = (id, data) => ({ id, data: { tags: [], ...data } });
const d = (s) => new Date(s);

describe('collectTags：标签反向聚合', () => {
  it('计数倒序，同计数按 collator 排序', () => {
    const out = collectTags([
      entry('a', { tags: ['css', '演示'] }),
      entry('b', { tags: ['演示'] }),
      entry('c', { tags: ['astro'] }),
    ]);
    expect(out).toEqual([
      { tag: '演示', count: 2 },
      { tag: 'astro', count: 1 },
      { tag: 'css', count: 1 },
    ]);
  });

  it('未打标文章不出场，无标签聚合为空', () => {
    expect(collectTags([entry('a', {}), entry('b', { title: 'x' })])).toEqual([]);
  });
});

describe('collectSeries：系列聚合', () => {
  it('计数 + 中文名排序，无系列文章不入场', () => {
    const out = collectSeries([
      entry('a', { series: '教程' }),
      entry('b', { series: '导览' }),
      entry('c', { series: '教程' }),
      entry('d', {}),
    ]);
    expect(out).toEqual([
      { name: '导览', count: 1 },
      { name: '教程', count: 2 },
    ]);
  });
});

describe('seriesMembers：系列成员排序', () => {
  it('seriesOrder 升序，缺序尾置，同位按日期升序兜底', () => {
    const out = seriesMembers(
      [
        entry('c', { series: 'S', seriesOrder: 2, date: d('2026-01-03') }),
        entry('d', { series: 'S', seriesOrder: 2, date: d('2026-01-01') }),
        entry('a', { series: 'S', seriesOrder: 1 }),
        entry('b', { series: 'S' }), // 缺序 → 尾置
        entry('x', { series: '其它' }), // 非本系列
      ],
      'S'
    );
    expect(out.map((e) => e.id)).toEqual(['a', 'd', 'c', 'b']);
  });
});

describe('seriesContext：位置与上下篇', () => {
  const entries = [
    entry('a', { series: 'S', seriesOrder: 1, title: '开篇' }),
    entry('b', { series: 'S', seriesOrder: 2, title: '中篇' }),
    entry('c', { series: 'S', seriesOrder: 3, title: '末篇' }),
  ];

  it('首篇：index 1，prev 为 null，next 指向第二篇', () => {
    expect(seriesContext(entries, 'S', 'a')).toEqual({
      index: 1,
      total: 3,
      prev: null,
      next: { id: 'b', title: '中篇' },
    });
  });

  it('中篇：prev/next 双向', () => {
    expect(seriesContext(entries, 'S', 'b')).toEqual({
      index: 2,
      total: 3,
      prev: { id: 'a', title: '开篇' },
      next: { id: 'c', title: '末篇' },
    });
  });

  it('末篇：next 为 null', () => {
    expect(seriesContext(entries, 'S', 'c').next).toBeNull();
  });

  it('不在该系列内返回 null', () => {
    expect(seriesContext(entries, 'S', 'outsider')).toBeNull();
    expect(seriesContext(entries, '不存在', 'a')).toBeNull();
  });
});
