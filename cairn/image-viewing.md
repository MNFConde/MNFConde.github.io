---
type: 经验杂文
status: active
summary: 正文图显示策略（原始尺寸优先+栏宽护栏）、构建期加工（尺寸回填防 CLS + figure 化）、暗色图底统一卡片化（令牌透明化）、自研点击缩放查看器的全量定案与坑
tags: [图片, CSS, rehype, 可访问性]
contains: [decision, experience, lesson]
created: "2026-09-27"
updated: "2026-09-27"
related: [tech-stack.md, toc.md]
authoring_mode: ai_generated
---
# 图片排版与缩放预览（M8）

## 形成背景

M8 之前全站没有任何 `img` CSS 规则：Markdown 图渲染 `<p><img></p>` 默认 inline 随正文列，不居中、超宽溢出、暗色下透明底深墨图隐形。26-09-27 三轮讨论定案后落地。

## 决策

- **显示策略 = 原始尺寸优先 + 栏宽护栏**：装得下（≤ 栏宽 42rem）的图按 intrinsic 尺寸居中，仅超栏宽图被 `max-width:100%` 钳制（`height:auto` 保纵横比）。明确不做 `width:100%` 铺满式。「绝不缩放」与窄屏可用互斥——护栏是定案取舍，不是疏漏。
- **暗色图底适配 = 统一卡片化，不做反色**：invert 连明度色相一起翻，彩色图配色错乱；「只翻明度保色相」的理想映射仅 SVG 内联挂 CSS 变量可精确，PNG 像素无颜色语义不可挂。落地走**令牌透明化**：`--img-plate/--img-edge/--img-radius` 三令牌亮色全 transparent/0（观感不变）、暗色白衬底+line 边+radius，global.css 结构规则只消费——外观单点入口（theme.css）不破。透明底线稿与白底截图归一为同一张卡片，零逐图 opt-in。
- **查看器恒垫浅衬底**（实证后补）：查看器遮罩恒深（与主题无关），透明底深墨图裸坐其上两态都难读——`.img-view-img` 恒垫 `--img-view-plate: #fff`，承卡片化同理；遮罩 `--scrim-view` 0.8。
- **预览自研**（img-view-engine）：维持全站零运行时依赖（否决 PhotoSwipe——首个运行时依赖且闲置过半；medium-zoom——无自由缩放）。承 toc-engine 先例。
- **懒加载不做**（用户定案）；CLS 尺寸回填与 figure 化入构建期（rehype `src/plugins/images.js`，astro.config 末位）：image-size 2.0.4 原生覆盖栅格+SVG（含 viewBox 回退），原计划的自解析 svgSize 取消；独图段落包 figure、title→figcaption（title 移除防悬浮重复），段内混排/多图不包装。
- **几何**：浮层 fixed 覆盖式 z-80（避开 theme-toggle 70/模态 60/scrim 50）、不动正文 DOM——规避 notes-engine 重排耦合（承 M6 TOC 定案）。

## 经验

- 数学抽 `img-view-math.js`（状态 `{s,tx,ty}` 配 `translate(-50%,-50%) translate(tx,ty) scale(s)`、origin 居中）：zoomAt 锚点公式 `t' = p − (p−t)·(s'/s)`、clampPan 轴级钳 `(渲染长−视口长)/2`（装得下的轴回中）。vitest 14 例，DOM 层浏览器实证（承 notes-layout/toc-engine 双先例）。
- 渐进钳制是特性：连续滚轮缩放中每步 clampPan 会吃掉部分锚点偏移（图尚小于视口时强制回中）——闭式「锚点偏移×倍率」只在单步无钳制时成立，单测按单步验证。
- 键盘可达顺手做：正文图 tabindex+role=button（Enter/Space 开），浮层内 +/=/-/0；关闭还焦原图、打开锁 `documentElement.overflow`。

## 教训

- **合成指针事件下 `setPointerCapture` 抛 NotFoundError**：pointerdown 处理器在 capture 抛错时中断、后续 pointermove 全被 `pointers.has()` 拒收——拖拽整体失联（真实输入不触发，单测/自动化必踩）。修法：try/catch 降级为冒泡路径。教训：**注册表先写、副作用后做**，或副作用必须隔离在 try 里。
- **原生图片拖放（DnD）劫持 pointer 流（M8.1，真机复核抓出）**：`<img>` 默认 draggable，真实鼠标拖动数像素即被浏览器 DnD 接管——pointermove 流从此截断、半透明拖拽幽灵跟随。观感 = 「每次只能拖一点」（dragstart 前那几像素）+「像拖住一个缩略图」（幽灵本体）。修法：接管图 `draggable=false` + stage `dragstart` preventDefault 双保险 + `-webkit-user-drag:none`（Safari 不认属性侧）。**合成 PointerEvent 是不可信事件，不触发原生 DnD**——昨日自动化实证全绿仍带病发布。
- **真实输入与合成输入行为分叉律**（上两条与本条的总纲）：DnD、setPointerCapture、`document.hasFocus()` 系键鼠事件都有「可信事件才走」的浏览器原生路径——**纯合成事件的实证绿 ≠ 真机可用**；手势类交互至少要一轮真机复核才能声明完成（M7 的 IAB 非前台输入不落页是同族）。
- **`Math.min(0, -0) === -0`**：clampPan 输出 `-0` 会使样式串出现 `translate(-0px)` 且 `Object.is` 断言红——钳制结果 `+ 0` 归一。
- 自测也会错：初版「中心锚缩放 t 不动」的断言语义写反（图心不在中心时偏移应×倍率）——引擎对、测试错；修测试而非改引擎前先重推数学。

## 开放问题

- 白笔画透明图（为暗色而生）遇卡片化衬底会隐形——真遇到再单独打类豁免。
- SVG 内联令牌化（彩色示意图精确亮暗映射的完全体）未排期；现阶段彩色图走卡片化衬底已可读。
