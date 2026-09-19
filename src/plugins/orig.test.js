import { describe, expect, it } from 'vitest';
import { pairOrigBlocks, remarkOrig } from './orig.js';

const t = (v) => ({ type: 'text', value: v });
const p = (...children) => ({ type: 'paragraph', children });
const orig = (...children) => ({ type: 'containerDirective', name: 'orig', children });
const root = (...children) => ({ type: 'root', children });
const heading = (depth, ...children) => ({ type: 'heading', depth, children });
const quote = (...children) => ({ type: 'blockquote', children });
const list = (...items) => ({
  type: 'list',
  children: items.map((children) => ({ type: 'listItem', children: [p(...children)] })),
});
const img = () => ({ type: 'image', url: 'x.png', alt: '' });
const origP = (v) => orig(p(t(v)));

const classesOf = (node) => node.data?.hProperties?.class ?? [];

describe('pairOrigBlocks', () => {
  it('邻接段落配对成功：orig 转 div.orig-block，默认不含 is-open', () => {
    const tree = root(p(t('中文段')), origP('English paragraph'));
    const { errors, origCount } = pairOrigBlocks(tree);
    expect(errors).toEqual([]);
    expect(origCount).toBe(1);
    expect(tree.children[1].data.hName).toBe('div');
    expect(classesOf(tree.children[1])).toEqual(['orig-block']);
  });

  it('openByDefault：构建期默认展开（is-open）', () => {
    const tree = root(p(t('中文段')), origP('English'));
    const { errors } = pairOrigBlocks(tree, { openByDefault: true });
    expect(errors).toEqual([]);
    expect(classesOf(tree.children[1])).toEqual(['orig-block', 'is-open']);
  });

  it('标题/列表/引用均可作译文块', () => {
    for (const block of [heading(2, t('小节')), list([t('项一')]), quote(p(t('引文')))]) {
      const tree = root(block, origP('Original'));
      expect(pairOrigBlocks(tree).errors).toEqual([]);
    }
  });

  it('文首 orig：无可配对块', () => {
    const { errors } = pairOrigBlocks(root(origP('English'), p(t('中文'))));
    expect(errors[0]).toContain('位于文首');
  });

  it('图片段（无文字）后接 orig：前块不可配对', () => {
    const { errors } = pairOrigBlocks(root(p([img()]), origP('English')));
    expect(errors[0]).toContain('不可配对');
  });

  it('空白段后接 orig：前块不可配对', () => {
    const { errors } = pairOrigBlocks(root(p(t('   ')), origP('English')));
    expect(errors[0]).toContain('不可配对');
  });

  it('连续 orig：一个译文块至多一个原文', () => {
    const tree = root(p(t('中文')), origP('First'), origP('Second'));
    const { errors } = pairOrigBlocks(tree);
    expect(errors.some((e) => e.includes('相邻'))).toBe(true);
  });

  it('嵌套在随笔容器内：仅顶层可配对', () => {
    const essay = { type: 'containerDirective', name: 'essay', children: [p(t('随')), origP('English')] };
    const { errors } = pairOrigBlocks(root(essay));
    expect(errors[0]).toContain('顶层');
  });

  it('orig 富内容（图片/链接/行内码/强调）一律拒绝', () => {
    const richNodes = [img(), { type: 'link', url: 'https://x', children: [t('l')] }, { type: 'inlineCode', value: 'c' }, { type: 'emphasis', children: [t('e')] }];
    for (const rich of richNodes) {
      const { errors } = pairOrigBlocks(root(p(t('中文')), orig(p([t('a '), rich]))));
      expect(errors[0]).toContain('纯文字');
    }
  });

  it('orig 多段落：恰好一个段落', () => {
    const { errors } = pairOrigBlocks(root(p(t('中文')), orig(p(t('One')), p(t('Two')))));
    expect(errors[0]).toContain('恰好一个段落');
  });

  it('空 orig 容器：恰好一个段落', () => {
    const { errors } = pairOrigBlocks(root(p(t('中文')), orig()));
    expect(errors[0]).toContain('恰好一个段落');
  });

  it('无 orig 的普通文档零错误', () => {
    const { errors, origCount } = pairOrigBlocks(root(p(t('中文')), p(t('另一段'))));
    expect(errors).toEqual([]);
    expect(origCount).toBe(0);
  });
});

describe('remarkOrig', () => {
  const makeFile = (fm = {}) => {
    const messages = [];
    return {
      messages,
      file: {
        data: { astro: { frontmatter: fm } },
        fail(msg) {
          throw new Error(msg);
        },
        message(msg) {
          messages.push(msg);
        },
      },
    };
  };

  it('strict 默认开：失配抛错中断构建', () => {
    const { file } = makeFile();
    expect(() => remarkOrig()(root(origP('English')), file)).toThrow(/位于文首/);
  });

  it('strict: false 降级 warn：不抛错、进 messages', () => {
    const { file, messages } = makeFile();
    remarkOrig({ strict: false })(root(origP('English')), file);
    expect(messages.length).toBeGreaterThan(0);
  });

  it('含 orig 未声明 original: true → 非致命提醒', () => {
    const { file, messages } = makeFile();
    remarkOrig()(root(p(t('中文')), origP('English')), file);
    expect(messages.some((m) => m.includes('original: true'))).toBe(true);
  });

  it('声明 original: true → 无提醒', () => {
    const { file, messages } = makeFile({ original: true });
    remarkOrig()(root(p(t('中文')), origP('English')), file);
    expect(messages).toEqual([]);
  });

  it('originalDefault: expanded → is-open 构建期展开', () => {
    const { file } = makeFile({ original: true, originalDefault: 'expanded' });
    const tree = root(p(t('中文')), origP('English'));
    remarkOrig()(tree, file);
    expect(classesOf(tree.children[1])).toEqual(['orig-block', 'is-open']);
  });
});
