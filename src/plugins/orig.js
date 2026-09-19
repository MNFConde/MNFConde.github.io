import { visit } from 'unist-util-visit';

const PAIRABLE = new Set(['paragraph', 'heading', 'list', 'blockquote']);

/** 块内全部文本（判空用：图片段等无文字块不可配对） */
function textOf(node) {
  let out = '';
  visit(node, 'text', (t) => {
    out += t.value;
  });
  return out;
}

/**
 * :::orig 邻接配对（M5 原文对照）——纯函数，校验 + 原位转换。
 * 配对规则：orig 容器紧邻译文块（段落/标题/列表/引用，且含文字）之后，邻接即配对；
 * 原文仅承载纯文字（恰好一个段落、只含文本节点）。
 * 失配（文首/前块不可配对/连续 orig/嵌套/富内容/多段落）→ errors 交插件层按 strict 处置。
 * 转换：orig 容器 → div.orig-block（openByDefault 时追加 is-open，默认 display:none）。
 */
export function pairOrigBlocks(root, { openByDefault = false } = {}) {
  const errors = [];
  let origCount = 0;
  visit(root, (node, index, parent) => {
    if (node.type !== 'containerDirective' || node.name !== 'orig') return;
    origCount += 1;
    const at = `第 ${origCount} 个 :::orig`;
    if (!parent || parent.type !== 'root') {
      errors.push(`${at}：仅能用于文档顶层（不可嵌套在随笔/边注等容器内）`);
      return;
    }
    const prev = parent.children[index - 1];
    const next = parent.children[index + 1];
    if (!prev) {
      errors.push(`${at}：位于文首，无紧邻译文块可配对`);
      return;
    }
    if (!PAIRABLE.has(prev.type) || textOf(prev).trim() === '') {
      errors.push(
        `${at}：紧邻前块不可配对（仅含文字的段落/标题/列表/引用；图片等无原文块不成对）`,
      );
      return;
    }
    if (next && next.type === 'containerDirective' && next.name === 'orig') {
      errors.push(`${at}：与下一个 :::orig 相邻（一个译文块至多配一个原文块）`);
      return;
    }
    if (node.children.length !== 1 || node.children[0].type !== 'paragraph') {
      errors.push(`${at}：内容必须是恰好一个段落`);
      return;
    }
    const rich = new Set();
    visit(node.children[0], (n) => {
      if (n.type !== 'paragraph' && n.type !== 'text') rich.add(n.type);
    });
    if (rich.size) {
      errors.push(`${at}：仅承载纯文字，发现富内容（${[...rich].join('/')}）`);
      return;
    }
    node.data ??= {};
    node.data.hName = 'div';
    node.data.hProperties = {
      class: openByDefault ? ['orig-block', 'is-open'] : ['orig-block'],
    };
  });
  return { errors, origCount };
}

/**
 * remark 接线：strict 默认开（失配 file.fail，构建即失败，CI 把关；可降级 warn）；
 * 正文含 orig 但 frontmatter 未声明 original: true → 非致命提醒（全局按钮不会渲染）。
 */
export function remarkOrig(options = {}) {
  const strict = options.strict !== false;
  return (tree, file) => {
    const fm = file.data?.astro?.frontmatter;
    const { errors, origCount } = pairOrigBlocks(tree, {
      openByDefault: fm?.originalDefault === 'expanded',
    });
    for (const message of errors) {
      if (strict) file.fail(message);
      else file.message(message);
    }
    if (origCount > 0 && !fm?.original) {
      file.message('正文含 :::orig 但 frontmatter 未声明 original: true（全局开关按钮不会渲染）');
    }
  };
}
