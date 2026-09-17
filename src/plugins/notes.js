import remarkDirective from 'remark-directive';
import { visit } from 'unist-util-visit';

/** 收集节点内全部文本（用于提取引用串） */
function textOf(node) {
  let out = '';
  visit(node, 'text', (t) => {
    out += t.value;
  });
  return out;
}

/**
 * 笔记模式指令 → 语义 HTML 的机械映射。
 * 行内 `:note-m[词句]{#id}` → span.note-anchor（直定位，零检索）；
 * 块 `:::note-m{#id}` → aside.margin-note[data-anchor]；容器首个 blockquote = 引用串，
 * 暂存为 data-quote-anchor，由 rehype 段（segment.js）检索正文后摘除并挂 data-anchor。
 * 块 `:::essay` → div.essay。
 */
export function remarkNoteMode() {
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
          const props = { class: ['margin-note'], 'data-anchor': id };
          const first = node.children?.[0];
          if (first && first.type === 'blockquote') {
            const quote = textOf(first).replace(/\s+/g, ' ').trim();
            if (quote) {
              node.children = node.children.slice(1);
              props['data-quote-anchor'] = quote;
            }
          }
          node.data.hName = 'aside';
          node.data.hProperties = props;
        }
      } else if (node.name === 'essay' && node.type === 'containerDirective') {
        node.data ??= {};
        node.data.hName = 'div';
        node.data.hProperties = { class: ['essay'] };
      }
    });
  };
}
