/**
 * M9.4 remark 软换行插件：段内软换行（源文件无空行的连续行）渲染为 <br>。
 * 关键设计 = 拆分时在 break 前的文本尾部保留一个空格：
 *  - 视觉无差（HTML 折叠行尾空白）；
 *  - rehypeNoteSegment 的段落规范化文本（flattenBlock：空白→单空格、br 元素
 *    不贡献字符）与边注引用串仍互相匹配——若用 remark-breaks 类「无空格」
 *    拆分，跨折行的引用串将因空格消失而永久失配（构建 strict 即失败）。
 * 原生 hard break（行尾 ≥2 空格 / 反斜杠）同样补空格：remark 解析时已剥掉行尾
 * 空白并产出 break 节点，不补则两种换行写法的检索语义分裂（hard 粘连、soft 隔开）。
 * 必须排在 remarkOrig 之后注册：:::orig 的「仅含文本节点」富内容校验会把
 * break 节点视为富内容，先校验后拆分才不误伤折行的原文块。
 */
export function remarkSoftBreak() {
  const splitText = (value) =>
    value.split('\n').flatMap((part, i, parts) => {
      // 非末段的行尾空白折叠为单空格（与 flattenBlock 的规范化语义一致）
      const piece = i < parts.length - 1 ? part.replace(/[ \t]+$/, '') + ' ' : part;
      return i === 0 ? [{ type: 'text', value: piece }] : [{ type: 'break' }, { type: 'text', value: piece }];
    });

  // break 前的文本兄弟若不以空白结尾则补一个空格（hard break 场景；软换行拆分已自带，幂等跳过）
  const padBreaks = (node) => {
    if (!Array.isArray(node.children)) return;
    for (let i = 1; i < node.children.length; i++) {
      if (node.children[i].type === 'break') {
        const prev = node.children[i - 1];
        if (prev.type === 'text' && !/\s$/.test(prev.value)) prev.value += ' ';
      }
    }
    for (const child of node.children) padBreaks(child);
  };

  return (tree) => {
    const walk = (node) => {
      for (const child of node.children ?? []) walk(child);
      if (Array.isArray(node.children)) {
        node.children = node.children.flatMap((child) =>
          child.type === 'text' && child.value.includes('\n') ? splitText(child.value) : child,
        );
      }
    };
    walk(tree);
    padBreaks(tree);
  };
}

