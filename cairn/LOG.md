# LOG

> 时序日志，新条目置顶，每条 ≤20 行，只放摘要与指针；长结论沉淀进 cairn/ 主题笔记。

## 2026-09-26

- **M6 标题导航 TOC 全量落地**：render().headings 数据源 + 自建 toc-engine（状态单布尔、断点只改 CSS 形态：桌面左缘竖排窄轨 → fixed 面板 / 窄屏角标 → 居中模态 + scrim 复用 M4 几何）；面板 fixed 覆盖式不改主栏几何（规避 notes-engine 重排耦合）；scroll-spy IntersectionObserver + 尾节全视口观察修复页尾钳制坑；渲染门槛 = 节标题 ≥2。**结构重构随行**：抽 PostLayout.astro，[slug].astro 回归纯路由（审查结论：全仓 ≤500 行无忧、分层健康，观察项 = BaseLayout 站点件区 + global.css 拆分，均 @low 暂不动）。vitest 49 绿 + build 绿 + 宽窄两档浏览器实证（窄轨/面板/模态/跳转/点亮/Escape/尾节）。→ plan.todo M6 / toc.md

## 2026-09-19

- **M5 原文对照落地（切片1 posts 全链路）**：邻接式 `:::orig`（纯文字块级配对）+ 段内插行（display:none 默认，负 margin 吃进段距）+ 双层开关（全局 localStorage 偏好同构暗色三态 + 段尾角标）；orig-demo 5 组对照实证，vitest 49 绿。**重大坑**：content layer 吞 file.fail——「strict 构建失败」自 M2 起即不成立，strict 执行点迁至 `src/content-gate.test.js`（M2 验收已在 plan 原位加更正注）。notes 不排期（用户定案）。→ plan.todo M5 / original-text.md / tech-stack.md
- **M5 原文对照规划定稿（仅规划未执行）**：译文中文正文 + 同文件邻接式 `:::orig` 原文（纯文字、块级一一配对，strict 失配构建失败）；渲染段内插行（默认 display:none，选区隔离天然成立）；交互双层开关——全局 localStorage 偏好（与暗色三态同构）+ 段尾角标；posts 先行、notes 独立切片（需触发 notes-engine 重排）。全量约束与切片 → plan.todo M5；另回填 M0 两格滞后勾选

## 2026-09-17

- **M3 切片3 + M4 全量落地（26-09-18 收官）**：交互触发统一 click——桌面 pinned 浮层（点击召唤，钳在锚点与视口上沿跟随，其余边注冻结）+ 窄屏聚焦模式（等高折叠条 + 居中模态 + 聚光灯，同一状态机双分支）；随笔样式 A（去竖线纸片斜体）；暗色三态切换（BaseLayout 抽壳 + 首帧防闪白）；content collections 双 collection + 首页/归档/动态路由（URL 保持）；vitest 31 绿。遗留 = 站点元信息待用户提供。→ plan.todo M3/M4 / tech-stack.md
- **交互触发定案修正 + M4 细化（26-09-18）**：澄清「桌面端也 click」涵盖全部交互——M3 追加切片3（click 替换 hover + pinned 浮层召唤，联动基建复用），M4 占位展开为三切片（聚焦模式/外观站点件/内容结构）；tech-stack 悬停联动条目已原位更正。→ plan.todo M3 切片3 / M4
- **M3 桌面边注引擎落地**：碰撞排程抽纯函数 layoutNotes（双链贪心 + 左右分流 + 视口钳制回升 + hover 冻结，vitest 15 例）+ notes-engine 接线（断点激活 data-notes-float、批量测量、滚动路径零布局读取）+ 悬停双向点亮（has-focus/is-active 基建，M4 聚焦模式复用）+ hover 复制按钮 + 双击侧栏空白全选（屏外克隆容器绕 Selection 离散限制）；桌面视口浏览器全交互冒烟零报错。→ plan.todo M3 / tech-stack.md
- **M2 转换层落地**：引用式锚定（容器首 blockquote=引用串，规范化检索，strict 失配即构建失败）+ 区间分段渲染（基本段平铺、span[data-notes] 多值、相邻同注合并、行内元素递归切分 id 归首片）+ vitest 14 绿入 CI；演示文新增重叠场景，线上交叠段 data-notes="n4 n5" 实证。坑：首推漏 add astro.config 致 CI 构建无分段，6bbb046 修复。→ plan.todo M2 / tech-stack.md
- **M1.5 主题与选区基座**：皮肤/结构分离定案落地——令牌全量抽进 `src/styles/theme.css`（唯一外观配置文件，含暗色跟系统 + data-theme 手动位、swap 字体占位），边注 `user-select:none` 实现拖选/Ctrl+A 只取正文（含随笔）；M3 交互新增定案（hover 复制 + 程序化全选边注；拖拽级按栏隔离为浏览器原生限制）。定案细节 → plan.todo M1.5 / tech-stack.md

## 2026-09-16

- **M1 全量落地**：工具链收官（scoop 清单接管 FNM_DIR/PNPM_HOME 定案、store 同卷硬链接验收通过）→ Astro 7 骨架（6c26347 → a064e15）→ 笔记模式三栏手感页 float 版（6cbc254，dev/build/preview 三连验证）→ 用户站 Pages Actions 部署全通（6c4eed4，41s 绿，源切 workflow，线上 200）→ 管理约定落地（AGENTS.md 自包含 cairn 规则 + 本库建立）。决策与坑 → [tech-stack.md](tech-stack.md)；执行明细 → plan.todo M1
