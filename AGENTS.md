# AGENTS.md

Blog —— 个人博客（Astro 7 + GitHub Pages 用户站 [MNFConde.github.io](https://MNFConde.github.io)，push 即发布）。当前状态：**M3+M4+M5+M6+M7+M8 落地**——M1 工具链与骨架、M1.5 主题令牌（theme.css 唯一外观入口 + 暗色跟系统）、M2 转换层（引用式锚定 + 区间分段渲染 span[data-notes]）、M3 桌面边注引擎（碰撞分流回升 + click 召唤：桌面 pinned 浮层 / 窄屏居中模态双分支）、M4 聚焦模式（折叠条 + 聚光灯）与站点件（随笔样式 A / 暗色三态切换 / content collections / 首页归档）、M5 原文对照（posts 邻接式 :::orig + 段内插行 + 全局/段级双层开关）、M6 标题导航 TOC（render().headings + 自建 toc-engine：桌面左缘窄轨→fixed 面板 / 窄屏角标→居中模态，scroll-spy 含尾节全视口观察；随行抽 PostLayout，[slug].astro 回归纯路由）、M7 标签与系列（tags/series/seriesOrder 双 collection 可选字段 + 纯 frontmatter 反向聚合、首页双维过滤 chip 排（标签多选 AND、系列单选双向互斥、「全部」chip + 空态提示）→显隐/系列按序正排+第 n/N 角标/?tag= 重复参数深链、文内系列条 + 文末回链「← 全部文章」；跨字段一致性归 content-gate；M7.1 多选标签修正互斥模型）全通，vitest 59 绿入 CI；文章进 src/content/{notes,posts}/（[slug].astro 动态路由分发布局）；遗留 = 站点元信息待用户提供；notes 原文对照不排期（关键坑已记 plan.todo M5）；M8 图片排版与缩放预览（正文图居中+原尺寸护栏、构建期尺寸回填+figure 化、暗色卡片化令牌透明化、自研点击缩放查看器）+ M8.1 拖拽修复（原生 DnD 劫持 pointer 流，本地提交待真机复核后推送）全通，vitest 81 绿入 CI；M9 辅助注解编辑器全通（dev-only 双件：/dev/editor 注入路由 + /api/dev 五端点列/读/写/渲染/图片搬运——块模型单 type 字段互斥快捷键 Alt+1..5、划选建锚 findQuote 即时歧义校验、md-pipeline 共享管线 + 真 notes-engine 实时预览、导入落 notes + PUT 前 gate 重放，生产 build 零新增），vitest 90 绿入 CI；M9.1 预览容器自适应（引擎容器模式 ResizeObserver + 容器查询复刻 M4 窄屏形态，判据从视口换成面板）+ 布局三态切换（并排/上下/预览上）+ 顺修 M4 折叠条 span 桌面未隐藏存量 bug + 追修工具栏 sticky 钉底悬停正中（40vh 余量挂滚动容器垫高 content box 钳位，余量挪 #ed-blocks）+ M9.2 侧栏收展（32px 窄轨仅留切换钮 + Ctrl+B + localStorage 记忆；侧栏宽变化经 flex 推挤预览面板，容器查询自动跟形态）；M9.3 图片导入与内容层相对引用事故修复（导入文件夹随件搬运 → public/img/<slug>/ + 引用改写为 /img/... 绝对路径；content-gate 与编辑器 PUT 双点禁绝相对引用——该引用被 content layer 当条目资源静态 import，缺失即全站 dev/build 500；顺修 readBody 逐片解码致大中文文档静默产出 U+FFFD）全通；M9.4 编辑器体验补丁（localStorage('ed-last-slug') 文档记忆——content 数据仓库重写广播 full-reload 整页刷新，启动自动重开上次文档、滚动回开头；remarkSoftBreak 软换行渲染 <br> 且 break 前保留空格——边注引用跨折行仍匹配，须排 remarkOrig 后、hard break 同补空格；segment isEmpty 收窄仅空文本防零宽 br 被分段吞掉）全通，vitest 132 绿入 CI；M9.5 编辑↔预览滚动联动（锚点插值：scroll-sync.js mapScroll 纯函数 + 回声锁 120ms 防双向回环 + 锚点表三时机重建——预览渲染后/双容器 ResizeObserver/失败退化纯比例；note 块对准正文锚元素不追被碰撞分流的 aside；开关默认开 ed-sync 记忆）全通，vitest 140 绿入 CI；M9.6 编辑器树形导轨 + 帮助浮层（noteRails 锚归属纯函数——行内锚扫 p/essay 按 id 直配、引用式复用 countQuoteHits 唯一命中；CSS border 几何连接线：竖干跨 gap 贯穿/末注止肘/挪离仅缩进——字符树被否：比例字体错位且字形跨不了块高，失配标红 data-miss；速查条「更多」原生 dialog 沉淀控件逻辑与两种边注形态场景）全通，vitest 146 绿入 CI；M9.5 追修（预览→编辑锚点轴交换 invertAnchors——反向原样喂表致轴颠倒、单调跟滚但处处错位；松散列表 N 块↔1 ul 逐 li 配对；remarkDirective 误伤守卫 directive-guard——`:数字`（9:11/arXiv 编号）被当行内指令吞字产空元素断段坏配对，未消费指令还原字面文本；lecture-notes 8 处加粗全角标点侧性修复；渲染门槛 content-render.test.js——renderMarkdown 同源渲染全部内容，零残留定界符/零空元素/零指令字面五断言入 CI）全通，vitest 157 绿入 CI；按 plan.todo 推进（plan.todo 为唯一规划/里程碑事实源，取代 ROADMAP）。

> 本仓库的 cairn 规则**自包含于本文件**，不依赖外部 skill；`cairn/` 是项目知识层，条目类型固定「经验杂文」。

## 阅读顺序

1. 先读本文件。
2. 读 `plan.todo`（里程碑/切片/验收；符号：☐ 待办 / ✔ 完成 / ✘ 取消，优先级 @critical/@high/@low，完成附 @done(yy-mm-dd HH:MM)）。
3. 按需读 `cairn/` 知识专题与 `cairn/LOG.md` 最近条目。

## 文档职责

| 文件 | 职责 | 维护 |
|---|---|---|
| `AGENTS.md`（本文件） | 规则 + 项目状态行 + cairn 规则 | 状态变化时同步状态行 |
| `plan.todo` | 唯一规划/执行事实源（代 ROADMAP） | 完成即勾选 + @done；重大落地附 commit hash |
| `cairn/LOG.md` | 时序日志 | 新条目置顶，≤20 行，只放摘要 + 指针 |
| `cairn/<主题>.md` | 知识专题（当前事实） | 原位更新；复制 `cairn/_template.md` 创建 |
| `cairn/_template.md` | 笔记模板 | 复制用，不直接编辑 |

## cairn 沉淀规则

- frontmatter 见 `_template.md`：`type: 经验杂文` 固定；`contains` 取值 decision / experience / lesson / reference / open_question；`authoring_mode` 取 ai_generated / ai_assisted / human_written
- 实质进展后：LOG 顶部加条目；出现稳定结论/决策/坑：进主题笔记（纠正旧结论原位改 + LOG 指针，不静默覆盖；坑 `contains` 加 lesson）
- 决策直接活在 cairn 主题笔记内（`contains: decision`），不设 decisions.md
- 长结论不进 LOG——LOG 只放摘要与指针；工程资产不进 `cairn/`，只有「关于资产的知识」进
- 完成声明前自检：该写的 LOG / 主题笔记 / plan.todo 勾选都写了吗？检查完再回复完成

## 文档协作规则

- 改动前判断用户要「讨论/建议」还是「直接改」；说「先看看 / 先评估 / 仅讨论」时只给分析，不动文件
- 纠正过往判断时追加更正说明，不静默覆盖
- 未经确认的判断不写成既成事实

## 协作约定

- 与用户交流一律使用中文
- 指令与仓库文档/既有约定冲突时，先指出冲突点、说明取舍，再执行
- 项目状态变化时同步本文件状态行

## 写作约束（原文对照，M5）

- 原文对照仅 posts（notes 不排期）；正文为中文译文，`:::orig` 块紧邻译文块（段/标题/列表/引用）之后承载原文，邻接即配对
- 原文仅承载纯文字（不含图片/链接/代码等富内容）且恰好一个段落；图片等无原文块不成对、自由直排
- 含原文的文 frontmatter 须声明 `original: true`（全局按钮渲染判定）；可选 `originalDefault: hidden | expanded` 定每篇默认态（缺省 hidden）
- 配对失配（文首/前块不可配对/连续 orig/嵌套/富内容/多段落）→ `src/content-gate.test.js` 红（CI 把关）：文档约束管人 + 校验管机器

## 提交规范（Conventional Commits，承 mdor）

- 格式 `类型(可选范围): 主题`；类型白名单 feat/fix/docs/style/refactor/perf/test/build/ci/chore/revert；详情规范承自 mdor `.agents/rules/commit.md`
- 主题祈使句/现在时、结尾无句号；主题行 ≤72 显示列（全角按 2 列）；正文解释为什么改，有效行 ≤20 行
- 含中文的提交信息：Git Bash 下 `-m` 可用，提交后 `git log -1 --format=%B` 核验无乱码；PowerShell 5.1 管道喂中文会字节级损坏，须用 UTF-8 文件 `-F`

## 工具链与工作流

- fnm + pnpm（均 scoop 安装，scoop 清单接管 FNM_DIR/PNPM_HOME，勿手工 setx）；版本锚点 = `.nvmrc` + `packageManager` 字段 + lockfile；依赖一律 pnpm，勿 npm install（双 lockfile）
- Node 激活（无 profile 常驻 hook，26-09-16 定案）：PowerShell 会话执行 `.\scripts\activate.ps1` 一次整会话生效；bash 用 `eval "$(fnm env --use-on-cd --shell bash)"`；陈旧终端症状 = `fnm ls` 只剩 system（fnm 静默兜底 %APPDATA%\fnm），重开终端即愈
- pnpm 依赖构建脚本放行：`pnpm-workspace.yaml` 的 `allowBuilds`（esbuild/sharp 已开；package.json 的 allowScripts 字段 pnpm 12 不认）
- Astro 7：markdown remark 插件管线需显式依赖 `@astrojs/markdown-remark`（默认 Sätteri 处理器）；dev 后台模式 `pnpm astro dev --background` / `stop` / `status` / `logs`
- M9 注解编辑器：dev 起服后访问 `http://localhost:4321/dev/editor`（integration 仅 dev 注入，build 无此路由）；`/api/dev/*` 五端点同源；坑：改编辑器页样式后 Vite 样式模块缓存陈旧，须重启 dev 才见新样式
- 正文图片引用（26-09-27 事故定案）：一律站点绝对路径 `/img/...`，**禁止相对引用**——Astro content layer 会把 `images/x.png` 当条目资源静态 import（写进 `.astro/content-assets.mjs`），文件缺失即抛 ImageNotFound，且该模块被 content 虚拟模块链式导入，**dev/build 所有读 collection 的路由同时 500**（非单图裂开）。图片放 `public/img/<slug>/`；编辑器用「导入文件夹」随件搬运并自动改写引用；gate + PUT 双点拦截（`collectImageProblems`）
- dev 中间件读请求体（26-09-27 事故定案）：`for await (chunk of req) data += chunk` 逐片隐式 toString 会在分片边界切断多字节字符、静默产出 U+FFFD（大中文文档丢字且无报错）；必须收 Buffer 后 `Buffer.concat(...).toString('utf8')`（`src/lib/http-body.js`），上限按字节计
- Astro 7 content layer 坑（26-09-19 实测）：remark/rehype 插件的 `file.fail` 不会使构建失败——glob loader 吞错仅记日志、空正文页照常产出、exit 0，管线内 strict 形同虚设；strict 真正执行点 = `src/content-gate.test.js`（同一套 remark 管线离线重放，deploy.yml 的 pnpm test 先于 build）；M2 的「引用失配构建即失败」同受影响，已由同一门槛接管
- AI bash 工具会话（mvdan/sh）激活 Node：`eval fnm env` 在该 shell 不生效，用 `export PATH="D:\Software\Scoop\apps\fnm\current\node-versions\<ver>\installation;$PATH"`（Windows 路径 + 分号分隔）；版本以 .nvmrc 对应实目录为准
- 验收节奏：`pnpm build` + `pnpm preview`（或直接看 Pages 线上）；部署 push main → `.github/workflows/deploy.yml`（permissions 三行 + `--frozen-lockfile` 不可动）
