---
type: 经验杂文
status: active
summary: 标签与系列（M7）的数据建模与过滤形态定案：纯 frontmatter 反向聚合、首页显隐过滤、系列即特殊过滤维度
tags: [blog, taxonomy, filter]
contains: [decision, experience, lesson]
created: "2026-09-26"
updated: "2026-09-26"
related: [tech-stack.md, original-text.md]
authoring_mode: ai_generated
---
# 标签与系列（M7）

## 形成背景

用户要 tag（检索）与系列（承载教程类连载）；四轮讨论定案形态。核心权衡 = 开闭原则口径：内容型站点的「开放」落在**数据轴**（加标签/开系列零代码），不预建通用分类抽象（三篇文章的个人站预支抽象不合身，且系列需要序、标签不需要，统一框架两边都不合用）。

## 决策

- **数据建模**：不设标签/系列注册表，纯从文章 frontmatter 反向聚合（`src/lib/taxonomy.js` 纯函数）。推论：空标签天然不存在，无需显式处理。字段 `tags[]` / `series` / `seriesOrder` 双 collection（notes/posts）通用、全可选——存量文章零改动。
- **不设静态路由**：/tags/、/series/ 不做，首页 chip 排即索引（用户定案「系列 = 特殊的标签维度」，一个过滤器两维复用）。中文标签/系列名原字符串编码进 `?tag=`/`?series=`（地址栏解码显示中文，URLSearchParams 自动解码）。
- **过滤 = 显隐模型**：全集常驻 DOM 是前提 → 构建期分页与显隐过滤互斥。量级路径定案：全量单列 → load-more（DOM 仍全集）→ 真需构建期分页时过滤退静态路由（聚合函数复用，可逆）。
- **系列视图按 `data-order` 重排**（insertBefore 级纯客户端）+「第 n/N 篇」角标；序的核心体验在**文内**系列条（[slug] 构建期算好经 props 传布局，承 M6「布局只渲染不知聚合」分工）。
- **约束落点**：schema 管字段类型（含 tags trim/去重 transform）；跨字段一致性归 content-gate（order 须配 series、同系列序号唯一、slug 避开 tags/series/archive 保留前缀防路由遮蔽）——承 M5「schema 管字段、gate 管跨字段」。

## 教训

- **角标序号必须跟显示序（排序后数组），不能跟筛选序（构建序数组）**：首版 filter-engine 按构建序 visible 分配「第 n/N」，系列重排后角标整体倒挂（关于 显示 第 3/3）——浏览器实证抓出，DOM 断言式自测（hidden/badge 逐项读出）对这类「排序 + 标注」交互有效。
- 1280px 视口恰好压三栏几何边界（note-layout 内容 80rem + padding），左栏边注轻微截断——M1 起既有现象，与 M7 无关，仅记录。
- IAB（ZCode 内嵌浏览器）面板非前台时 playwright/cua 真实输入事件落不进页面且表现为 click 超时；`elementFromPoint` 诊断无遮挡、DOM `click()` 全链路正常即页面无恙——是环境限制不是页面 bug，实证时先排除再怀疑代码。

## 开放问题

- 文章页 header 的 tag chips 深链（/?tag= 回首页筛选）与标签/系列静态路由版：观察项，触发即办（见 plan.todo M7 观察项）。
