import { describe, expect, it } from 'vitest';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { remarkSoftBreak } from './soft-break.js';

const parse = (md) => {
  const tree = unified().use(remarkParse).parse(md);
  remarkSoftBreak()(tree);
  return tree;
};
const t = (v) => ({ type: 'text', value: v });
const br = { type: 'break' };

describe('remarkSoftBreak', () => {
  it('段内软换行拆为 文本(行尾保留单空格)+break+文本', () => {
    expect(parse('foo\nbar').children[0].children).toEqual([t('foo '), br, t('bar')]);
  });

  it('多行依次拆分', () => {
    expect(parse('a\nb\nc').children[0].children).toEqual([t('a '), br, t('b '), br, t('c')]);
  });

  it('软换行的行尾单个空格折叠为单空格（与 flattenBlock 规范化语义一致）', () => {
    expect(parse('foo \nbar').children[0].children[0]).toEqual(t('foo '));
  });

  it('原生 hard break（行尾 ≥2 空格）前补空格，检索语义与软换行一致', () => {
    // remark 解析时已剥掉行尾空白并产出 break 节点 → 插件负责给前文本补一个空格
    // （原生节点带 position 元数据，只比 type/value）
    const kids = parse('foo  \nbar').children[0].children.map((c) => ({ type: c.type, value: c.value }));
    expect(kids).toEqual([t('foo '), br, t('bar')]);
    // 软换行拆分自带的空格不重复补（幂等）
    expect(parse('foo\nbar').children[0].children[0]).toEqual(t('foo '));
  });

  it('行内元素内部（emphasis 等）的软换行同样拆分', () => {
    expect(parse('*foo\nbar*').children[0].children[0].children).toEqual([t('foo '), br, t('bar')]);
  });

  it('代码块与行内代码不受影响（换行语义归代码）', () => {
    const tree = parse('```\nfoo\nbar\n```\n\n段内 `co\nde` 测试');
    expect(tree.children[0]).toMatchObject({ type: 'code', value: 'foo\nbar' });
    const inline = JSON.stringify(tree.children[1]);
    expect(inline).toContain('co\\nde');
    expect(inline).not.toContain('"break"');
  });
});
