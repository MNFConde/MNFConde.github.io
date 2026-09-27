---
type: 经验杂文
status: active
summary: M9 辅助注解编辑器：dev-only 双件架构、块模型互斥、共享管线渲染端点、findQuote 即时校验的设计定案与实证坑；M9.3 图片随件搬运与内容层相对引用炸站事故；M9.4 文档记忆与软换行渲染
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

- **dev-only 双件**，生产 build 零新增：`src/editor/editor-page.astro` 放 **pages 目录外**，由 `editorDev()` integration 仅 `command==='dev'` 时 `injectRoute('/dev/editor')`——build 不产出路由；API 走 `astro:server:setup` 挂 Vite 中间件 `/api/dev/*`（列表/读/写/渲染/图片搬运五端点），build 无钩子不注册。
- **块模型互斥**：文档 = frontmatter + `blocks[]`，每块单一 `type` 字段（p/h2/h3/essay/note/code/image）——格式切换 = 改 type，「1 套 2」嵌套在数据结构上不存在。行内内容（含行内锚）保留 markdown 源文本，不自研富文本引擎。快捷键 **Alt+数字**（裸数字与正文输入冲突）；同键再按回段落（toggle）。
- **管线单一事实源**：`src/lib/md-pipeline.js` 导出插件数组，astro.config 与渲染端点同 import。渲染端点用 `@astrojs/markdown-remark` 的 `createMarkdownProcessor`（Astro 同款处理器）——**零新依赖**且 `file.fail` 正常抛出（content layer 吞错不影响离线调用）；sharp 尺寸回填只能在 node 跑 = 预览走服务端渲染、否决客户端 unified 的根因。
- **保存即校验**：PUT 前跑 gate 同款 remark 重放（`collectRemarkProblems` 共享）+ 构建同源渲染，失配 400 回显不落盘——承 M2/M5「strict 真正执行点在离线重放」哲学。
- **划选建锚即时校验**：编辑器直接 import `segment.js` 的 `findQuote`（纯函数同构）——选区经 `inlineToText` 剥行内语法对齐构建检索空间，多匹配提示扩大选区；编辑器与构建用同一份匹配代码，所见即所建。
- **真引擎预览**：预览容器复刻 NoteLayout DOM（`.note-layout>.note-main`）+ `initNotesEngine()`——碰撞布局/分流/click 点亮真实生效；引擎补 `dispose()` 返回值（摘 window/document 监听），每次重渲染先卸旧再启新，既有调用方忽略返回值不受影响。
- **往返保真**：`editor-blocks.js` 解析策略 = 未识别行（列表/引用/裸 html）原样并入 p 块文本，notes-demo.md 字节级往返零 diff（vitest 断言）；frontmatter 以 raw 值原序序列化，表单编辑才改写。
- **预览容器自适应（M9.1 定案）**：响应式判据的度量对象必须是**容器**而非视口——引擎增可选参 `{ container, scrollEl }`（ResizeObserver 按面板宽激活，断点 1100 与容器查询配对；scrollY/docY 换源到面板滚动），无参调用保持视口 matchMedia、生产行为零变化；CSS 侧 `container-type: inline-size` + `@container (max-width: 1100px)` 复刻 M4 窄屏块。视口 @media 与容器 @container 结构性不冲突：面板宽 ≤ 视口宽，同窄时规则一致、异宽时只有一套生效。正文列 `--main-width: min(42rem, 100%)` 钳面板宽（固定缩小令牌路线废弃——那只是几何补丁，不构成自适应）。
- **布局三态（M9.1）**：side / stack / stack-rev（`#ed-content` 包裹 + data-layout 换向 + order 反序，localStorage 记忆）；上下模式面板全宽 → 容器查询自动切桌面三栏——布局切换天然联动缩放模式切换。
- **侧栏收展 = 窄轨而非全隐（M9.2）**：收起 32px 仅留切换钮（«/» 随态换向），把手常驻随时点回；宽度动画防折行 = `#ed-side-body` 钉死 `min-width: 220px` + 父级 `overflow-x: hidden` 裁切（内容整体滑出而非重排），收起态 `visibility: hidden` 摘焦点链；Ctrl+B + `localStorage('ed-sidebar')`（承 ed-layout 模式）。侧栏宽变化经 flex 推挤 `#ed-content`，M9.1 容器查询/ResizeObserver 自动跟形态——收展联动响应式是容器自适应路线的免费收益。
- **图片导入 = 随件搬运 + 绝对路径改写（M9.3）**：正文图片一律站点绝对路径 `/img/<slug>/...`，相对引用**由 gate 禁绝**。理由见教训节「相对图片引用炸全站」——不是排版偏好，是 content layer 的劫持机制使然。落位 `public/img/<slug>/`（避跨文档同名冲突）而非平铺；`/img/` 前缀同时保住 M8 的尺寸回填与 figure 化（`plugins/images.js` 只认 `/` 开头）。编辑器「导入文件夹」（`webkitdirectory`）→ `planAssetImport` 配对（相对路径精确优先、basename 唯一时回退：用户常只选图片文件夹本体）→ `POST /api/dev/assets` 落盘 → `rewriteRelativeImages` 改写。**配不上一律中止导入**：放过即重演事故；缺图清单回显 UI，不静默降级。
- **图片搬运端点的安全姿态（M9.3）**：`normalizeAssetPath` 白名单（拒绝对路径/盘符/`..`/非图片扩展名）+ `resolve` 后二次确认落点仍在 `IMG_ROOT` 内——「白名单 + 落点复核」双保险，不依赖单层字符串检查。同名文件幂等三分支：同内容跳过（重复导入同目录不报错）、异内容拒覆盖报错——沿「绝不静默覆盖用户文件」。
- **readBody 必须整体解码（M9.3）**：收集 Buffer 后 `Buffer.concat(...).toString('utf8')`，**禁止** `for await (chunk) data += chunk`。上限改按字节计。细节见教训节。
- **软换行渲染换行但保留匹配空格（M9.4）**：自研 `remarkSoftBreak`（管线末位、remarkOrig 之后）把段内软换行拆为 `文本(尾空格)+break+文本`——`<br>` 前的空格 HTML 折叠视觉无差，却让 `flattenBlock`（空白→单空格、br 零字符）的边注检索空间与引用串保持互match。原生 hard break（remark 已剥行尾空白）同补空格，两种换行写法语义一致。**否决两条路**：remark-breaks 依赖（无空格拆分 = 跨折行引用永久失配）；改 flattenBlock 给 br 合成空格（segment 游标机制建立在每字符↔文本节点映射上，风险大 diff 大）。
- **文档记忆只存 slug（M9.4）**：content 数据仓库重写即广播 `full-reload path:*`（Astro 源码 `vite-plugin-content-virtual-mod.js` 的 `invalidateDataStore`），保存落盘本身触发——`ed-last-slug` 三入口写入（打开/保存/导入）+ 启动时列表内存在才重开；滚动不存：内层容器滚动浏览器不代管，预览重渲染又有钳位瑕疵，回文档开头为定案取舍。

## 经验

- Astro dev 里给静态注入路由写 API 的正解 = integration 双钩子：`astro:config:setup`（injectRoute）+ `astro:server:setup`（`server.middlewares.use(prefix, fn)`）；connect 中间件带前缀使用时 `req.url` 已剥前缀。
- 预览面板装三栏布局：`data-notes-float` 绝对定位的边注轨按令牌算宽（main+gutter+margin），面板窄于该宽即被裁剪——解法 = 在面板容器上局部重定义三个令牌（`--main-width: min(24rem,55%)` 等），结构零改动。
- dev-only 页也要完整 HTML 壳：省略 `<meta charset>` 时静态模板中文按 windows-1252 解码成乱码（JS 注入文本反而不乱——bundled module 字符串走 UTF-16）。

## 教训

- **相对图片引用会炸掉整个 dev/build（26-09-27 事故，最贵的一条）**：Markdown 里 `![a](images/x.png)` 这类**非 `/` 开头、非 URL** 的图片路径，被 `@astrojs/markdown-remark` 的 `remark-collect-images` 记入 `localImagePaths`；glob loader 据此写进 `.astro/content-assets.mjs` 的**静态 import**；解析失败即在 `vite-plugin-content-assets.js` 抛 `ImageNotFound`。致命点在于该模块被 content 虚拟模块**链式导入**——**所有读 collection 的路由（首页/归档/任意文章页）同时 500**，故障面远大于「一张图裂了」；`create-vite.js` 无条件注册该插件，故 dev 与 build 同源同炸。识别特征：dev 日志 `ImageNotFound` + 站点根路径也 500 + `.astro/content-assets.mjs` 里出现相对路径 import。根治三层：① 导入时随件搬运 + 改写为 `/img/...`；② gate 禁绝相对引用（离线重放拦截，CI 与 PUT 双点）；③ `/` 前缀同时是 M8 尺寸回填/figure 化的开关（`plugins/images.js` 只认 `/`），一条约束兼保安危与排版管线。
- **`for await (chunk of req) data += chunk` 会静默损坏多字节字符（M9.3）**：chunk 是 Buffer，`+=` 触发**逐片** `toString('utf8')`；分片边界落在多字节字符中间时，两半各自解码各得一个 `U+FFFD`，字符永久丢失且**无任何报错**——HTTP 分片边界由 TCP/内核决定，与业务代码无关，故表现为「同一文档时而正常时而掉字」。实测 73KB 中文文档往返 2 个 FFFD，原始 socket 强制在字符中间切分升到 5 个，落盘文件残留 2 个（源 0 个）。**修复 = 收集 Buffer 后 `Buffer.concat` 整体解码**（等价于 TextDecoder 的流式语义）。教训泛化：**任何按 chunk 累积文本的代码都要先问「边界能否切在多字节字符中间」**——Buffer→String 的隐式转换是重灾区。诊断手法：拿「源文件 vs 落盘文件」逐字节 diff 找 FFFD 位置，再看该字节偏移是否贴 64KiB 边界。

- **「注释声称的 CSS」要实证**：M4 注释写「宽屏 CSS 隐藏 .note-preview」，实际规则从未存在——桌面边注正文前拼重复引用词存活九个里程碑才被 M9.1 双态实测抓出。可见性断言别只看 DOM 存在，要看 computed display + 双断点实测。
- **零宽行内元素会被「空内容」判定静默丢弃（M9.4）**：segment 分段器的 `pushCoalesced` 原把 `children.length===0` 的元素判为空片段跳过——`<br>` 恰是空 children 的合法输出，带边注段落被切分时换行无声消失。修 = `isEmpty` 收窄为仅空文本（长度>0 的元素与基本段相交必贡献字符，空 children 元素只有零宽元素一类）。泛化：**「空」的判据要区分「无文本」与「无子节点」**，void 型元素（br/img/hr）在文本处理管线上是常态公民。
- **Vite 对注入路由的样式模块缓存陈旧**：改 `.astro` 文件后 HTML 更新但 `<style>` 模块仍旧（watch 触发、不失效）——症状 = HTML 新 CSS 旧；解法 = 重启 dev server。排障抓手：curl 页面 grep 样式本体 + `getComputedStyle` 验证令牌落值。
- **sticky 钉位上限被钳在父级 content box**：尾部滚动余量（`padding-bottom: 40vh`）挂在滚动容器 `#ed-main` 自身时，content box 底缘（即 sticky bottom 的钉位上限）被抬离面板可见底 40vh——工具栏滚到底悬停编辑区正中、贴不到底。余量须挂在钉底元素**之前**的兄弟（`#ed-blocks`），content box 底缘才会延展过其自然流位置。症状识别：sticky bottom 元素滚到底停在中途，与面板底恒差一个 padding 值。
- **Astro dev 的 content 变更触发整页刷新**：编辑器未保存态在内存，PUT 落盘/其它内容文件变化都可能引发刷新丢编辑态——脏态 confirm 只防切换不防刷新；接受为 dev 工具特性（及时 Ctrl+S）。26-09-27 机制钉到源码级：content 数据仓库重写触发 `invalidateDataStore` 广播 `{type:'full-reload', path:'*'}`（Astro `vite-plugin-content-virtual-mod.js`），与当前页面是否读 collection 无关；M9.4 起 `ed-last-slug` 记忆刷新自动重开文档（滚动回开头，未保存改动仍丢）。
- 视觉模型复核抓出两个 DOM 断言看不见的问题（静态乱码 + 边注裁剪）——自动化断言之外截图复核值得保留。

## 开放问题

- posts（:::orig 原文对照）编辑支持——@low 观察项。
- 预览↔编辑锚点联动（点击预览边注定位编辑块）——@low 观察项。
- figure 无 title 时不截图注（源文档未写 title 时 0 figcaption，属预期；若需默认图注需另定策略）——@low。
