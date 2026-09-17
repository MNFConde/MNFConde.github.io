# AGENTS.md

Blog —— 个人博客（Astro 7 + GitHub Pages 用户站 [MNFConde.github.io](https://MNFConde.github.io)，push 即发布）。当前状态：**M2 落地**——M1 工具链与骨架、M1.5 主题令牌（theme.css 唯一外观入口 + 暗色跟系统）、M2 转换层（引用式锚定检索 + 区间分段渲染 span[data-notes]，vitest 14 绿入 CI）全通；按 plan.todo 推进（plan.todo 为唯一规划/里程碑事实源，取代 ROADMAP）。

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

## 提交规范（Conventional Commits，承 mdor）

- 格式 `类型(可选范围): 主题`；类型白名单 feat/fix/docs/style/refactor/perf/test/build/ci/chore/revert；详情规范承自 mdor `.agents/rules/commit.md`
- 主题祈使句/现在时、结尾无句号；主题行 ≤72 显示列（全角按 2 列）；正文解释为什么改，有效行 ≤20 行
- 含中文的提交信息：Git Bash 下 `-m` 可用，提交后 `git log -1 --format=%B` 核验无乱码；PowerShell 5.1 管道喂中文会字节级损坏，须用 UTF-8 文件 `-F`

## 工具链与工作流

- fnm + pnpm（均 scoop 安装，scoop 清单接管 FNM_DIR/PNPM_HOME，勿手工 setx）；版本锚点 = `.nvmrc` + `packageManager` 字段 + lockfile；依赖一律 pnpm，勿 npm install（双 lockfile）
- Node 激活（无 profile 常驻 hook，26-09-16 定案）：PowerShell 会话执行 `.\scripts\activate.ps1` 一次整会话生效；bash 用 `eval "$(fnm env --use-on-cd --shell bash)"`；陈旧终端症状 = `fnm ls` 只剩 system（fnm 静默兜底 %APPDATA%\fnm），重开终端即愈
- pnpm 依赖构建脚本放行：`pnpm-workspace.yaml` 的 `allowBuilds`（esbuild/sharp 已开；package.json 的 allowScripts 字段 pnpm 12 不认）
- Astro 7：markdown remark 插件管线需显式依赖 `@astrojs/markdown-remark`（默认 Sätteri 处理器）；dev 后台模式 `pnpm astro dev --background` / `stop` / `status` / `logs`
- 验收节奏：`pnpm build` + `pnpm preview`（或直接看 Pages 线上）；部署 push main → `.github/workflows/deploy.yml`（permissions 三行 + `--frozen-lockfile` 不可动）
