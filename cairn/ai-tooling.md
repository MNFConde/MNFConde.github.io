---
type: 经验杂文
status: active
summary: "AI 协作工具链坑：Windows 下 job_kill 杀后台服务器 shell 会挂死（孤儿进程持句柄），连坐同批并行调用；kill 失败不等于进程已死；Crush 重启后注入合成工具结果可无损恢复"
tags: [Crush, Windows, job-kill, 后台进程, AI-协作]
contains: [lesson]
created: "2026-09-19"
updated: "2026-09-19"
related: [tech-stack.md]
authoring_mode: ai_assisted
---
# AI 协作工具链坑

## 形成背景

26-09-19 会话收尾时用 job_kill 终结后台 preview 服务器（`pnpm preview`，后台 shell），工具调用永不返回，同批并行的 bash 一并冻结，会话卡在 waiting for tool response；用户重启 Crush 后经合成结果注入恢复，复盘定案沉淀本篇（仅 A/B 候选中的 B，A——crush-tether 权限体系——经拍板不沉淀）。

## 教训

- **Windows 下杀「shim → 服务器」进程树不可靠**：kill 父进程后 node 孤儿仍持有管道句柄，kill 实现若同步等待句柄释放即永不返回 → 工具调用挂死 → 整个回合冻结；与其它调用并行发批会连坐整批——**job_kill 永远单独发**，不与任何调用同批
- **kill 失败/挂起 ≠ 进程已死**：孤儿进程继续占端口监听（实证：会话重启后 job_kill 立即返回 shell not found，但 4322 端口 preview 仍可访问）；服务器类后台进程终结不可靠时，宁留给用户手动清理（任务管理器找 node.exe / astro preview）
- **Crush 的恢复机制可用**：重启后为孤儿工具调用注入合成结果，会话无损续上；同一对孤儿调用会随后续新轮次反复注入，属预期行为不是新故障

## 开放问题

- 后台服务器类 shell 的可靠终结路径（预期挂起、端口探活后手动清理等）未验证更优解
