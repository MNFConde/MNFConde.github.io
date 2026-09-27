/**
 * remarkDirective 误伤守卫：未被语义消费的指令节点还原为字面文本。
 *
 * 背景（26-09-28 事故）：remarkDirective 把行内 `:名字` 也按指令解析，且数字可作
 * 名字——正文里的「约翰福音 9:11」、参考文献链接文字「arXiv:1706.03762」被吞成
 * textDirective(name="11"/"1706")，渲染时产空 div：段落被拦腰截断、冒号后数字
 * 丢字、顶层注入空元素（后者还破坏 M9.5 滚动联动的块↔元素锚点配对）。
 *
 * 契约：语义指令（:note-m / :::note-m / :::essay / :::orig）在各自插件里消费时
 * 一律置 node.data.hName；本守卫插在 remarkOrig 之后、remarkSoftBreak 之前，
 * 把没有 data.hName 的漏网指令（text/leaf/container）还原成 `:名`/`::名`/`:::名`
 * 文本节点 + 原子节点平铺。属性 `{...}` 不还原（误伤场景几乎不含，语义指令不受影响）。
 */
export function remarkDirectiveGuard() {
  const prefixOf = { textDirective: ':', leafDirective: '::', containerDirective: ':::' };
  const walk = (node) => {
    if (!Array.isArray(node.children)) return;
    const out = [];
    for (const child of node.children) {
      if (
        prefixOf[child.type] !== undefined &&
        child.data?.hName == null
      ) {
        out.push({ type: 'text', value: prefixOf[child.type] + child.name });
        for (const inner of child.children ?? []) {
          walk(inner); // 深度还原先行（指令 label 内还有嵌套误伤的极端场景）
          out.push(inner);
        }
        continue;
      }
      walk(child);
      out.push(child);
    }
    node.children = out;
  };
  return (tree) => walk(tree);
}
