import { describe, expect, it } from 'vitest';
import { rehypeImages } from './images.js';

const el = (tagName, properties = {}, children = []) => ({ type: 'element', tagName, properties, children });
const text = (value) => ({ type: 'text', value });
const root = (children) => ({ type: 'root', children });

const dims = {
  '/img/a.svg': { width: 640, height: 180 },
  '/img/b.png': { width: 80, height: 80 },
};
const run = (tree) => rehypeImages({ resolveDims: async (src) => dims[src] ?? null })(tree);

describe('rehypeImages：构建期图片加工', () => {
  it('尺寸回填：本地图写 width/height（防 CLS）', async () => {
    const tree = root([el('p', {}, [el('img', { src: '/img/a.svg' })])]);
    await run(tree);
    expect(tree.children[0].children[0].properties).toMatchObject({
      src: '/img/a.svg',
      width: 640,
      height: 180,
    });
  });

  it('尺寸未知（远程/缺失）：img 原样不动，不阻塞构建', async () => {
    const tree = root([el('p', {}, [el('img', { src: 'https://ext.example/x.png' })])]);
    await run(tree);
    expect(tree.children[0].children[0].properties.width).toBeUndefined();
  });

  it('figure 化：独图段落包 figure，无 title 不出图注', async () => {
    const tree = root([el('p', {}, [el('img', { src: '/img/b.png', alt: 'x' })])]);
    await run(tree);
    const fig = tree.children[0];
    expect(fig.tagName).toBe('figure');
    expect(fig.children).toHaveLength(1);
    expect(fig.children[0].tagName).toBe('img');
  });

  it('title → figcaption，img 不再带 title（防悬浮重复）', async () => {
    const tree = root([el('p', {}, [el('img', { src: '/img/b.png', title: '图注' })])]);
    await run(tree);
    const fig = tree.children[0];
    expect(fig.tagName).toBe('figure');
    expect(fig.children[1].tagName).toBe('figcaption');
    expect(fig.children[1].children[0].value).toBe('图注');
    expect(fig.children[0].properties.title).toBeUndefined();
  });

  it('段内混排文字：保持 p 不包装（护正文写法自由）', async () => {
    const tree = root([el('p', {}, [text('见图：'), el('img', { src: '/img/b.png' })])]);
    await run(tree);
    expect(tree.children[0].tagName).toBe('p');
  });

  it('多图段落：保持 p 不包装', async () => {
    const tree = root([el('p', {}, [el('img', { src: '/img/a.svg' }), el('img', { src: '/img/b.png' })])]);
    await run(tree);
    expect(tree.children[0].tagName).toBe('p');
  });

  it('嵌套容器（blockquote）内的独图段落同样成图', async () => {
    const tree = root([el('blockquote', {}, [el('p', {}, [el('img', { src: '/img/b.png' })])])]);
    await run(tree);
    expect(tree.children[0].children[0].tagName).toBe('figure');
  });

  it('空白 text 节点不阻碍 figure 化（mdast→hast 不产生，防上游变化）', async () => {
    const tree = root([el('p', {}, [text('  \n'), el('img', { src: '/img/b.png' })])]);
    await run(tree);
    expect(tree.children[0].tagName).toBe('figure');
  });
});
