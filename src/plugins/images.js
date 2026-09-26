// M8 构建期图片加工（rehype，astro.config 管线末位）：
//   ① 尺寸回填防 CLS——public/ 本地图读实尺寸写 width/height（image-size 覆盖栅格与 SVG，
//     SVG 亦含 viewBox 回退）；远程/相对路径/缺文件跳过并告警，不阻塞构建
//   ② 独图段落 figure 化——p 的元素子节点恰为一个 img 且无文字 → 包 figure；title → figcaption
// 段内混排图/多图段落不包装：护 M2 分段结构与「图片富内容自由直排」写法自由
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { visit } from 'unist-util-visit';
import { imageSize } from 'image-size';

async function defaultResolveDims(src, publicDir) {
  if (!src.startsWith('/')) return null;
  try {
    const { width, height } = imageSize(await readFile(join(publicDir, decodeURIComponent(src))));
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
    return { width: Math.round(width), height: Math.round(height) };
  } catch {
    return null;
  }
}

function wrapFigure(p) {
  const inner = p.children ?? [];
  const imgs = inner.filter((c) => c.type === 'element' && c.tagName === 'img');
  const hasText = inner.some((c) => c.type === 'text' && c.value.trim() !== '');
  const hasOtherEl = inner.some((c) => c.type === 'element' && c.tagName !== 'img');
  if (imgs.length !== 1 || hasText || hasOtherEl) return p;

  const img = imgs[0];
  const figure = { type: 'element', tagName: 'figure', properties: {}, children: [img] };
  const title = img.properties?.title;
  if (typeof title === 'string' && title.trim() !== '') {
    delete img.properties.title; // 图注已呈现，title 悬浮提示不再重复
    figure.children.push({
      type: 'element',
      tagName: 'figcaption',
      properties: {},
      children: [{ type: 'text', value: title }],
    });
  }
  return figure;
}

export function rehypeImages(options = {}) {
  const publicDir = options.publicDir ?? join(process.cwd(), 'public');
  const resolveDims = options.resolveDims ?? ((src) => defaultResolveDims(src, publicDir));

  return async (tree) => {
    const jobs = [];
    visit(tree, 'element', (node) => {
      if (node.tagName !== 'img') return;
      const src = node.properties?.src;
      if (typeof src !== 'string' || node.properties.width) return;
      jobs.push(
        resolveDims(src).then((dims) => {
          if (dims) {
            node.properties.width = dims.width;
            node.properties.height = dims.height;
          } else {
            console.warn(`[rehype-images] 尺寸未回填（远程或缺失）：${src}`);
          }
        }),
      );
    });
    await Promise.all(jobs);

    // figure 化自根整树遍历：blockquote/li 内的独图段落同样成图
    const walk = (node) => {
      for (const child of node.children ?? []) walk(child);
      if (node.children) {
        node.children = node.children.map((c) =>
          c.type === 'element' && c.tagName === 'p' ? wrapFigure(c) : c,
        );
      }
    };
    walk(tree);
  };
}
