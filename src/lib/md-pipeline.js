/**
 * M9 共享 markdown 管线（单一事实源）：astro.config 的插件列表与编辑器 dev
 * 中间件（render / 保存前重放）同 import 此处——杜绝编辑器与构建双管线漂移。
 * 注：rehypeImages 依赖 node fs / image-size，本模块仅限 node 侧消费（astro.config、
 * dev 中间件、gate 测试）；浏览器侧编辑页只 import editor-blocks / segment 纯函数。
 */
import remarkDirective from 'remark-directive';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import { remarkNoteMode } from '../plugins/notes.js';
import { remarkOrig } from '../plugins/orig.js';
import { rehypeNoteSegment } from '../plugins/segment.js';
import { rehypeImages } from '../plugins/images.js';

// 与构建完全同序（astro.config 消费同一数组）；strict：失配/歧义/重复 id 即 fail
export const mdRemarkPlugins = [remarkDirective, remarkNoteMode, [remarkOrig, { strict: true }]];
export const mdRehypePlugins = [
  [rehypeNoteSegment, { strict: true }],
  rehypeImages, // M8 末位：尺寸回填防 CLS + 独图段落 figure 化
];

/**
 * remark 层离线重放（content-gate 同款）：strict 失配抛错进 problems，
 * 非致命提醒（file.message）也进 problems。gate 测试与 PUT 保存校验共用。
 */
export function collectRemarkProblems(content, filePath, frontmatter = {}) {
  const problems = [];
  const vfile = {
    path: filePath,
    data: { astro: { frontmatter } },
    fail(msg) {
      throw new Error(`${filePath}: ${msg}`);
    },
    message(msg) {
      problems.push(`${filePath}: ${msg}`);
    },
  };
  const processor = unified()
    .use(remarkParse)
    .use(remarkDirective)
    .use(remarkNoteMode)
    .use(remarkOrig, { strict: true });
  try {
    processor.runSync(processor.parse(content), vfile);
  } catch (error) {
    problems.push(String(error.message ?? error));
  }
  return problems;
}

let processorPromise = null;

/** 构建同源渲染（Astro markdown 处理器 + 同一插件数组）；file.fail 在此抛出。 */
export async function renderMarkdown(content, { frontmatter = {}, fileURL } = {}) {
  processorPromise ??= createMarkdownProcessor({
    remarkPlugins: mdRemarkPlugins,
    rehypePlugins: mdRehypePlugins,
  });
  const processor = await processorPromise;
  const { code } = await processor.render(content, { frontmatter, fileURL });
  return code;
}
