import { describe, expect, it } from 'vitest';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkDirective from 'remark-directive';
import { remarkDirectiveGuard } from './directive-guard.js';
import { remarkNoteMode } from './notes.js';

const run = (plugins, md) => {
  const proc = unified().use(remarkParse).use(remarkDirective);
  for (const p of plugins) proc.use(p);
  const tree = proc.parse(md);
  proc.runSync(tree);
  return tree;
};

// 朴素递归收集（不经 visit 的数组测试形态，行为与环境无关）
const collect = (node, fn, out = []) => {
  fn(node, out);
  for (const c of node.children ?? []) collect(c, fn, out);
  return out;
};

const textOf = (tree) =>
  collect(tree, (n, out) => {
    if (n.type === 'text') out.push(n.value);
  }).join('');

const directiveNodes = (tree) =>
  collect(tree, (n, out) => {
    if (n.type === 'textDirective' || n.type === 'leafDirective' || n.type === 'containerDirective') out.push(n);
  });

describe('remarkDirectiveGuard：未消费指令还原为字面文本', () => {
  it('正文时间/编号写法（9:11、arXiv:1706）不再被吞', () => {
    const tree = run([remarkDirectiveGuard], '约翰福音 9:11）出现，见 [arXiv:1706.03762](https://arxiv.org/abs/1706.03762)。');
    expect(directiveNodes(tree)).toEqual([]);
    expect(textOf(tree)).toContain('9:11）出现');
    expect(textOf(tree)).toContain('arXiv:1706.03762');
  });

  it('语义行内指令 :note-m（已被 remarkNoteMode 置 hName）原样保留', () => {
    const tree = run([remarkNoteMode, remarkDirectiveGuard], '词 :note-m[锚词]{#n1} 尾');
    const nodes = directiveNodes(tree);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].name).toBe('note-m');
    expect(nodes[0].data.hName).toBe('span');
  });

  it('语义块指令 :::essay 保留，误伤 leaf `::x` 还原为 `::x` 文本', () => {
    const tree = run([remarkNoteMode, remarkDirectiveGuard], ':::essay\n\n随笔内容\n:::\n\n后文 ::x[误伤] 收尾');
    const nodes = directiveNodes(tree);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].name).toBe('essay');
    expect(nodes[0].data.hName).toBe('div');
    expect(textOf(tree)).toContain('::x');
    expect(textOf(tree)).toContain('误伤');
  });
});
