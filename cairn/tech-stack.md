---
type: 经验杂文
status: active
summary: "个人博客技术栈决策归档：Astro 7 + 用户站 GitHub Pages（Actions push 即发布）；笔记模式四层方案的 M1 落地形态与后续排期；工具链 fnm/pnpm via scoop 清单接管"
tags: [Astro, GitHub-Pages, 边注, sidenotes, remark-directive, fnm, pnpm, scoop]
contains: [decision, experience]
created: "2026-09-16"
updated: "2026-09-16"
related: []
authoring_mode: ai_generated
---
# 技术栈与笔记模式决策

## 形成背景

选型讨论定稿于 talk_think/cairn/personal-blog-stack.md（选型论证与坑清单以该文为准，本篇只记「定案」与落地实况）。M1 于 2026-09-16 一次会话内从空目录走到线上。

## 决策

- **框架 Astro（7.x）**：markdown 一等公民 + remark/rehype 管线是笔记模式的决定性能力；Hugo 为退路（试后若「差不多得了」再回）
- **源语法 remark-directive**：行内 `:note-m[词句]{#id}` 锚 + `:::note-m{#id}` 容器 + `:::essay` 随笔；Obsidian callout 落选（Astro 原生认 directive）
- **布局分两步**：M1 float 版（Tufte 负 margin，右侧栏，零 JS，漂移不可控但手感验证够用）→ M3 JS 碰撞定位 + 悬停联动 + 漂移回升
- **部署用户站**：仓库 MNFConde.github.io（根路径，无 base 配置）；Pages via Actions，permissions 三行 + `--frozen-lockfile` + concurrency，push 即发布
- **工具链 fnm + pnpm，安装器 scoop**：scoop 清单 env_set 接管 FNM_DIR/PNPM_HOME（方案 A，放弃手工指定——对抗会在 update 时被再次覆盖）；数据经 persist 落 D 盘，store 与项目同卷硬链接实测有效
- **无 profile 常驻 hook**：按需激活（direnv/nix-devShell 模型）——PowerShell `scripts/activate.ps1` 一次整会话生效；代价 = .nvmrc 失去本地自动消费者（CI 消费不受影响）
- **管理约定**：cairn 规则自包含于根 AGENTS.md（不依赖外部 skill）；条目类型固定经验杂文；plan.todo 代 ROADMAP；决策入 cairn 不设 decisions.md
- **皮肤配置化（26-09-17）**：颜色/字体/三栏尺寸/间距全令牌化进 `src/styles/theme.css`（唯一外观入口，其余样式无裸值）；M3 JS 布局经 getComputedStyle 读同一批令牌
- **选区方案（26-09-17）**：边注 `user-select:none`（拖选/Ctrl+A 只取正文含随笔）；M3 补 hover 复制单条 + 程序化全选边注——拖拽级按栏隔离是浏览器原生限制（选区跟 DOM 序），`user-select: contain` 跨浏览器不可押注
- **字体策略（26-09-17）**：`font-display: swap`（回退即时渲染、加载完自动切换、失败停回退）；方向 = 自托管分片（unicode-range 按需下载、随 Pages 同源分发），字体选型待用户给出
- **亮暗双主题（26-09-17）**：`prefers-color-scheme` 跟系统 + `data-theme` 手动覆盖位；切换按钮 UI 随 M4 站点件
- **引用式锚定形态（26-09-17 M2 定案）**：`:::note-m{#id}` 容器首块 blockquote = 引用串，渲染文本空白折叠后检索定位（零匹配/多匹配 strict 构建失败）；行内 `:note-m[]{#id}` 包裹并存且零检索直定位
- **区间分段算法（26-09-17 M2 定案）**：段落规范化文本按标注边界切基本段平铺（无间隙光标模型——按「标注段+间隙」分发会在跨段断点处丢/重文本，已实证弃用）；标注段 span[data-notes=多值] 包裹、相邻同注合并、相邻文本节点归并；行内元素被切开时递归克隆、id 归首片
- **id 命名空间（26-09-17 M2 定案）**：行内锚 id 与 aside data-anchor 同值是配对非重复；查重分两张表（spanIds / asideIds）

## 经验

- Astro 7 默认 markdown 处理器换为 Sätteri，`markdown.remarkPlugins` 需显式安装 `@astrojs/markdown-remark`（构建时报错信息会给出指引）
- pnpm 12 的构建脚本放行 = `pnpm-workspace.yaml` 的 `allowBuilds` 映射（模板留占位需手动置 true）；package.json 顶层 `allowScripts` 字段 pnpm 12 不认
- `pnpm create astro . --yes` 在非空目录会把模板落进随机名子目录而非当前目录——需手动上移
- 陈旧终端（早于 scoop env_set 的进程）里 fnm 静默兜底 `%APPDATA%\fnm` 空目录，症状 `fnm ls` 只剩 system；重开终端即愈
- Pages 首推会自动建站且默认 legacy 源（Jekyll 分支构建，对无配置仓库必失败产生噪音运行）；`actions/configure-pages` 的 enablement 不会翻转已存在站点，需 `gh api -X PUT repos/<o>/<r>/pages -f build_type=workflow` 切源
- **M2 坑：`git add src/` 漏掉根目录配置**——astro.config.mjs 不在 src/ 下，首推后 CI 构建无分段而本地正常（本地文件是新的），4fcf05e→6bbb046 补交修复；纪律 = 提交前 `git status --short` 全览，根目录配置文件（astro.config / AGENTS.md / plan.todo）显式入 add 清单
- **M2 坑：CI 与本地构建产物不一致的排查路径**——diff 线上与本地产物字节（fold -w120 后 diff），先确认「线上是不是这个提交的构建」再怀疑环境；本次实为漏提交而非环境差异
- 沙箱/代理环境下 curl localhost 须 `--noproxy '*'`，否则 502 假象

## 开放问题

- 无阻塞项；M2（引用式锚定 + 区间分段）、M3（JS 碰撞 + 悬停联动 + 回升）、M4（响应式 + 常规博客件）排期见 plan.todo
