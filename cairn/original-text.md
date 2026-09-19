---
type: 经验杂文
status: active
summary: "M5 原文对照全量决策：posts 邻接式 :::orig（纯文字块级配对）+ 段内插行 + 全局/段级双层开关（localStorage 同构暗色三态）；strict 执行点因 content layer 吞 file.fail 迁至 vitest 内容门槛"
tags: [原文对照, translation, remark-directive, Astro, vitest]
contains: [decision, lesson]
created: "2026-09-19"
updated: "2026-09-19"
related: [tech-stack.md]
authoring_mode: ai_assisted
---
# 原文对照（M5）

## 决策

- **数据建模 = 同文件邻接式配对**：`:::orig` 容器块紧邻译文块（段/标题/列表/引用，且含文字）之后，邻接即配对；不做 `:::pair` 大包裹（写作噪音减半，代价 = 配对靠位置，由 strict 校验兜底）。配对单位是块级一一对应；图片等无原文块不成对、自由直排——显式邻接配对天然容忍无原文块，这是优于独立文件位置对齐的意外之得。
- **原文仅承载纯文字**：恰好一个段落、只含文本节点（图片/链接/行内码/强调一律拒绝）；双保险 = 本文件与 AGENTS.md 写作约束（管人）+ 校验（管机器）。
- **渲染 = 段内插行**：原文展开于所属译文块正下方，灰字斜体略小字号；负 margin 上提吃进译文段下边距（组内紧凑、组间保持正常段距）。落选双栏：posts 单栏版式起双列 grid 与居中列打架、窄屏必塌、逐对等高是额外工程量。
- **默认隐藏 = display:none**：选区/Ctrl+A 天然不带走原文（承 M1.5「只取正文」），无 JS 降级时原文不出场。
- **交互 = 双层开关**：全局按钮（批量设置 + 默认值，再点重置）+ 段尾专用角标（单段 toggle）；角标是独立元素不占用正文 click——规避与 M3/M4 笔记模式 click 状态机冲突；Esc 语义不涉原文。角标挂点对列表/引用落到最后一个子块（button 不落在 ul/blockquote 直接子级）。
- **状态优先级 = localStorage 读者偏好 > frontmatter 每篇默认 > 收起**：偏好与暗色三态同构（碰过全局开关即接管全站、跨页延续，key `orig` = on/off），含首帧内联恢复防展开跳动；段级开合仅会话内生效。`original: true` 布尔位兼作全局按钮渲染判定（无原文页面不出按钮）。
- **范围 = posts 专属，notes 不排期**（26-09-19 用户定案）：将来启动时的关键坑——展开改变段落高度须触发 notes-engine 重排（现只听 scroll/resize/fonts.ready）；插行与边注栏共存需视觉验收。

## 教训

- **content layer 吞 file.fail（26-09-19 实测）**：Astro 7 下 remark/rehype 插件内 `file.fail()` 只被 glob loader 记日志，坏内容产出空正文页且 build exit 0——「失配即构建失败」在管线内不成立（M2 的引用失配 strict 同受影响，属存量缺口首测暴露）。教训：凡「失配即失败」类约束，验收必须实测负例走完整构建，不能只信插件机制。
- **修复形态**：strict 执行点迁至 `src/content-gate.test.js`——gray-matter + remark-parse + 同一套 remark 插件离线重放全部内容文件，失配/提醒即测试红；deploy.yml 的 `pnpm test` 先于 build，CI 把关不变，零新增接线。
- 附带小坑：mvdan/sh 的 printf 实现把 `--` 当格式打印（写临时 md 破坏 frontmatter，故障形态变成 schema 报错）；该 shell 激活 Node 须 Windows 路径 + 分号分隔手工 export（`eval fnm env` 不生效）。

## 开放问题

- 点击交互（角标/全局开关/跨页偏好）待用户浏览器复核（产物与管线已实证）。
- notes 支持若启动，先过 plan.todo M5 范围行记录的两个坑。
