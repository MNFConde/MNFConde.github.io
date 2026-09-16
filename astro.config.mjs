// @ts-check
import { defineConfig } from 'astro/config';
import remarkDirective from 'remark-directive';
import { visit } from 'unist-util-visit';

/**
 * 笔记模式指令 → 语义 HTML 的机械映射（M1 float 版）。
 * 行内 `:note-m[词句]{#id}` → span.note-anchor；块 `:::note-m{#id}` → aside.margin-note；
 * 块 `:::essay` → div.essay。引用式锚定与区间分段渲染属 M2。
 */
function remarkNoteMode() {
  return (tree) => {
    visit(tree, (node) => {
      if (node.type !== 'textDirective' && node.type !== 'containerDirective') return;
      const id = node.attributes?.id;
      if (node.name === 'note-m') {
        node.data ??= {};
        if (node.type === 'textDirective') {
          node.data.hName = 'span';
          node.data.hProperties = { class: ['note-anchor'], id };
        } else {
          node.data.hName = 'aside';
          node.data.hProperties = { class: ['margin-note'], 'data-anchor': id };
        }
      } else if (node.name === 'essay' && node.type === 'containerDirective') {
        node.data ??= {};
        node.data.hName = 'div';
        node.data.hProperties = { class: ['essay'] };
      }
    });
  };
}

export default defineConfig({
  site: 'https://MNFConde.github.io',
  markdown: {
    remarkPlugins: [remarkDirective, remarkNoteMode],
  },
});
