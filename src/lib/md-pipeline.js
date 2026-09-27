/**
 * M9 共享 markdown 管线（单一事实源）：astro.config 的插件列表与编辑器 dev
 * 中间件（render / 保存前重放）同 import 此处——杜绝编辑器与构建双管线漂移。
 * 注：rehypeImages 依赖 node fs / image-size，本模块仅限 node 侧消费（astro.config、
 * dev 中间件、gate 测试）；浏览器侧编辑页只 import editor-blocks / segment 纯函数。
 */
import remarkDirective from 'remark-directive';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { visit } from 'unist-util-visit';
import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import { remarkNoteMode } from '../plugins/notes.js';
import { remarkOrig } from '../plugins/orig.js';
import { remarkDirectiveGuard } from '../plugins/directive-guard.js';
import { remarkSoftBreak } from '../plugins/soft-break.js';
import { rehypeNoteSegment } from '../plugins/segment.js';
import { rehypeImages } from '../plugins/images.js';
import { isRelativeImageRef } from './import-assets.js';

// 与构建完全同序（astro.config 消费同一数组）；strict：失配/歧义/重复 id 即 fail。
// remarkSoftBreak 必须居末：orig 的纯文字校验先于 break 节点注入（见该插件头注）；
// directive-guard 居 orig 后（语义指令已置 hName，漏网的 `9:11`/`arXiv:1706` 类误伤还原文本）
export const mdRemarkPlugins = [
  remarkDirective,
  remarkNoteMode,
  [remarkOrig, { strict: true }],
  remarkDirectiveGuard,
  remarkSoftBreak,
];
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
    .use(remarkOrig, { strict: true })
    .use(remarkDirectiveGuard)
    .use(remarkSoftBreak); // 与 mdRemarkPlugins 同序（拆分/还原不产生 problem，仅为同源一致）
  try {
    processor.runSync(processor.parse(content), vfile);
  } catch (error) {
    problems.push(String(error.message ?? error));
  }
  return problems;
}

/**
 * 相对图片引用检查（26-09-27 事故门禁）：Markdown 里 `images/x.png` 这类相对引用会被
 * Astro content layer 当条目资源静态 import，文件缺失即 ImageNotFound 并**炸掉整个
 * dev/build**（content-assets 虚拟模块被所有读 collection 的路由链式导入）。
 * 因此站点约定：正文图片一律引用 public 下的绝对路径 `/img/...`（走 M8 排版/尺寸管
 * 线）；相对引用一律拒绝。图片搬运由 M9 dev 端点 POST /api/dev/assets 负责。
 */
export function collectImageProblems(content, filePath) {
  const problems = [];
  let tree;
  try {
    tree = unified().use(remarkParse).parse(content);
  } catch (error) {
    return [`${filePath}: 无法解析 Markdown：${error.message}`];
  }
  visit(tree, (node) => {
    let url;
    if (node.type === 'image') url = node.url;
    else if (node.type === 'imageReference') url = node.identifier;
    if (typeof url !== 'string') return;
    let decoded = url;
    try {
      decoded = decodeURI(url);
    } catch {}
    if (!isRelativeImageRef(decoded)) return;
    problems.push(
      `${filePath}: 图片「${decoded}」是相对引用——内容层会把它当条目静态资源 import，` +
        `文件缺失即 ImageNotFound 并导致 dev/build 整体失败；` +
        `请改用站点绝对路径（如 /img/…），或在编辑器里用「导入文件夹」随件搬运`,
    );
  });
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
