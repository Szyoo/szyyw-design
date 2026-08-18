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
z-index 0   .bg-layer        点阵背景（fixed，独立合成层）
z-index 1   .app-frame       内容层
z-index 30  侧栏 / 顶栏（sticky/fixed + backdrop-blur）
z-index 40  底部导航
z-index 43  .panel-backdrop  抽屉遮罩
z-index 44  .settings-panel  背景参数抽屉
z-index 45  .corner-tools    右上角工具位（抽屉开着时齿轮仍要能点）
z-index 50  .overlay         弹层遮罩（Portal 挂 body，避开 transform 包含块陷阱）
```

玻璃三级：`--glass-bg`（卡片）→ `--inner-bg`（卡内嵌套）→ `--field-bg`（输入件）。
弹层用更实的 `--sheet-bg`（92% 不透明），保证叠在任何内容上都可读。

## 4. DotField 点阵背景

参数缺省值（两个项目实测的平衡点）：

| 参数 | 值 | 说明 |
|---|---|---|
| dotRadius / dotSpacing | 1.6 / 16 | 手机自动放大间距 1.5× |
| cursorRadius / cursorForce | 420 / 0.12 | 只对 `pointer: fine` 开启 |
| bulgeOnly / bulgeStrength | off / 40 | 见下方「两种指针模型」 |
| waveAmplitude | 2.5 | 全场缓波 |
| sparkle | on | 每帧 ~3% 的点放大 1.8×（伪随机哈希，无分配） |
| glow | on | SVG 径向“暗斑”跟随鼠标，按移动速度淡入（engagement 模型） |
| fps | 30 | 背景装饰不值 60fps 的电 |

**两种指针模型**（`bulgeOnly`）：关＝常驻斥力，点被推开、离开后回弹，鼠标停着也保持位移；
开＝凹陷，位移乘 engagement（鼠标速度的平滑值），停下就回填，二次衰减让坑边缘不出硬边。

工程要点（都是踩过的坑）：
- 颜色量化缓存（渐变 12 档 × 透明度 8 档），避免每帧上万次字符串分配
- 真实时间驱动相位，rAF 被节流后平滑续接，不跳变闪烁
- 只有宽度变化才重建点阵；iOS 软键盘/工具栏引起的纯高度抖动不重建
- 触摸滚动会触发 pointermove——指针扰动只对精确指针开启
- `prefers-reduced-motion` 时画一帧静态点阵，不进动画循环
- 取色自 `--df-from/--df-to/--df-glow`，主题/明暗/行内 token 变化自动换色
  （MutationObserver 监听 `data-*` 与 `style` + matchMedia）
- **颜色 token 必须解析后再用**：自定义属性不做条件求值，
  `getPropertyValue("--df-from")` 只会拿到未展开的 `light-dark(...)` 字面量，
  解析必然失败、静默退回兜底色——v0.3.0 之前浅色模式与 aurora 配色其实从未生效。
  正确做法是把它套到真实的 `color` 属性上让浏览器算（`resolveTokenColor()`）

## 5. 右上角工具位（.corner-tools）

全局开关都挂这里，容器管定位、按钮只管长相。CSS `order` 决定左右，
小的在左：明暗切换 10、背景参数 20。项目自己的按钮用 `mountCornerTool(el, { order })`
插进同一条，别再各自 fixed 一个——两个 fixed 会叠在一起。

页面需为这条留出右上角空间（顶栏/内容区加 padding-right），否则会盖住那里的操作按钮。

### 明暗切换（.scheme-toggle）

点击循环 `auto → light → dark`，图标 🌗/☀️/🌙；auto 态右下角加一枚 accent 小圆点，
让「跟随系统」与「手动固定」一眼可分。

`mountSchemeToggle()` 来自 `@szyyw/design/scheme`，同模块还提供
`setScheme` / `cycleScheme` / `onSchemeChange`（供设置页等处双向同步）。

两个必须知道的点：
- **持久化用 cookie**（SSR 项目服务端要读它，才能首屏就渲染对，不闪白）。
  纯静态页可传 `persist: "localStorage"`。
- **theme-color 同步读的是 `body` 的 computed backgroundColor，不是 `--bg`**：
  自定义属性不做条件求值，直读只会拿到未展开的 `light-dark(...)` 字面量。

### 背景参数（.settings-toggle → .settings-panel）

齿轮排在明暗切换右边，点开右侧抽屉实时调点阵。抽屉顶端从工具位下方起，
开着时两枚按钮仍露在外面、还能点。来自 `@szyyw/design/settings`。

参数分两路走，面板上看不出区别，底下各归各家：

- **行为参数**（点大小/间距/指针模型/波浪/光晕半径…）→ `field.setOptions()`
- **颜色** → 写 `<html>` 行内 token（`--df-from` / `--df-to` / `--df-glow`），
  DotField 的 observer 接住换色。颜色永远是 token，不从组件层硬塞进画布

**只持久化被真正动过的键**。面板一打开就会把当前解析色填进色块（不然色块显示不出当前颜色），
但那是「主题算出来的值」而不是「用户的选择」——整包存下去会把没碰过的颜色钉死成当时那套明暗，
`sparkle` / `waveAmplitude` 也会就此脱离主题旋钮。同理，刷新后要把已存的键认回「动过」，
否则这次只改一项就会把上次存的覆盖没了。这条语义跟 DotField 内部的 explicit 集合是一套：
**手动调过的归你管，没调过的跟主题走**，「恢复默认」把控制权整体交还主题。

`onSave` 传了才显示「保存」按钮（存服务端用），存的是同一份「改动过的键」；
没传就显示 `note`（如「访客模式 · 仅本地预览」）。

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

样子在 components.css：`.term` 外框 / `.term-head` 整条可点折叠 /
`.term-dot[data-live="1"]` 实时脉冲 / `.term-bar` + `.term-lvl` 级别过滤 /
`.term-body` 等宽正文 / `.term-line` 加 `.debug|.info|.warn|.error` 分级着色
（暗 / 青 / 黄 / 红）/ `.term-copy.copied` 复制反馈 / `.term-cursor` 光标闪烁。

行为归各项目自己接：按级别过滤、自动跟随滚动（用户上翻时暂停）、
复制后给 `.term-copy` 加 `.copied` 再撤掉。**着色用类，别再内联 `style`**。
