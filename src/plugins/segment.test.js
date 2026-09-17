import { describe, expect, it, vi } from 'vitest';
import {
  findQuote,
  flattenBlock,
  rehypeNoteSegment,
  segmentParagraph,
  segmentRanges,
} from './segment.js';

const t = (v) => ({ type: 'text', value: v });
const el = (tagName, children, properties = {}) => ({ type: 'element', tagName, children, properties });

describe('findQuote', () => {
  it('命中唯一', () => expect(findQuote('abcde', 'cd')).toEqual([[2, 4]]));
  it('多匹配全部返回（歧义检测依据）', () => expect(findQuote('abcb', 'b')).toEqual([[1, 2], [3, 4]]));
  it('零匹配', () => expect(findQuote('abc', 'x')).toEqual([]));
  it('空引文', () => expect(findQuote('abc', '')).toEqual([]));
});

describe('segmentRanges', () => {
  it('无区间 → 单段无注', () =>
    expect(segmentRanges(5, [])).toEqual([{ start: 0, end: 5, notes: [] }]));
  it('部分重叠在边界点切分，交叠段双注', () =>
    expect(
      segmentRanges(10, [
        { start: 2, end: 6, id: 'a' },
        { start: 4, end: 8, id: 'b' },
      ]),
    ).toEqual([
      { start: 0, end: 2, notes: [] },
      { start: 2, end: 4, notes: ['a'] },
      { start: 4, end: 6, notes: ['a', 'b'] },
      { start: 6, end: 8, notes: ['b'] },
      { start: 8, end: 10, notes: [] },
    ]));
  it('相同区间双注', () =>
    expect(segmentRanges(4, [
      { start: 0, end: 4, id: 'a' },
      { start: 0, end: 4, id: 'b' },
    ])).toEqual([{ start: 0, end: 4, notes: ['a', 'b'] }]));
  it('乱序输入：notes 排序输出', () =>
    expect(segmentRanges(6, [
      { start: 3, end: 5, id: 'b' },
      { start: 0, end: 4, id: 'a' },
    ]).map((s) => s.notes)).toEqual([['a'], ['a', 'b'], ['b'], []]));
});

describe('flattenBlock', () => {
  it('跨节点拼接 + 空白折叠', () => {
    const p = el('p', [t('你好 '), t('  世界\n！')]);
    expect(flattenBlock(p).text).toBe('你好 世界 ！');
  });
  it('首尾空白被去除', () => {
    const p = el('p', [t('  hi   ')]);
    expect(flattenBlock(p).text).toBe('hi');
  });
});

describe('segmentParagraph', () => {
  it('嵌套交叠 + 行内锚共存：递归切分、id 归首片、文本保真', () => {
    // 规范化文本: "前奏核心差异化排版：收尾"（12 字符）
    //   前奏[0,2) | em[2,7): 核心[2,4) + span#n1[4,7): 差异化 | 排版：收尾[7,12)
    const anchor = el('span', [t('差异化')], { class: ['note-anchor'], id: 'n1' });
    const p = el('p', [t('前奏'), el('em', [t('核心'), anchor]), t('排版：收尾')]);
    // n4 = 奏核心差异化排版 [1,9)，n5 = 核心差异 [3,6)（嵌套于 n4 且横跨 em 内部边界 4）
    const warnMsgs = [];
    const children = segmentParagraph(
      p,
      [
        { start: 1, end: 9, id: 'n4' },
        { start: 3, end: 6, id: 'n5' },
      ],
      { onWarn: (m) => warnMsgs.push(m) },
    );

    const text = children
      .map(function flat(n) {
        return n.type === 'text' ? n.value : n.children.map(flat).join('');
      })
      .join('');
    expect(text).toBe('前奏核心差异化排版：收尾');

    // 结构：t(前) | span[n4](t 奏) | span[n4 n5](em(心, span#n1(差异))) | span[n4](em(化), t 排版) | t(：收尾)
    expect(children[0]).toEqual(t('前'));
    expect(children[1].properties['data-notes']).toBe('n4');
    expect(children[2].properties['data-notes']).toBe('n4 n5');
    expect(children[3].properties['data-notes']).toBe('n4');
    expect(children[4]).toEqual(t('：收尾'));

    // em 被递归切开为两片
    const em1 = children[2].children[0];
    const em2 = children[3].children[0];
    expect(em1.tagName).toBe('em');
    expect(em1.children.map((c) => c.value ?? c.children?.[0].value).join('')).toBe('心差异');
    expect(em1.children[1].properties.id).toBe('n1'); // id 归首片
    expect(em2.children[0].children[0].value).toBe('化');
    expect(em2.children[0].properties.id).toBeUndefined();
    expect(warnMsgs.length).toBe(1);
  });

  it('相邻同注基本段在根层合并为单个包裹，段尾正文原样保留', () => {
    const p = el('p', [t('甲乙丙丁戊')]);
    const children = segmentParagraph(p, [
      { start: 1, end: 3, id: 'a' },
      { start: 3, end: 4, id: 'a' },
    ]);
    expect(children).toEqual([
      t('甲'),
      el('span', [t('乙丙丁')], { 'data-notes': 'a' }),
      t('戊'),
    ]);
  });

  it('无命中区间 → null', () => {
    const p = el('p', [t('正文')]);
    expect(segmentParagraph(p, [])).toBeNull();
  });

  it('切点恰在行内元素边界：元素整体保留不克隆', () => {
    const p = el('p', [t('甲'), el('strong', [t('乙丙')]), t('丁')]);
    const children = segmentParagraph(p, [{ start: 0, end: 3, id: 'a' }]);
    // [0,3) 覆盖 甲乙丙：strong 边界恰为切点，无需内部切分
    expect(children[0].properties['data-notes']).toBe('a');
    expect(children[0].children[1].tagName).toBe('strong');
    expect(children[1]).toEqual(t('丁'));
  });
});

describe('rehypeNoteSegment：预览回填（M4 折叠条数据源）', () => {
  const el = (tagName, properties = {}, children = []) => ({
    type: 'element',
    tagName,
    properties,
    children,
  });
  const t = (value) => ({ type: 'text', value });
  const stubFile = () => ({ fail: (m) => { throw new Error(m); }, message: () => {} });

  it('引用式锚定：data-preview = 引用串，暂存属性摘除', () => {
    const aside = el(
      'aside',
      { class: ['margin-note'], 'data-anchor': 'n1', 'data-quote-anchor': '原文句子' },
      [t('批注内容')]
    );
    const tree = {
      type: 'root',
      children: [el('p', {}, [t('这是原文句子所在段落')]), aside],
    };
    rehypeNoteSegment()(tree, stubFile());
    expect(aside.properties['data-preview']).toBe('原文句子');
    expect(aside.properties['data-quote-anchor']).toBeUndefined();
  });

  it('行内锚配对：data-preview = 锚点词句（空白折叠）', () => {
    const aside = el('aside', { class: ['margin-note'], 'data-anchor': 'n2' }, [t('批注')]);
    const tree = {
      type: 'root',
      children: [
        el('p', {}, [
          t('正文里的'),
          el('span', { class: ['note-anchor'], id: 'n2' }, [t('关键\n 词句')]),
          t('被标注'),
        ]),
        aside,
      ],
    };
    rehypeNoteSegment()(tree, stubFile());
    expect(aside.properties['data-preview']).toBe('关键 词句');
  });
});
