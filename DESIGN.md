# szyyw.xyz 设计语言

适用范围：portal（szyyw.xyz）、jppost-tracker、finance-ledger 及后续所有个人项目。
本仓库是唯一权威来源——改设计先改这里，再升 tag，各项目升级依赖。

## 1. 气质

深空。安静的底色上浮着毛玻璃层，青紫渐变只做点缀不做主角。
信息密度可以高，但视觉噪音必须低：细边框、低饱和、克制的动效。
所有动效使用同一条缓动曲线 `--ease: cubic-bezier(0.22, 1, 0.36, 1)`——快出慢停，有弹性但不弹跳。

## 2. 三层：主题 → 配色 → 明暗

- **主题（theme）**：`html[data-theme]`。主题是**一整套**——背景效果、动效曲线、
  光效（光晕/光斑）、配色族，不只是颜色。目前唯一主题 `nebula`（深空）：
  DotField 点阵背景 + 毛玻璃层级 + 光晕跟随 + .spot 光斑。
  新主题 = 新 token 块 +（按需）新的背景/光效模块；效果类参数尽量做成
  token 旋钮（如 `--df-sparkle` / `--df-wave`），让主题只用 CSS 就能重配行为。
- **配色（palette）**：`html[data-palette]`，主题的附属色彩变体，只覆盖 hue
  相关 token（accent/bg/tint/df-*）。nebula 缺省青紫；附属配色 `aurora`（极光翠青）。
- **明暗（scheme）**：`html[data-scheme]`，`dark`（缺省）/ `light` / `auto`（跟随系统）。
  实现：token 全部用 `light-dark()` 双值书写，scheme 只切换根节点的 `color-scheme`。
  auto = `color-scheme: light dark`，由系统决定取哪套，无需 JS 参与。

规则：**组件层禁止硬编码颜色**。透明度派生用 `color-mix(in srgb, var(--x) N%, transparent)`，
新颜色一律先进 tokens.css。渐变到透明必须用「同色 + 0 透明度」，
`transparent` 关键字是透明黑，插值中段会发灰。

## 3. 层级模型

```
z-index 0   .bg-layer   点阵背景（fixed，独立合成层）
z-index 1   .app-frame  内容层
z-index 30  侧栏 / 顶栏（sticky/fixed + backdrop-blur）
z-index 40  底部导航
z-index 50  .overlay    弹层遮罩（Portal 挂 body，避开 transform 包含块陷阱）
```

玻璃三级：`--glass-bg`（卡片）→ `--inner-bg`（卡内嵌套）→ `--field-bg`（输入件）。
弹层用更实的 `--sheet-bg`（92% 不透明），保证叠在任何内容上都可读。

## 4. DotField 点阵背景

参数缺省值（两个项目实测的平衡点）：

| 参数 | 值 | 说明 |
|---|---|---|
| dotRadius / dotSpacing | 1.6 / 16 | 手机自动放大间距 1.5× |
| cursorRadius / cursorForce | 420 / 0.12 | 只对 `pointer: fine` 开启 |
| waveAmplitude | 2.5 | 全场缓波 |
| sparkle | on | 每帧 ~3% 的点放大 1.8×（伪随机哈希，无分配） |
| glow | on | SVG 径向“暗斑”跟随鼠标，按移动速度淡入（engagement 模型） |
| fps | 30 | 背景装饰不值 60fps 的电 |

工程要点（都是踩过的坑）：
- 颜色量化缓存（渐变 12 档 × 透明度 8 档），避免每帧上万次字符串分配
- 真实时间驱动相位，rAF 被节流后平滑续接，不跳变闪烁
- 只有宽度变化才重建点阵；iOS 软键盘/工具栏引起的纯高度抖动不重建
- 触摸滚动会触发 pointermove——指针扰动只对精确指针开启
- `prefers-reduced-motion` 时画一帧静态点阵，不进动画循环
- 取色自 `--df-from/--df-to/--df-glow`，主题/明暗切换自动换色（MutationObserver + matchMedia）

## 5. 明暗切换按钮（.scheme-toggle）

常驻右上角（fixed，z-index 45——高于 sticky 顶栏、低于弹层）。
点击循环 `auto → light → dark`，图标 🌗/☀️/🌙；auto 态右下角加一枚 accent 小圆点，
让「跟随系统」与「手动固定」一眼可分。

`mountSchemeToggle()` 来自 `@szyyw/design/scheme`，同模块还提供
`setScheme` / `cycleScheme` / `onSchemeChange`（供设置页等处双向同步）。

两个必须知道的点：
- **持久化用 cookie**（SSR 项目服务端要读它，才能首屏就渲染对，不闪白）。
  纯静态页可传 `persist: "localStorage"`。
- **theme-color 同步读的是 `body` 的 computed backgroundColor，不是 `--bg`**：
  自定义属性不做条件求值，直读只会拿到未展开的 `light-dark(...)` 字面量。

页面需为它留出右上角空间（顶栏/内容区加 padding-right），否则会盖住那里的操作按钮。

## 6. hover 光斑（.spot）

卡片 hover 时一团 accent 色的柔光跟随指针（radial-gradient at `--mx/--my`）。
`attachSpot()` 事件委托一次挂载，动态元素自动覆盖；触摸设备与 reduced-motion 下不启用。
与 `.lift`（上浮 + 描边）可叠加：`class="glass lift spot"`。

## 7. 字体与数字

- 正文 Inter + 中文回退（PingFang SC / Hiragino / 雅黑）；15px 基准
- 等宽 SF Mono / JetBrains Mono——终端窗、日志、代码
- **所有数字加 `.num`**（tabular-nums），金额列才对得齐
- 输入件字号 ≥16px：iOS 聚焦小于 16px 会触发页面缩放

## 8. 交互约定

- 破坏性操作：二次确认（首点变红「再点一次确认」+ 展开影响范围警告），
  桌面弹层底栏里破坏性按钮靠左隔离（`.sheet-foot .danger { margin-right: auto }`）
- 弹层：手机底部抽屉（sheet-up），桌面居中卡片（rise）；关闭 ✕ 恒在右上
- 动画终帧必须 `transform: none`——fill-mode 残留 transform 会困住子孙 fixed 弹层
- 空状态：居中 emoji + 一句引导文案（`.empty`）

## 9. 终端窗（日志回放）

刻意保持深色（真实终端的样子），浅色模式也不变——用独立的 `--term-*` token。
等宽字体、分级着色（debug 暗 / info 青 / warn 黄 / error 红）、按级别过滤、
自动跟随滚动（用户上翻时暂停）、复制按钮带「已复制」反馈。
