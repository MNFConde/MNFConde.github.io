---
type: 经验杂文
status: active
summary: M6 标题导航 TOC：形态定案（窄轨常显 + 断点双分支）、PostLayout 抽取的结构决策、scroll-spy 页尾钳制坑
tags: [toc, scroll-spy, intersection-observer, astro, layout]
contains: [decision, experience, lesson]
created: "2026-09-26"
updated: "2026-09-26"
related: [tech-stack.md]
authoring_mode: ai_generated
---
# 标题导航 TOC（M6）

## 形成背景

用户要求：标题导航任意滚动位置可见、可折叠不挡视线、兼容移动端。形态范本 = VitePress「On this page」。

## 决策

- **不用 tocbot**：自带样式与交互模型，与本站「theme.css 令牌 + 自建状态机」体系相性差；数据源用 Astro 原生 `render(entry).headings`（无需插件提取）。
- **形态 = 承 M3/M4「一个状态机、两个渲染分支」**：状态语义单布尔（`data-open`），断点只改 CSS 形态——桌面 >1100px 左缘竖排窄轨 → fixed 面板；窄屏角标 → 居中模态 + scrim（几何与 z 层直接复用 M4 值：60/50）。TOC 自建引擎，与 notes-engine **零代码共享**（导航展开 ≠ 边注选中召唤，交互语义不同），只共享 scrim 模式与令牌。
- **面板 fixed 覆盖式、不改主栏几何**：notes-engine 只听 scroll/resize/fonts.ready，若 TOC 展开挤压主栏会触发边注排程失效——覆盖式直接规避耦合（M5 时记的「展开改变段落高度须触发重排」坑因此不成立）。
- **渲染门槛 = 有效节标题（h2+）≥ 2**：单节无导航意义；h1 是文题（布局 header 渲染），不进导航。布局层判定（NoteLayout/PostLayout 对称），组件保持纯渲染。
- **PostLayout 抽取**（26-09-26 结构审查定案）：posts 文章结构 + orig 接线原先内联在 `[slug].astro` 的 isNote 三元分支里，违反开闭原则（每加布局级功能必改路由文件）；抽 PostLayout 后 `[slug].astro` 回归纯路由，notes/posts 双布局成为站点件的对称挂载点。审查结论：全仓 ≤500 行无忧（最大 global.css 392）、plugins(构建时)/scripts(运行时)/纯函数分层健康，无需更大重构；观察项 = BaseLayout 站点件挂载点（第三个全局件出现时抽「站点件区」）、global.css M6 后按域拆分。

## 教训

- **scroll-spy 页尾钳制坑**：跳到尾节时若其后内容不足一屏，浏览器把滚动钳短（尾标题停在视口中部、永远进不了顶部观察条带）→ 尾节永不被点亮。修复双管：(1) 尾节标题单独用**全视口** IntersectionObserver 观察（进入视口即亮——最后一节进视口时前节均已读过，语义自洽）；(2) 点击 TOC 链接**立即点亮目标**，不等 spy 纠正。
- **中文 slug 的 hash 比较**：`<a href="#连续边注">` 的 `a.hash` 返回百分号编码（`#%E8%BF%9E…`），而 `getElementById` 要原文——映射须 `decodeURIComponent(a.hash.slice(1))`。
- **IntersectionObserver 同批多命中顺序不定**：回调内直接遍历「后者胜」结果随机；须按文档序排序取最靠后者（后节覆盖前节）。

## 开放问题

- 桌面 1101~1300px 视口：左栏可能被 is-left 边注占用（M3 左右分流），TOC 窄轨（z-25）与左栏边注存在低概率物理重叠——实证未见破坏，写实场景（边注密集的长文）复核观感。
