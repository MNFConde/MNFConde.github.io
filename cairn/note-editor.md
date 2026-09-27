---
type: 经验杂文
status: active
summary: M9 辅助注解编辑器：dev-only 双件架构、块模型互斥、共享管线渲染端点、findQuote 即时校验的设计定案与实证坑
tags: [编辑器, dev-tools, astro, astro-content]
contains: [decision, experience, lesson]
created: 2026-09-27
updated: 2026-09-27
related: [tech-stack.md]
authoring_mode: ai_generated
---
# M9 辅助注解编辑器（note 模式 UI 注解写作台）

## 形成背景

notes 模式的源语法（`:note-m[词句]{#id}` 行内锚 / `:::note-m` 容器引用锚 / `:::essay` 随笔）手写门槛高——引用串要在脑内规范化、id 要自管、失配只能等构建报错。M9 做 dev-only 辅助编辑器：UI 划选建注、快捷键切格式、实时预览、直访/导入 notes 文档。四项用户拍板：块结构+行内源码（否决全 WYSIWYG）、frontmatter 表单化、图片 MVP 仅路径引用、立项 M9。

## 决策

- **dev-only 双件**，生产 build 零新增：`src/editor/editor-page.astro` 放 **pages 目录外**，由 `editorDev()` integration 仅 `command==='dev'` 时 `injectRoute('/dev/editor')`——build 不产出路由；API 走 `astro:server:setup` 挂 Vite 中间件 `/api/dev/*`（列表/读/写/渲染四端点），build 无钩子不注册。
- **块模型互斥**：文档 = frontmatter + `blocks[]`，每块单一 `type` 字段（p/h2/h3/essay/note/code/image）——格式切换 = 改 type，「1 套 2」嵌套在数据结构上不存在。行内内容（含行内锚）保留 markdown 源文本，不自研富文本引擎。快捷键 **Alt+数字**（裸数字与正文输入冲突）；同键再按回段落（toggle）。
- **管线单一事实源**：`src/lib/md-pipeline.js` 导出插件数组，astro.config 与渲染端点同 import。渲染端点用 `@astrojs/markdown-remark` 的 `createMarkdownProcessor`（Astro 同款处理器）——**零新依赖**且 `file.fail` 正常抛出（content layer 吞错不影响离线调用）；sharp 尺寸回填只能在 node 跑 = 预览走服务端渲染、否决客户端 unified 的根因。
- **保存即校验**：PUT 前跑 gate 同款 remark 重放（`collectRemarkProblems` 共享）+ 构建同源渲染，失配 400 回显不落盘——承 M2/M5「strict 真正执行点在离线重放」哲学。
- **划选建锚即时校验**：编辑器直接 import `segment.js` 的 `findQuote`（纯函数同构）——选区经 `inlineToText` 剥行内语法对齐构建检索空间，多匹配提示扩大选区；编辑器与构建用同一份匹配代码，所见即所建。
- **真引擎预览**：预览容器复刻 NoteLayout DOM（`.note-layout>.note-main`）+ `initNotesEngine()`——碰撞布局/分流/click 点亮真实生效；引擎补 `dispose()` 返回值（摘 window/document 监听），每次重渲染先卸旧再启新，既有调用方忽略返回值不受影响。
- **往返保真**：`editor-blocks.js` 解析策略 = 未识别行（列表/引用/裸 html）原样并入 p 块文本，notes-demo.md 字节级往返零 diff（vitest 断言）；frontmatter 以 raw 值原序序列化，表单编辑才改写。
- **预览容器自适应（M9.1 定案）**：响应式判据的度量对象必须是**容器**而非视口——引擎增可选参 `{ container, scrollEl }`（ResizeObserver 按面板宽激活，断点 1100 与容器查询配对；scrollY/docY 换源到面板滚动），无参调用保持视口 matchMedia、生产行为零变化；CSS 侧 `container-type: inline-size` + `@container (max-width: 1100px)` 复刻 M4 窄屏块。视口 @media 与容器 @container 结构性不冲突：面板宽 ≤ 视口宽，同窄时规则一致、异宽时只有一套生效。正文列 `--main-width: min(42rem, 100%)` 钳面板宽（固定缩小令牌路线废弃——那只是几何补丁，不构成自适应）。
- **布局三态（M9.1）**：side / stack / stack-rev（`#ed-content` 包裹 + data-layout 换向 + order 反序，localStorage 记忆）；上下模式面板全宽 → 容器查询自动切桌面三栏——布局切换天然联动缩放模式切换。

## 经验

- Astro dev 里给静态注入路由写 API 的正解 = integration 双钩子：`astro:config:setup`（injectRoute）+ `astro:server:setup`（`server.middlewares.use(prefix, fn)`）；connect 中间件带前缀使用时 `req.url` 已剥前缀。
- 预览面板装三栏布局：`data-notes-float` 绝对定位的边注轨按令牌算宽（main+gutter+margin），面板窄于该宽即被裁剪——解法 = 在面板容器上局部重定义三个令牌（`--main-width: min(24rem,55%)` 等），结构零改动。
- dev-only 页也要完整 HTML 壳：省略 `<meta charset>` 时静态模板中文按 windows-1252 解码成乱码（JS 注入文本反而不乱——bundled module 字符串走 UTF-16）。

## 教训

- **响应式分支的度量对象**：`matchMedia` 与 `@media` 都测浏览器视口；嵌在面板里的组件要自适应，判据必须是容器（ResizeObserver / @container）。症状识别法：缩放浏览器后面板内控件错位、形态不随面板宽切换。
- **「注释声称的 CSS」要实证**：M4 注释写「宽屏 CSS 隐藏 .note-preview」，实际规则从未存在——桌面边注正文前拼重复引用词存活九个里程碑才被 M9.1 双态实测抓出。可见性断言别只看 DOM 存在，要看 computed display + 双断点实测。
- **Vite 对注入路由的样式模块缓存陈旧**：改 `.astro` 文件后 HTML 更新但 `<style>` 模块仍旧（watch 触发、不失效）——症状 = HTML 新 CSS 旧；解法 = 重启 dev server。排障抓手：curl 页面 grep 样式本体 + `getComputedStyle` 验证令牌落值。
- **sticky 钉位上限被钳在父级 content box**：尾部滚动余量（`padding-bottom: 40vh`）挂在滚动容器 `#ed-main` 自身时，content box 底缘（即 sticky bottom 的钉位上限）被抬离面板可见底 40vh——工具栏滚到底悬停编辑区正中、贴不到底。余量须挂在钉底元素**之前**的兄弟（`#ed-blocks`），content box 底缘才会延展过其自然流位置。症状识别：sticky bottom 元素滚到底停在中途，与面板底恒差一个 padding 值。
- **Astro dev 的 content 变更触发整页刷新**：编辑器未保存态在内存，PUT 落盘/其它内容文件变化都可能引发刷新丢编辑态——脏态 confirm 只防切换不防刷新；接受为 dev 工具特性（及时 Ctrl+S）。
- 视觉模型复核抓出两个 DOM 断言看不见的问题（静态乱码 + 边注裁剪）——自动化断言之外截图复核值得保留。

## 开放问题

- 图片本地上传端点（写文件进仓库并插路径）——@low 观察项。
- posts（:::orig 原文对照）编辑支持——@low 观察项。
- 预览↔编辑锚点联动（点击预览边注定位编辑块）——@low 观察项。
