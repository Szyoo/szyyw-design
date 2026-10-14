# 交互组件（v0.19.0）待并入的文档

## package.json / sync.sh
新增运行时文件与导出（`exports` 各带 `types`）：

| 导出路径 | 文件 | 类型 |
|---|---|---|
| `./target-cursor` | `target-cursor.js` | `target-cursor.d.ts` |
| `./gradual-blur` | `gradual-blur.js` | `gradual-blur.d.ts` |
| `./branched-menu` | `branched-menu.js` | `branched-menu.d.ts` |
| `./toast`（已有，仅内容升级） | `toast.js` | `toast.d.ts`（新增可选项类型） |

`files` / `sync.sh` 清单加上述 3 对新文件；`components.css` 追加了「interactions」段（toast 新外观 + Branched Menu）。
`reference/` 与 `demo/` 不进 files。

## CHANGELOG
- Toast 升级为 Swipe Toast 外观与交互：下滑关闭、剩余时间引线（悬停 / 按住 / 聚焦 / 标签页隐藏时暂停）、按 tone 的内置 SVG 图标、
  Esc 关闭、堆叠折叠动画；`toast(message, { tone, timeout })` / `clearToasts()` 调用方式与语义不变。
  新增可选项：`title`、`action: { label, onClick }`、`icon`（Node / SVG 标记 / false）、`closeButton`、`pauseOnHover`、`onClose(reason)`。
- 新增 Target Cursor（`mountTargetCursor`）：四角取景框吸附可交互元素，仅 `pointer: fine`。
- 新增 Gradual Blur（`mountGradualBlur` / `enhanceGradualBlur`）：可选的上下（左右）边缘渐进模糊，默认不开到任何页面。
- 新增 Branched Menu（`mountBranchedMenu`）：备用组件，不接入现有界面。

## DESIGN.md 新章节：交互组件
- **出处与许可**：四个组件移植自 React Bits（David Haz，MIT + Commons Clause），文件头逐个注明；
  Branched Menu 内置图标来自 Hugeicons 免费集（MIT，Copyright (c) 2025 Hugeicons）的内联 SVG。
- **Toast**：DOM 结构 `.toast-region > .toast-slot > .toast-gate > .toast`（卡片仍是 `.toast.<tone>`，`toast()` 返回的 `el`）；
  卡片内 `.toast-icon` / `.toast-body`（`.toast-title` / `.toast-text`）/ `.toast-action` / `.toast-close` / `.toast-fuse`；
  色取 `--toast-tone`（ok→`--ok`、warn→`--warn`、err→`--err`、info→`--accent`）；位置仍是底部居中，`--toast-offset` 让位底部导航。
- **Target Cursor 参数**（沿用上游名）：`targetSelector`（缺省 `.cursor-target, a, button, [role=button]`，别名 `selector`）、`cursorColor` /
  `cursorColorOnTarget`（缺省 `var(--accent)` / `var(--accent2)`，吸附时 oklab 混合）、`spinDuration`、`hoverDuration`、`parallaxOn`、
  `hideDefaultCursor`、`size`、`cornerSize`、`thickness`、`padding`、`matchRadius`、`dotSize`、`blendMode`（缺省 `normal`，上游 `difference`）、
  `showLabel`（读目标的 `data-cursor-label`）、`clickEffect`、`container`。返回 `{ update(opts), destroy() }`；destroy 后恢复系统光标并移除全部 DOM / 样式。
- **Gradual Blur 参数**：`position`（`top|bottom|both|left|right`）、`strength`、`height`、`width`、`divCount`、`exponential`、`zIndex`、`animated`、
  `duration`、`easing`、`opacity`、`curve`、`responsive` + `mobile|tablet|desktop` `Height|Width`、`preset`、`hoverIntensity`、`onAnimationComplete`、
  `className`、`style`；新增 `edgeFade`（px，缺省 64：离开边缘多远才完全显现，0 = 常驻）。目标 = 元素（模糊带是它的兄弟节点，贴着可视区边缘）
  或 `window` / `document` / `"page"`（固定在视口边缘）。声明式：`data-gradual-blur="top|bottom|both"` + `data-gradual-blur-<短横线参数名>`，
  由 `enhanceGradualBlur(root?)` 批量挂载。不默认挂到任何页面。
- **Branched Menu**：`mountBranchedMenu(container, { sections: [{ label, icon?, value?, items: [{ label, value, icon? }] }], value?, onSelect?, … })`
  → `{ set, toggle, destroy }`；上游参数全保留（`defaultOpen` / `onToggle` / `color` / `accentColor` / `lineColor` / `width` / `rowHeight` / `indent` /
  `trunk` / `radius` / `lineWidth` / `fontSize` / `drawDuration` / `foldDuration` / `className`）；`icon` 取内置名（`ICONS`：install / rocket /
  settings / paint / pointer / font / layers / bell）、SVG 标记或 Node。

## 合并时可删的旧规则（components.css 中段的旧 toast 块，已被「interactions」段覆盖）
合并后可以直接删除，不影响外观：
- `.toast` 里 `padding` / `max-width: 100%` / `cursor: pointer` / `animation: toast-in` 与 `.toast.leaving { animation: toast-out }`
- `.toast-icon` 的圆形底（`border-radius: 50%` / `background: var(--accent)` / `color: var(--on-accent)` / 22px 尺寸 / 12px 字号）
- `.toast.ok .toast-icon` / `.toast.warn .toast-icon` / `.toast.err .toast-icon` 的 `background`
- `.toast.ok|warn|err|info` 的 `border-color` 旧值（新段按 `--toast-tone` 重写）
- `@keyframes toast-in` / `toast-out`
- 底部「v0.13.0 新组件的减少动效」里的 `.toast, .toast.leaving` 一项（`.menu, .drawer` 保留）
`.toast-region` / `.toast-region:empty` / `.toast-text` 与 `.toast` 的 flex / 背景 / 阴影 / 模糊规则仍在使用，保留。
