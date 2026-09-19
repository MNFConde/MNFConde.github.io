---
title: 原文对照演示
description: M5 原文对照的写作与交互示例：邻接原文块、图片不成对直排、段级角标与全局开关。
date: 2026-09-19
original: true
originalDefault: hidden
---

:::essay
写作方式：正文是中文译文，一个 orig 块紧贴在译文块之后承载英文原文；段尾「原文」角标开合单段，文首按钮批量开合并记住读者偏好。本篇所有原文与译文均为演示自撰。
:::

对照阅读的价值在于随时校验译笔：译文负责流畅，原文负责忠实，两者各司其职。默认状态下原文全部隐藏，页面保持纯中文的阅读节奏；想核对某一句时，点该段末尾的角标即可单独展开这一段的原文。

:::orig
The value of parallel reading lies in checking the translation at any moment: the translation takes care of fluency while the original guards fidelity. By default every original passage stays hidden so the page keeps a pure Chinese reading rhythm; to verify a sentence, tap the marker at the end of its paragraph and that passage alone unfolds.
:::

## 小节标题也能对照

配对单位是块，标题同样可以携带原文。展开后原文紧贴在所属块的下方，以灰字斜体呈现，组内紧凑、组间仍保持正常段距，扫读时一组一组跳即可。

:::orig
Section headings can carry originals too. When expanded, the original sits right beneath its block in soft italic; the pair stays compact while spacing between pairs keeps the normal paragraph rhythm.
:::

![对照演示占位图](/img/orig-demo.svg)

图片没有原文，自成一块、不成对也不参与配对；它上下的对照组互不受影响。

下面这一段是作者自己的话，没有对应的原文，因此不写 orig 块——邻接配对天然容忍无原文的块，这正是选择邻接式而非整体包裹的原因之一。段尾没有角标，就是没有原文的意思。

列表的配对以整组为单位：

- 中文第一项，对应原文里的一行
- 中文第二项，角标挂在这一组的末尾

:::orig
Pairs attach to a whole list: the first item above maps to a line here, and the marker hangs at the end of the group.
:::

最后一段回到正文。试试文首的「对照原文」按钮：全部展开后再单独收起某一段，还能全关；这个偏好会被记住，下一篇文章仍然生效。

:::orig
Back to the body text. Try the global toggle at the top: expand everything, collapse a single passage, then close all. The preference is remembered and carries over to the next article.
:::
