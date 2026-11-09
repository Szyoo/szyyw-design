# szyyw.xyz 设计语言

适用范围：portal（szyyw.xyz）、jppost-tracker 及后续所有个人项目。
本仓库是唯一权威来源——改设计先改这里，再升 tag，各项目升级依赖。

## 1. 气质

深空。安静的底色上浮着毛玻璃层，蓝灰渐变只做点缀不做主角（v0.25.0 起缺省配色由青紫改为蓝灰，蓝色元素更少、更克制）。
信息密度可以高，但视觉噪音必须低：细边框、低饱和、克制的动效。
所有动效使用同一条缓动曲线 `--ease: cubic-bezier(0.22, 1, 0.36, 1)`——快出慢停，有弹性但不弹跳。

## 2. 三层：主题 → 配色 → 明暗（+ 鼠标效果）

- **主题（theme）**：`html[data-theme]`，决定**背景效果**。v0.19.0 起可插拔（§4.1）：`nebula`（星云，DotField 点阵）、
  `cursor-grid`（光标网格）、`gradient-waves`（渐变波浪）、`side-rays`（侧光）、`pixel-blast`（像素爆破）、`particles`（粒子）。
  切换主题时销毁旧背景、按需加载并挂上新背景，不刷新页面。毛玻璃层级、.spot 光斑与所有组件在各主题下一致。
  **v0.21.0 起缺省主题是「随机」（`random`）**：见 §2.2。`data-theme` 永远是实际挂着的主题；随机模式另有 `data-theme-mode="random"`。
  效果类参数尽量做成 token 旋钮（如 `--df-sparkle` / `--df-wave`），让主题只用 CSS 就能重配行为。
- **配色（palette）**：`html[data-palette]`，只覆盖 hue 相关 token（accent/bg/tint/df-*/th-*）。目前只有缺省蓝灰（`:root` 基础块，不写属性；id 仍为 `default`，v0.25.0 前为青紫）：
  主色 `--accent` 暗 `#9aaac2` / 浅 `#4e5f78`，辅色 `--accent2` 暗 `#b6a9d6` / 浅 `#6b5d93`；渐变按钮上的字 `--on-accent` 暗色用深字、浅色用白字（均 ≥ 4.5:1）。
  
  v0.21.0 移除了 `aurora`（极光翠青），存着它的用户回到 `default`。只剩一种配色时外观弹层不显示配色栏，以后加回配色自动出现。
  v0.19.0 起**对所有主题通用**（tokens.css 的配色块本就不依赖 data-theme；`PALETTES[].theme` 只作来源标注）。
  各主题从 token 取色，配色 / 明暗切换即时换色、不重建。
- **鼠标效果（cursor，v0.19.0）**：`html[data-cursor]`，`default`（系统指针，不写属性）/ `target`（Target Cursor，§5「鼠标效果」）。
  只在 `pointer: fine` 下生效，外观弹层里也只在精确指针设备上出现。
- **明暗（scheme）**：`html[data-scheme]`，`dark`（缺省）/ `light` / `auto`（跟随系统）。
  实现：token 全部用 `light-dark()` 双值书写，scheme 只切换根节点的 `color-scheme`。
  auto = `color-scheme: light dark`，由系统决定取哪套，无需 JS 参与。

规则：**组件层禁止硬编码颜色**。透明度派生用 `color-mix(in srgb, var(--x) N%, transparent)`，
新颜色一律先进 tokens.css。渐变到透明必须用「同色 + 0 透明度」，
`transparent` 关键字是透明黑，插值中段会发灰。

### 2.1 外观的持久化与首屏

三层的**选项表**与**纯函数**在 `@szyyw/design/appearance-data`（零 DOM、零 import，服务端可直接 import）：
`THEMES` / `PALETTES`（含每个配色 `--bg` 的 `bg.dark` / `bg.light`）/ `SCHEMES` / `DEFAULT_APPEARANCE` /
`normalizeAppearance` / `themeColorFor` / `readAppearanceFromCookies` / `appearanceAttrs`。
客户端状态与「外观」弹层在 `@szyyw/design/appearance`。状态的唯一真相仍是 `<html>` 上的属性
（`data-theme` / `data-palette` / `data-scheme`，v0.19.0 加 `data-cursor`）。

v0.19.0 起存储键四项：`appearanceCookieNames(prefix)` → `{ theme, palette, scheme, cursor }`（如 `fl_cursor`）；
v0.21.0 加第五项 `themeSet`（`fl_theme_set`，主题「显式选择」标记，见 §2.2）。
`readAppearanceFromCookies` / `normalizeAppearance` / `appearanceAttrs` 都认 `cursor`，cursor 为 default 时不写 `data-cursor`；
只传三项键名的旧调用照旧可用（cursor 用缺省名 `cursor`，themeSet 按 `${theme}_set` 推出）。未知主题 id 一律回退缺省 `random`（v0.21.0 前回退 nebula）；
配色不再随主题过滤。客户端的鼠标效果只在用户动过时落盘（旧应用不会多写一个 cookie）。

1. **SSR 项目（Next 等）**：服务端读 cookie → 铺到 `<html>`，theme-color 也在服务端算，首屏不闪。

   ```ts
   import { readAppearanceFromCookies, appearanceAttrs, themeColorFor, appearanceCookieNames } from "@szyyw/design/appearance-data";
   const a = readAppearanceFromCookies((n) => jar.get(n)?.value, appearanceCookieNames("fl_"));
   // <html lang="zh" {...appearanceAttrs(a)} suppressHydrationWarning>   —— palette 为 default 时不写 data-palette
   // theme-color：themeColorFor(a.palette, a.scheme)；auto 返回 { dark, light }，各配一条 media 查询
   ```

   v0.21.0：`a.theme` 已按迁移规则算好（可为 `"random"`）。随机时服务端不知道客户端会抽到哪个，`appearanceAttrs` **不写 `data-theme`**，
   只写 `data-theme-mode="random"`；配色 / 明暗与主题无关，照常铺，所以首屏不闪错色，只是背景由客户端 `configureAppearance` 抽定后才挂上
   （与 v0.19.0 的背景本来就由 JS 挂一致）。客户端随后会在 `<html>` 上补 `data-theme`，React 系应用给 `<html>` 加 `suppressHydrationWarning`。

2. **客户端对齐**：`configureScheme({ persist: "cookie", storageKey: "fl_scheme" })` +
   `configureAppearance({ persist: "cookie", storageKeys: { theme: "fl_theme", palette: "fl_palette" } })`。
   两者都是「`<html>` 上已有合法属性的项不覆盖，没有的才从存储恢复」。
3. **静态页（无服务端）**：`<head>` 里、样式表之前内联一段同步脚本，从 localStorage 读键写到 `<html>`，
   然后用 `persist: "localStorage"`（完整示例见 `demo/appearance.html`）。v0.21.0 推荐片段（随机 / 迁移只标 `data-theme-mode`，
   实际主题交给 JS 抽——片段不必内嵌主题清单，加主题也不用改）：

   ```html
   <script>
     (function () {
       var d = document.documentElement;
       try {
         var t = localStorage.getItem("app:theme"), m = localStorage.getItem("app:theme_set"),
             p = localStorage.getItem("app:palette"), s = localStorage.getItem("app:scheme"),
             c = localStorage.getItem("app:cursor");
         if (t === "random" || (!m && (!t || t === "nebula"))) d.setAttribute("data-theme-mode", "random");
         else if (t) d.setAttribute("data-theme", t);
         if (p && p !== "default") d.setAttribute("data-palette", p);
         if (s === "auto" || s === "dark" || s === "light") d.setAttribute("data-scheme", s);
         if (c && c !== "default") d.setAttribute("data-cursor", c);
       } catch (e) {}
     })();
   </script>
   ```

   **旧片段（只恢复 theme / palette / scheme，v0.19.0 片段）不会坏**：没有 `data-cursor` 时 `configureAppearance` 会从存储补上；
   主题以存储为准重新判定（含迁移），旧片段写进去的 `data-theme="nebula"` 会被换成本时间段抽到的主题——背景还没挂，所以不闪；
   写进去的 `data-palette="aurora"` 在 tokens.css 里已没有对应块，视觉上本就是缺省配色，随后属性被移除。旧片段可以不改，但推荐换新片段。

4. **账号级持久化**归应用：`mountAppearancePanel({ onChange })` 里存库（🌗 改明暗也走这一个回调，别再另外订阅
   `onSchemeChange` 存一遍）；登录后把库里的值写回 cookie，换设备不用重设。v0.21.0：`onChange` 的 `theme` 可为 `"random"`
   （另带 `resolvedTheme` = 本次实际主题，只供展示、不要存）；服务端的主题白名单要接受 `random`，配色白名单去掉 `aurora`（或直接用 `normalizeAppearance`）；
   v0.19.0 期间存进库的 `nebula` 多半只是缺省值——写回时要么连同显式标记一起存，要么用 `resolveThemeChoice(theme, explicit)` 迁移。
5. **文案**（v0.12.0 起）：包内置 zh / ja / en（`appearance-text.js`），应用只传 `locale`，
   不要再在应用的 i18n 里抄一份外观文案；个别词要改用 `labels` 逐键覆盖（`controls` 管主题参数控件名）。
   v0.13.0 起应用切换器 / 账户菜单 / 语言切换的文案也内置（`chrome-text.js`，同一套规则：未知语言回退中文、缺键按中文补齐）。
6. **配色色值手工双写**：JS 不能 import CSS，`PALETTES[].bg` 与 tokens.css 的 `--bg: light-dark(L, D)` 各写一份。
   改 tokens.css 的配色块必须同步 appearance-data.js，并跑 `node scripts/check-tokens.mjs`（不一致退出码 1）。

### 2.2 随机主题（v0.21.0）

- **缺省就是随机**：`DEFAULT_APPEARANCE.theme = "random"`；`THEMES` 第一项是 `{ id: "random", random: true }`（不是真实主题，注册表里没有），
  `REAL_THEME_IDS` 是真实主题。存储里保存 `random` 本身，不保存抽到的那个。
- **按时间段轮换**：抽中的主题与抽取时间一起存在 localStorage `${主题键}_random`（如 `fl_theme_random`，值 `{"id","at"}`；
  localStorage 不可用时退回同名 cookie，都不可用则每次加载重抽）。同一时间段内所有页面、所有标签页用同一个；时间段到了之后第一次打开时重抽，
  且**避开上一次抽中的主题**（主题 ≥ 2 个时），保证每次轮换都有变化。时间段由 `randomEvery` 决定：`"day"`（缺省，按用户本地日期，本地 0 点后换）/
  `"week"`（本地周一换周）/ 毫秒数（距上次抽取满这么久）；`mountAppearance({ randomEvery })`、`mountChrome({ appearance: { randomEvery } })`、
  `configureAppearance({ randomEvery })` 同义。抽取记录与 persist 方式无关（persist: "none" 也会记，它不是用户选择）。
- **面板里点「随机」**（从别的主题切回随机）：立即重抽一个（避开当前主题）并开始新的时间段。随机已选中时再点不变。
  「随机」排在主题行第一个，选中态是它本身；下方提示行显示「本次：<主题名>」（文案 `randomNow`，zh「本次：」/ ja「今回：」/ en「This time: 」）。
  主题参数段显示实际主题的参数，调参照常按该主题保存。
- **加载失败**：抽到的主题加载失败（文件缺失 / 网络 / 拿不到 WebGL）就排除它再抽，全部失败回退 nebula（外观弹层挂着时自动处理；
  只用 `mountThemeBackground` 时可在 `status === "failed"` 事件里调 `rerollRandomTheme(id)`）。随机模式下显式点了一个加载失败的主题，选择退回随机、保留当前背景。
- **`<html>` 表示**：`data-theme` = 实际主题（CSS / 主题 token 按实际主题生效），`data-theme-mode="random"` 标记随机模式；显式选择时没有 `data-theme-mode`。
  `getAppearance()` 返回 `theme`（选择，可为 `"random"`）与 `resolvedTheme`（实际主题）。
- **一次性迁移**（v0.19.0 之前 nebula 是唯一主题，存着的 `nebula` 只是缺省值）：显式标记键 `${主题键}_set`（如 `fl_theme_set=1`）。
  没有标记时，存储值为 `nebula` / 缺省 / 非法 → 视为 `random`；为其他真实主题（v0.19.0 里用户自己点的）或 `random` → 保持。
  在面板里（或 `setAppearance({ theme })`）显式选任何主题——包括 nebula、包括随机——都会写入标记，此后按选择保持。
  cookie 与 localStorage 两种 persist 都写标记；服务端 `readAppearanceFromCookies`、客户端 `configureAppearance` 与首屏片段用同一条规则
  （纯函数 `resolveThemeChoice(stored, explicit)`）。`<html>` 上写死的 `data-theme="nebula"`（没有存储时）同样视为缺省 → 随机。
- 只挂旧 `field` 适配器（`mountAppearancePanel({ field })`，没有可切换背景）的应用：随机仍会在 `data-theme` 上记一个主题，但页面上只有点阵，
  不受影响；想要随机生效请换 `mountAppearance({ background })`。

## 3. 层级模型

```
z-index 0   .bg-layer        点阵背景（fixed，独立合成层）
z-index 1   .app-frame       内容层
z-index 20  .section-head.sticky  吸顶小标题（v0.22.0，内容层里；被标题行盖过）
z-index 21  .page-head.sticky     吸顶标题行（v0.22.0；低于应用自己的顶栏 30，不盖工具位 / 弹层 / sheet）
z-index 30  侧栏 / 顶栏（sticky/fixed + backdrop-blur）
z-index 40  底部导航 / .action-bar 底部操作条（v0.30.0，§16.4）
z-index 45  .corner-tools    右上角工具位
z-index 46  .corner-panel    工具位弹层（外观 / 背景参数、应用切换器、账户菜单、语言；无遮罩）
z-index 50  .overlay         弹层遮罩（Portal 挂 body，避开 transform 包含块陷阱）
z-index 51  .drawer          侧边抽屉（v0.13.0；要遮罩就配一个兄弟 .overlay）
z-index 55  .menu            锚定下拉菜单（v0.13.0；抽屉 / 弹层里的 ⋯ 也要盖得住）
z-index 60  .toast-region    操作反馈（v0.13.0；压在一切之上，不拦点击）
z-index 62  .glide-select__menu  Glide Select 的选项菜单（v0.19.0，挂 body、fixed）
最顶层      .target-cursor   Target Cursor（v0.19.0，fixed、pointer-events: none）
```

主体栏：`.app-frame > .app-main`（v0.25.0，§15.1）——居中定宽的一栏自带半透明底 `--page-veil`，画在 `::before`（z-index -1，
落在 `.app-frame` 的层叠上下文里、内容之下），不新建层叠上下文，上表各层级不受影响。

玻璃三级：`--glass-bg`（卡片）→ `--inner-bg`（卡内嵌套）→ `--field-bg`（输入件）。
弹层用更实的 `--sheet-bg`（暗色 94% / 浅色 94% 不透明），保证叠在任何内容上都可读。

**边缘与分隔（v0.25.0，暗色可读性）**。暗色下卡片底与页面底只差一点亮度，表面靠边框分开，所以边缘按下面的目标定（实测于 6 个背景主题）：

| 用途 | token | 暗色目标 |
|---|---|---|
| 卡片 / 面板 / 弹层的边框 | `--glass-border` | 对卡片底约 1.9:1（细而清楚） |
| 卡片 / 弹层上沿的内高光 | `--glass-highlight` → `--glass-inset`（`inset 0 1px 0`） | 一条极细亮线勾出轮廓；`.glass` / `.corner-tool` / `--pop-shadow` 自带 |
| 可交互控件的描边（`.field` `.btn-ghost` `.btn-icon` `.chip` 颜色选择 工具位按钮 Glide Select 触发器） | `--control-border` | 对相邻表面 ≥ 3:1（WCAG 1.4.11） |
| 标签页 / 分段控件轨道外圈 | `--seg-track-ring`（`inset 0 0 0 1px`） | ≥ 3:1 |
| 开关关闭时的轨道 | `--switch-track` | ≥ 3:1 |
| 分隔线 / 吸顶标题底线 / 表格行线 | `--line-soft` / `--row-line` | 约 1.5:1（分隔不抢内容） |

浅色模式下这些 token 与 v0.24.0 的实际取值相同（新增的高光与外圈在浅色为透明），浅色外观不变。
写组件时：可交互的边框用 `--control-border`，装饰性的表面边框用 `--glass-border`，别反过来。

## 3.1 刻度与交互状态（v0.28.0）

`tokens.css` 的「刻度」段（明暗无关）是组件与应用取尺寸的唯一来源：**字号、圆角、高度、间距、时长都用 token，不写死 px**。
包内全部组件按下面的规则统一；类名、标记、JS API 不变。手测页 `demo/foundations.html`（刻度色板、控件对齐、交互状态、容器）。

### 刻度 token

| 类 | token | 值 | 用途 |
|---|---|---|---|
| 字号 | `--fs-xs` `--fs-sm` `--fs-md` `--fs-base` `--fs-body` `--fs-title` `--fs-input` `--fs-lg` `--fs-xl` `--fs-2xl` | 11 / 12 / 13 / 14 / 15 / 16 / 16 / 18 / 22 / 26 | 角标小标签 / 提示表头 / 小号正文 / 按钮菜单项 / 正文 / 卡片弹层标题 / 输入框（防 iOS 缩放）/ 图标字符 / 页面标题 / 统计数字（桌面） |
| 行高 | `--lh-tight` `--lh-snug` `--lh-body` | 1.2 / 1.4 / 1.6 | 控件与标题 / 紧凑列表与标题行 / 正文 |
| 圆角 | `--r-xs` `--r-sm` `--r-md` `--r-lg` `--r-pill` | 6 / 8 / 12 / 16 / 999 | 见下「圆角与容器」 |
| 高度 | `--h-sm` `--h-md` `--h-lg` `--h-row` `--h-touch` | 28 / 36 / 44 / 36 / 40 | 控件三档 / 列表行 / 触屏最小点按 |
| 列表 / 点 | `--h-item` `--dot` | 52 / 8 | `.list-row` 缺省高 / `.dot` `.badge-dot` 直径（v0.29.0） |
| 间距 | `--sp-1` … `--sp-6` | 4 / 8 / 12 / 16 / 24 / 32 | 内边距与 gap（2px 细缝例外） |
| 焦点 | `--focus` `--focus-ring` `--focus-offset` | accent / `2px solid` / 2px | 所有 `:focus-visible` |
| 时长 | `--dur-fast` `--dur-base` `--dur-enter` | 150 / 250 / 400ms | 颜色·底色·按下 / 描边·阴影·弹层出入 / 入场 |
| 曲线 | `--ease` `--ease-out` | | 全部过渡用 token，不写 `ease` 关键字 |
| 模糊 | `--blur-sm` `--blur-md` `--blur-lg` | 8 / 14 / 18 | 遮罩与小浮件 / 卡片·菜单·toast / 弹层·抽屉 |
| 语义 | `--info` `--tint-info-bg` `--danger` | 偏青 / 淡底 / = `--err` | `.callout.info` `.toast.info`；`.danger` 按钮与菜单项 |
| 状态 | `--hover-border` `--selected-bg` `--selected-border` | accent 45% / 12% / 55% | 悬停描边；选中着色族 |

accent 的混合比例只用三档：45%（悬停描边）、12%（选中底）、55%（选中描边）。

### 控件三档

| 档 | 高 | 圆角 | 控件 |
|---|---|---|---|
| lg | 44 | `--r-md` | `.btn` `.btn-ghost` `.field` `select.field` 日期类输入、套 `.field` 的 Glide Select、Depth Carousel 箭头（桌面） |
| md | 36 | `--r-sm` | `.btn-small` `.field.small`（含 Glide）`.chip`（胶囊）`.tabs` / `.seg` 轨道 `.corner-tool` `.pager-btn` 非 `.field` 的 Glide 触发器 |
| sm | 28 | `--r-sm` | `.btn-icon`（28×28）`.tabs` / `.seg` 内块 `.tabs.compact` 轨道 `.toast-action` |
| ≤24 | 24 | `--r-xs` | `.btn-icon.xs` `.tabs.compact` 内块 `.toast-close` `.locale-menu-short` |

- 控件用 `min-height` 定高，不靠行高推；`.btn` 带 1px 透明边框，与 `.btn-ghost` 同高；按钮字重 600，`.tab` / `.chip` / Glide 触发器 500。
- 列表行 `--h-row` 36：`.menu-item` `.account-menu-item` `.locale-menu-item` `.app-switcher-item` Glide 选项，14px、圆角 8、左右 12。
- `.close-x` 32×32 方块、`.field-clear` / `.field-inset-btn` 32，垂直居中在 36 / 44 的输入框里。
- 触屏（`pointer: coarse`）：`.field.small` `.pager-btn` 至少 40，`.tabs` / `.seg` 缺省档轨道 40，`.btn-icon` 点按区向外扩到 40（外观不变）。

### 圆角与容器

- 容器（`.glass` 卡片、`.sheet`、`.drawer`、`.corner-panel`）一律 `--r-lg` 16；手机底部抽屉只圆上两角。
- 卡内块与浮件（`.inner` `.callout` `.menu` `.toast` Glide 菜单 `.table-wrap` `.term`）一律 `--r-md` 12。
- 菜单类保持同心：外圆角 = 内圆角 + 内距（`.menu` 12 = 8 + 4；工具位菜单 16 = 8 + 8；`.tabs` 轨道 12 = 8 + 4，紧凑 8 = 6 + 2）。
- 容器内边距 `--sp-4` 16：`.panel`、`.stat-card`、`.inset-list` 的 `--inset`、弹层与抽屉；`.sheet` 与 `.drawer` 头 16/16/8、体 4/16/16、脚 12/16/16，页脚不画上边线（靠间距分隔）。
- 浮层都带 `--pop-shadow`（`.sheet` `.corner-panel` `.drawer` `.menu` `.toast` Glide 菜单）。

### 文字层级

页面标题 `.page-title` 22/600；卡片 / 弹层 / 抽屉标题（`.panel-title` `.sheet-title` `.drawer-head h*`）16/600；统计数字 `.stat-value` 22（桌面 26）/600；
`.section-name` 12/600 大写、字距 .12em；表头、`.stat-label`、`.pill` 等小标签字距 .06em。标题行高 `--lh-tight`。

### 交互状态

| 状态 | 规则 |
|---|---|
| hover | 有边框的控件（`.btn-ghost` `.btn-icon` `.chip` `.field` `.corner-tool` Glide 触发器、Depth Carousel 箭头）→ 描边 `--hover-border` + 文字 `--text`；无边框的（`.close-x` 菜单项 `.pager-btn` `.row-hover` `.field-clear` `.msg-item`）→ 衬底 `--hover-tint`。`.btn` 渐变按钮保留上浮 + 投影 |
| active | 可按的控件 `scale(.97)`；`.btn` 回到原位 + `scale(.98)` |
| focus-visible | `outline: var(--focus-ring); outline-offset: var(--focus-offset)`；会被 overflow 裁切的（菜单项、输入框内的按钮、表格与横滚轨道里的）用 offset -2px；`.field` 聚焦描边变 `--focus` + 同一圈环向内收 1px（`.form-grid` 格子会裁切）。另有特异性为 0 的兜底规则覆盖所有 `a[href]` `button` `input` `select` `textarea` `summary` `[tabindex]` |
| disabled | `opacity: .45; cursor: not-allowed`；`.btn` 例外，保留实底「熄灭」态 |
| invalid | `.field[aria-invalid="true"]` / `.field.invalid` → 描边与焦点环 `--err`；下方 `.field-msg.err`（12px、上间距 4px），中性说明用 `.field-msg` |
| danger | `.btn.danger` 实底 `--danger` + `--on-err` 字；`.btn-ghost.danger` `.menu-item.danger` `.account-menu-item.danger` 常驻 `--danger` 字、悬停衬 12% 底 |
| selected | 两族：**着色族** `--selected-bg` / `--selected-border`（`.chip.active`、Glide 选项、语言列表当前项、应用切换器当前项、列表选中）；**凸起族** `--seg-raised*`（`.tabs` `.seg` 的选中块、`.pager-btn.active`） |

```html
<input class="field" aria-invalid="true" aria-describedby="m1"><p class="field-msg err" id="m1">请输入邮箱</p>
<button class="close-x" aria-label="关闭"></button>   <!-- 留空（标签间不留空白）自动画 Lucide x；.field-clear 同理 -->
```

### 应用侧

自写样式里的字号、圆角、高度、间距、时长改用上面的 token（`font-size: var(--fs-sm)`、`border-radius: var(--r-md)`、`min-height: var(--h-md)`、`padding: var(--sp-3)`），
自写的焦点样式改为 `outline: var(--focus-ring)`，自写的选中底改为 `--selected-bg`。刻度变了，跟着 token 走的应用不用再改。

## 4. DotField 点阵背景

DotField 是缺省主题 `nebula` 的背景（`themes/nebula.js` 是它的主题适配器，§4.1）。旧 API `mountDotField` / `mountDotFieldSettings` /
`restoreDotFieldSettings` 不变；nebula 的主题参数与旧「背景参数」同键、同存储（`szyyw:dotfield`）、同「只存动过的键」语义。

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

出处：原型是 [React Bits](https://reactbits.dev) 的 DotField（portal 用它替掉 Dashy，
分支 `vps/portal-reactbits`）。上游是 React 组件、mousemove 用 pageX/pageY、
光晕终点写 `stop-color="transparent"`；本实现改成框架无关 ESM、颜色量化缓存、
token 取色，并修掉了那个 transparent 灰晕。上游素材可用 shadcn CLI 按本仓库 `components.json` 的
`@react-bits` registry 取到 `reference/reactbits/`（`npx shadcn@latest add @react-bits/<名字>`；已 gitignore，
不随包分发），只作参考、不作依赖。

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

### 4.1 背景主题（`themes/`、`theme-background`，v0.19.0）

**注册表** `themes/index.js`：`THEME_REGISTRY = [{ id, labels: { zh, ja, en }, load: () => import("./<id>.js") }]`，
`themeEntry(id)`、`loadTheme(id)`（同一 id 只加载一次，失败不缓存）、`pickLabel(labels, locale)`。零 DOM，服务端 import 无副作用。
nebula 由 theme-background.js 静态引入（首帧同步挂上），其余**只加载当前主题**。
`appearance-data.js` 的 `THEMES` 与注册表由 `scripts/check-tokens.mjs` 断言同序一致。

**主题模块接口**（`themes/types.d.ts`）：

```js
export const meta = { id, labels: { zh, ja, en }, params: [ /* 见下 */ ] };
export function mount(container, params, ctx) { return { update(params, info), reset?(params), destroy() }; }
```

- `params` 项类型：`range`（min / max / step / default）、`toggle`、`select`（options[].value / labels）、
  `token`（值是 token 名，如 `"--accent"`；**颜色一律来自 token，不暴露自由取色**）、`color`（直接改写一个颜色 token，只给 nebula 兼容旧取色用）。
  可选 `hints`（说明行）、`visibleWhen: { key, equals } | { key, notEquals }`（条件显示）。外观弹层按它自动生成控件。
- `ctx`：`reducedMotion()`、`finePointer()`、`color(token) → [r, g, b, a]`（**r/g/b 0–255，a 0–1**，light-dark / color-mix 已求值；
  取不到 `[0,0,0,0]`）、`onColorsChange(cb) → 退订`（主题 / 配色 / 明暗 / 行内 token 变化，同一帧合并）、`overrides`（用户动过的参数）。
- `update(params, { changed, overrides })`：参数变化热更新；`reset` 可选（「恢复默认」时调用，不实现则以缺省值调 update）。
- 约定：canvas `pointer-events: none`，指针在 window 上监听且只在 `pointer: fine` 下启用；标签页隐藏 / 不在视口时暂停；
  `fps` 参数（背景缺省 30）；reduced-motion 下静态；destroy 移除 canvas / 监听 / rAF。
- 颜色 token：主题需要专用色时在 tokens.css 为每个配色（目前只有 default）× light / dark 各加 `--th-<主题>-*`。
  **token 的 alpha 是强度系数**：浅色模式用较低 alpha，叠在浅底上不刺眼、不抢正文。

**运行时** `mountThemeBackground(container, { theme?, follow = true, persist, storageKey, storagePrefix })`（`./theme-background`）：
跟随 `html[data-theme]` 切换；参数按主题分别持久化——nebula 用 `szyyw:dotfield`，其余 `szyyw:theme-params:<id>`，只存动过的键。
句柄：`theme` / `requested` / `meta` / `ready` / `field`（nebula 时为 DotField 句柄）/ `status(id)` / `setTheme` / `params()` /
`overrides(id?)` / `allOverrides()` / `setParams(patch)` / `resetParams()` / `subscribe(fn)` / `destroy()`。
同模块还导出 `createThemeContext`、`tokenColor`、`parseCssColor`、`themeDefaults`、`sanitizeThemeParams`、`readThemeParams`。
加载失败（文件缺失 / 网络 / 模块不合规 / 拿不到 WebGL）不抛错：状态记 `failed`，保留当前背景（首挂失败回退 nebula）；
外观弹层把该主题 chip 置灰并提示，用户刚点选的会退回当前主题。

**新增一个主题**：写 `themes/<id>.js`（+ `.d.ts`），在 `themes/index.js` 登记一行、在 `appearance-data.js` 的 `THEMES` 加 id、
在 `appearance-text.js` 的 `themes` 加三语名字，把文件加进 `package.json` `files`（`themes/` 已整目录收录）与 `sync.sh` 的 `FILES`，
跑 `node scripts/check-tokens.mjs`。

**Canvas 主题的上游参数对照**（缺省值同上游，颜色改 token）：

- `cursor-grid`（React Bits CursorGrid）：`cellSize radius falloff holdTime fadeDuration lineWidth maxOpacity fillOpacity gridOpacity cellRadius clickPulse pulseSpeed`
  同名保留；`color`（hex）→ token 选择（缺省 `--accent`）；`gridOpacity` 缺省 0 → 0.08（触屏 / 减少动效时不至于全空）；新增 `fps`（30）。
- `particles`（React Bits Particles，WebGL2 优先、降级 WebGL1 + ANGLE_instanced_arrays，都没有则不画）：`particleCount particleSpread speed
  moveParticlesOnHover particleHoverFactor alphaParticles particleBaseSize sizeRandomness cameraDistance disableRotation shape glow twinkle
  depthOfField connections connectionDistance hoverEffect hoverRadius clickBurst drift driftSpeed variation intro opacity paused` 同名保留；
  `particleColors`（数组）→ `colorA` / `colorB` 两个 token（缺省 `--accent` / `--accent2`）；`lightMode`（布尔）→ `auto | on | off`，
  auto 按解析后的 `--bg` 亮度；`pixelRatio` 0 = 跟随设备；新增 `fps`（30）。

### 4.2 WebGL 主题（`gradient-waves` / `side-rays` / `pixel-blast`，v0.19.0）

三个主题按 §4.1 接口写（`mount` 另返回 `webgl` 布尔），共用内部模块 `themes/_gl.js`（不单独导出，但必须随包分发）：

- **上下文**：先 `webgl2` 后 `webgl`；着色器源码统一写 GLSL ES 1.00，WebGL2 下自动加 `#version 300 es` 头（宏替换
  `attribute/varying/gl_FragColor/texture2D`），WebGL1 需要 `fwidth` 时自动开 `OES_standard_derivatives`。都拿不到或着色器编译失败：
  `mount` 不抛错，container 留 `background: var(--bg)`，返回 `webgl: false`，由框架决定回退。
- **画布**：铺满 container、`pointer-events: none`；像素比 = `min(devicePixelRatio, maxDpr)`（参数，缺省 1.5）；ResizeObserver +
  window resize（DPR 变化）。全部输出**预乘 alpha**。
- **丢上下文**：`webglcontextlost` 时 `preventDefault` 并停画，`webglcontextrestored` 后重建程序 / 缓冲 / 纹理继续，canvas 不换。
- **帧循环**：`fps` 限帧（缺省 30）；时间按真实间隔累加、单帧最多补 100ms（暂停恢复不跳）；标签页隐藏、container 不在视口时停 rAF；
  reduced-motion 时不进循环，只在挂载 / 参数变化 / 换色时画一帧。
- **取色**：颜色参数是 `type: "token"`（options：主题自有 `--th-*` + `--accent` / `--accent2` / `--df-from` / `--df-to` / `--text` / `--text-dim`），
  经 `ctx.color()` 解析后归一到 0–1，`onColorsChange` 时即时换色、不重建。
- **参数热更新**：除 pixel-blast 的 `antialias`（上下文属性，内部重建）外都只改 uniform。
- 新 token：`--th-gradient-waves-horizon / -wave / -crest`、`--th-side-rays-1 / -2`、`--th-pixel-blast-color`。

参数对照（上游 prop → 本包 key，缺省值同上游；三者都另有本包新增的 `fps`（10–60，缺省 30）与 `maxDpr`（0.5–2，缺省 1.5））：

| 主题（上游） | 参数 |
|---|---|
| `gradient-waves`（GradientWaves） | `horizonColor / waveColor / crestColor`（token，缺省 `--th-gradient-waves-*`）、`speed` 0.4、`amplitude` 2.5、`waveScale` 0.6、`waveRatio` 0.9、`swell` 35、`turbulence` 20、`tilt` 1.11（弧度）、`zoom` 1、`height` 5.5、`fogDepth` 15、`detail` low / **medium** / high（步进 40 / 70 / 110）、`brightness` 1、`opacity` 1、`mouseInteraction` on、`parallaxStrength` 0.5、`grain` on、`grainIntensity` 0.05 |
| `side-rays`（SideRays） | `speed` 2.5、`rayColor1 / rayColor2`（token，缺省 `--th-side-rays-1 / -2`）、`intensity` 2、`spread` 2、`origin` **top-right** / top-left / bottom-right / bottom-left、`tilt` 0（度，−90–90）、`saturation` 1.5、`blend` 0.75、`falloff` 1.6、`opacity` 1 |
| `pixel-blast`（PixelBlast） | `variant` **square** / circle / triangle / diamond、`pixelSize` 3、`color`（token，缺省 `--th-pixel-blast-color`）、`antialias` on、`patternScale` 2、`patternDensity` 1、`pixelSizeJitter` 0、`enableRipples` on（点击涟漪）、`rippleIntensityScale` 1、`rippleThickness` 0.1、`rippleSpeed` 0.3、`liquid` off、`liquidStrength` 0.1、`liquidRadius` 1、`liquidWobbleSpeed` 4.5、`speed` 0.5、`edgeFade` 0.5、`noiseAmount` 0、`transparent` on（关 = 底色取 `--bg`，上游是黑）、`autoPauseOffscreen` on |

与上游的差异（都是有意的）：ogl / three / postprocessing → 原生 WebGL；pixel-blast 开 `liquid` 或 `noiseAmount > 0` 时先画进帧缓冲，
第二遍全屏着色器做 UV 扭曲（拖尾纹理 = 64×64 的 2D 画布，同上游）与噪点，都关时一遍直出；side-rays 上游每次改参数都重建上下文，这里只改 uniform；
pixel-blast 时间按 `speed` 积分（上游改速度时相位会跳）、液态拖尾按真实时间老化（上游按帧数）；gradient-waves 鼠标缓动按真实时间折算；
指针都在 window 上监听（上游监听 canvas），只对精确指针开启。

## 5. 右上角工具位（.corner-tools）

全局开关都挂这里，容器管定位、按钮只管长相。CSS `order` 决定左右，
小的在左：应用切换器 5、账户 6、明暗切换 10、语言 15（v0.13.0）、外观（或旧的背景参数）20。
项目自己的按钮用 `createCornerButton({ icon, label, order, onClick | href, badge })`（v0.13.0，缺省 order 50）
插进同一条，别再各自 fixed 一个——两个 fixed 会叠在一起；也别照 `.corner-tool` 抄一份按钮样式。
它返回 `{ el, setBadge(n | true | null), destroy() }`：角标 `.corner-badge` 无数字是小圆点、有数字是计数（>99 显示 99+）、
0 / null 隐藏，计数同时并进 aria-label。只想塞现成元素时仍可 `mountCornerTool(el, { order })`。

**一站式 `mountChrome()`（v0.13.0，新项目首选）**：`mountAppearance` +（`portal` 非空时）`mountAppSwitcher` + `mountAccountMenu`
+（给了 `localeToggle.locales`）`mountLocaleToggle`，同一个 `locale`。`handle.setLocale(l)` 同步全部子件（画布不重建）；
用户在语言按钮里选了新语言时，`mountChrome` 先自己 `setLocale`，再调 `localeToggle.onChange` 让应用换自己的文案 / 存偏好。
非 SSO 应用传 `portal: null`。`switcher: false` / `account: false` 可单独不挂。

**语言切换 `mountLocaleToggle({ locales, current, onChange, order = 15, labels })`**：按钮显示当前语言短名
（中 / 日 / EN），点开 `.glass.corner-panel` 列表，各语言用自己的写法列出（中文 / 日本語 / English），
同下「工具位弹层」规则。`handle.set(l)` 只同步显示、不触发 onChange。

**单独挂工具位：`corner.css`**（v0.13.0）。有自己样式体系、不加载 `components.css` 的应用（claude-bridge）
挂 `tokens.css` + `corner.css`：只含工具位、角标、`.corner-clear` 与全部工具位弹层（及弹层里用到的按钮 / chip / 开关等，
已限定在工具位与弹层内部），不含 `*` / `html` / `body` / `a` / `button` 等全局规则。它由 `scripts/build-corner-css.mjs`
从 components.css 的 `@corner:begin … @corner:end` 段落生成，`--check` 防过期。

排列方向是 token 旋钮 `--corner-tools-dir`，缺省 `row`（横向）。
紧凑布局要纵向堆叠（记账类应用那种）就在自己的 `:root` 里设 `column`，
别用同权重 CSS 去覆盖整条规则。`order` 与按钮的挂载逻辑在两个方向下同样生效。

### 工具位弹层（.corner-panel）

工具位按钮点开的面板**只有一种**：外观 / 背景参数、应用切换器、账户菜单，以及项目自己挂进工具位的按钮
（记账类应用的通知）都挂 `.glass.corner-panel`，打开时调 `claimCornerPanel(close)`。规则：

- **位置由 corner.js 实测发布**：`--corner-panel-top` / `--corner-panel-right`。横排贴在工具位下方、右缘对齐；
  纵排（`--corner-tools-dir: column`）贴在工具位**左侧**、顶端对齐——纵排时挂在下方会压住下面几枚按钮。
  用实测值不按方向写死：未登录时「登录」按钮比图标宽，写死的偏移会对不上。别在项目里再抄一套 top/right
- **不加遮罩、不锁页面滚动、不抢焦点**：锁 body 滚动会让滚动条消失、整页横向跳一下；
  这些是轻量浮层不是模态框，点外面 / Esc 关闭
- **高度随内容**，上限是视口，超出才在内部滚（背景参数只让中间参数区滚，头尾常驻）
- **底色 `--sheet-bg`**（不透明度约 0.92），比普通玻璃 `--glass-bg` 实：浮在点阵和页面内容上要读得清
- **动效只有入场 `rise`**，不滑、不淡入遮罩；`prefers-reduced-motion` 下去掉
- **同一时刻只开一个**（claimCornerPanel 互斥）

`--corner-rail-h`（工具位实测高度）仍然发布，给需要「让开这条」的其他浮层用。

### 给工具位让位（`--corner-rail-w` / `.corner-clear`，v0.13.0）

页面需为这条留出右上角空间，否则会盖住那里的操作按钮。corner.js 发布 `--corner-rail-w` = 视口右缘到工具位左缘的距离
（横排 / 纵排、未登录时更宽的「登录」、按钮增减、窗口缩放都实测重算；工具位不存在时不发布）。
全宽顶栏加 `.corner-clear`（`padding-right: calc(var(--corner-rail-w, 0px) + var(--corner-gap))`，`--corner-gap` 缺省 12px），
或直接用 `.app-header`（已内置）。**不要再写死 `padding-right: 160px` 一类的值**。
居中定宽、够不到右上角的内容列不需要让位。

### 明暗切换（.scheme-toggle）

点击循环 `auto → light → dark`，图标 🌗/☀️/🌙；auto 态右下角加一枚 accent 小圆点，
让「跟随系统」与「手动固定」一眼可分。

`mountSchemeToggle()` 来自 `@szyyw/design/scheme`，同模块还提供
`setScheme` / `cycleScheme` / `onSchemeChange`（供设置页等处双向同步），
以及 `refreshThemeColor()`（换配色等改了 `--bg` 的操作之后重算 theme-color）。

两个必须知道的点：
- **持久化用 cookie**（SSR 项目服务端要读它，才能首屏就渲染对，不闪白）。
  纯静态页可传 `persist: "localStorage"`。
- **theme-color 同步读的是 `body` 的 computed backgroundColor，不是 `--bg`**：
  自定义属性不做条件求值，直读只会拿到未展开的 `light-dark(...)` 字面量。

### 外观（.settings-toggle → .appearance-panel）

调色板排在明暗切换右边，点开工具位弹层（见上「工具位弹层」）。来自 `@szyyw/design/appearance` 的
`mountAppearancePanel()`（v0.10.0），面板根节点 `glass corner-panel settings-panel appearance-panel`，
宽度与 ≥720px 两列网格沿用 `.settings-panel`。从上到下：

- **主题行**（v0.19.0，有主题背景时）：第一个是「随机」（v0.21.0，缺省选中，提示行显示「本次：<主题名>」，§2.2），其余按注册表列出，
  名字优先用 `labels.themes`，其次注册表 / meta 的三语名；加载失败的主题 chip 置灰，原因写在 title 与下方提示行
- **配色行**：配色 chip（`.chip` / `.chip-row`），v0.19.0 起对所有主题通用；**只有一种配色时整行不出现**（v0.21.0）
- **明暗行**：跟随系统 / 深色 / 浅色。与 🌗 并列——🌗 是一键循环的快捷入口，弹层是完整设置；
  两者经 scheme.js 的事件互相同步
- **鼠标效果行**（v0.19.0，仅 `pointer: fine`）：默认 / Target Cursor；`cursor: false` 可隐藏
- **主题参数**：`<details class="appearance-advanced">` 折叠段（替代旧「背景参数」段），`summary` 用 `.ctl-label`；
  按当前主题 `meta.params` 自动生成控件（range / toggle / select / token），换主题即重建；
  nebula 时就是下面「背景参数」的全部控件与语义；「恢复默认」只作用于当前主题，「保存」在折叠段底部
- **版本行**（`dotField.update !== false`）：同下「版本检测」

v0.19.0 接口要点：

- `mountAppearancePanel({ background })`：新写法，传 `mountThemeBackground()` 的句柄；旧写法 `{ field }`（DotField 句柄）照旧可用，
  只有 nebula 的参数段、没有主题行。
- `dotField.onSave(values, info)`：`values` 仍是当前主题动过的键（nebula 时与旧版完全相同，可直接喂 `restoreDotFieldSettings`）；
  新增第二参数 `info = { theme, params, all }`（`all` = 各主题动过的参数），想按主题存服务端就用它。
  `dotField.storagePrefix`：非 nebula 主题的参数存储前缀，缺省 `szyyw:theme-params:`。
- `onChange(appearance, changed)`：`appearance` 多了 `cursor` 与 `themeParams`（当前主题动过的参数）；主题参数改动以
  `changed = ["themeParams"]` 去抖（600ms）通知一次。只读 theme / palette / scheme 的旧代码不受影响。
- `mountAppearance()` 的返回值新增 `background`（主题背景句柄）；`field` 改为 getter：当前主题是 nebula 时为 DotField 句柄，否则 null。
- 文案新增（appearance-text，zh / ja / en）：`themeParams` `cursor` `cursors.{default,target}` `unavailable` `loading`
  `themeFailed` `cursorFailed` `noParams`，`themes` 补齐六个主题名。参数控件名来自各主题 `meta.params[].labels`，
  `labels.controls[key]` 仍可逐键覆盖（说明行 `${key}Hint`）；旧 `labels.background` 若给了，作为主题参数段标题的回退。

改配色后 `setAppearance` 会调 `refreshThemeColor()`（scheme.js）重算 `<meta name="theme-color">`，不需要整页刷新。

**与 `mountDotFieldSettings` 二选一，推荐 `mountAppearancePanel`**：两者是同一枚 `.settings-toggle` 按钮、
同一个 order 20、同一份 `szyyw:dotfield` 存储，同时挂会出两枚调色板。旧 API 保留不变，
换新只需把 `mountDotFieldSettings({ field, ... })` 换成 `mountAppearancePanel({ field, dotField: { ... } })`。
设置页想放「打开外观」按钮时调 `openAppearancePanel()`（打开最近一次挂出的面板，没挂返回 false）。
外观只在工具位这一处调整，应用设置页**不再单设「外观」分组**（语言这类应用自有偏好放应用的账号设置里）。

**一站式接入 `mountAppearance()`（v0.12.0，新项目首选）**：一个调用挂齐明暗持久化、🌗、主题 / 配色持久化、
点阵背景与光斑、外观弹层，`cookiePrefix` 决定三项存储键（`appearanceCookieNames(prefix)`，服务端用同一个前缀读），
`locale` 决定内置文案；切语言调 `handle.setLocale()`，只重挂按钮与弹层，画布不重建。

图标用调色板不用齿轮：这里调的是外观/主题，齿轮会被读成系统设置。

#### 鼠标效果（`data-cursor`，v0.19.0）

外观弹层（或 `mountCursorEffect()`）挂着时，`data-cursor="target"` → 按需 `import("./target-cursor.js")` 并 `mountTargetCursor(options)`；
选回默认 → `destroy()`，系统光标与 DOM 完全恢复。只在 `pointer: fine` 下生效。加载器与选项可换：`configureCursorEffect({ load, options })`
（`mountAppearance` / `mountChrome` 的 `appearance.cursorEffect` 同义）。`getCursorEffectStatus()` → `off | loading | active | failed`；
加载失败时弹层把 Target Cursor 置灰并提示。引用计数：`setLocale` 重挂弹层不会让光标闪一下。Target Cursor 的参数见 §16。

吸附目标消失时（v0.21.0 修复）：点外观弹层的 ✕ 后按钮随弹层 `display: none`，`getBoundingClientRect()` 变成 (0, 0) 的 0×0，
旧版准星按它吸附，跑到页面左上角。现在每帧校验吸附目标：脱离文档 / 不可见（`checkVisibility`）/ 尺寸为 0 / 已不在指针下方时立即解除，
按真实指针位置重新找目标或回到自由态——关闭弹层、换路由、移除元素、`hidden` 都覆盖，不依赖 mouseleave。Target Cursor 不跟随焦点，
鼠标点击后焦点回到触发按钮不会拉动准星。

#### 背景参数（.settings-panel，`mountDotFieldSettings` 或外观弹层 nebula 主题的参数段）

实时调点阵，来自 `@szyyw/design/settings`。
v0.9.0 之前它是带遮罩、锁滚动、从右侧滑入的抽屉，已统一成和其余弹层一样。

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
没传就显示 `note`（如「访客模式 · 仅本地预览」）。v0.14.0 起 `note: true` 用内置文案（「仅保存在本浏览器」/ ja / en，随 locale），
应用不必再在自己的 i18n 里放这一句；传字符串仍原样显示。

**版本检测**：面板底部显示当前版本（来自 version.js，vendored 场景也随行），
静默比对上游最新 tag（匿名 GitHub API，60 次/时/IP，所以结果缓存 6h，
「检查更新」按钮才强制刷新）。有新版时调色板亮一枚 warn 色角标，
面板里给出 compare 链接。更新动作分两档，诚实地对应两种部署形态：

- **缺省：复制升级命令**。包是构建期依赖，浏览器改不了服务器上的
  node_modules / vendored 文件——假装能改只会做出一个骗人的按钮。
  命令可传 `command(latest)` 定制（vendored 项目传自己的 cp 流程）。
- **接了 `onUpdate` 才是真·一键更新**：由消费方服务端完成拉取/部署
  （如 portal 的 admin 端点），按钮态 更新中…→已更新 ✓，失败可重试。
  成功后按钮不复位——更新是部署动作，等页面刷新收尾。

## 6. hover 光斑（.spot）

卡片 hover 时一团 accent 色的柔光跟随指针（radial-gradient at `--mx/--my`）。
`attachSpot()` 事件委托一次挂载，动态元素自动覆盖；触摸设备与 reduced-motion 下不启用。
与 `.lift`（上浮 + 描边）可叠加：`class="glass lift spot"`。

## 7. 字体与数字

- 正文 Inter + 中文回退（PingFang SC / Hiragino / 雅黑）；15px 基准（`--fs-body`，字号刻度见 §3.1）
- 等宽 SF Mono / JetBrains Mono——终端窗、日志、代码
- **所有数字加 `.num`**（tabular-nums），金额列才对得齐
- 输入件字号 ≥16px：iOS 聚焦小于 16px 会触发页面缩放

### 标题字样（v0.18.0）

所有应用的品牌标题用同一套字样（取自门户主页左上角）：**Geist 600、`letter-spacing: -0.01em`、整行纯色 `var(--text)`**，
再由 `mountChrome` 缺省增强为 TechText 字标（§14）。

| 类 | 字号 | 用在 |
|---|---|---|
| `.app-title` | `clamp(28px, 7vw, 44px)`、`line-height: 1.1`、`margin: 0`、`text-wrap: balance` | 左上角页头标题（`.app-header > .app-brand`）；登录页想同尺寸也可直接用 |
| `.wordmark` | 不设（继承） | 登录页标题等非左上角的标题，字号由所在上下文或应用决定 |

- 不再整行渐变（v0.17.0 及以前 `.app-title` 是 700 + `--grad` 渐变）。想保留一段渐变（如域名后缀）就用子段：
  `<h1 class="app-title">example<span class="grad-text">.com</span></h1>`，TechText 会按原渐变画这一段。
- 字体：`fonts/Geist-Variable.woff2`（可变字重 100–900，SIL OFL 1.1，许可原文 `fonts/OFL.txt`，来自 npm `geist`），
  `components.css` 顶部 `@font-face` 用相对 URL `fonts/Geist-Variable.woff2`，`font-display: swap`。
  CDN（tag 的 `git archive`，含 `fonts/`）、打包器从 `node_modules` 打包、`sync.sh`（v0.18.0 起清单含 `fonts/` 子目录）都能解析；
  手动复制文件时要带上 `fonts/` 目录。字体缺失时按 `"Geist", Inter, PingFang SC, …, system-ui` 后备链回退，只是字样不同，布局照常。
- 中日文字形由后备链里的系统字体提供（Geist 只含拉丁字形），375 宽下 11 个字的标题（约 28px）放不下一行时均分成两行，不溢出。
- `corner.css` 不含标题样式，也不加载字体。

## 8. 交互约定

- 破坏性操作：二次确认（首点变红「再点一次确认」+ 展开影响范围警告），
  桌面弹层底栏里破坏性按钮靠左隔离（`.sheet-foot .danger { margin-right: auto }`）
- 弹层：手机底部抽屉（sheet-up），桌面居中卡片（rise）；关闭 ✕ 恒在右上
  - 宽版 `.sheet.wide`（v0.14.0）：桌面 760px（缺省 560px），给「大图 + 键值表」一类详情；手机仍是底部全宽抽屉
  - 无标题弹层（v0.14.0）：`.sheet-head` 里只放一枚 `.close-x`，✕ 自动靠右、头部收成按钮高（不用占位标题、不用自己写 `margin-left: auto`）：

    ```html
    <div class="overlay">
      <div class="sheet wide" role="dialog" aria-label="奖品详情">
        <div class="sheet-head"><button class="close-x" type="button" aria-label="关闭"></button></div>
        <div class="sheet-body">…大图 + <dl class="kv">…</dl></div>
        <div class="sheet-foot">…</div>
      </div>
    </div>
    ```
- 动画终帧必须 `transform: none`——fill-mode 残留 transform 会困住子孙 fixed 弹层
- 空状态：居中 emoji + 一句引导文案（`.empty`）

## 9. 终端窗（日志回放）

刻意保持深色（真实终端的样子），浅色模式也不变——用独立的 `--term-*` token。

样子在 components.css：`.term` 外框 / `.term-head` 整条可点折叠 /
`.term-dot[data-live="1"]` 实时脉冲 / `.term-bar` + `.term-lvl` 级别过滤 /
`.term-body` 等宽正文 / `.term-line` 加 `.debug|.info|.warn|.error` 分级着色
（暗 / 青 / 黄 / 红）/ `.term-copy.copied` 复制反馈 / `.term-cursor` 光标闪烁 /
`.term-lvl:disabled` `.term-copy:disabled` 熄灭态（v0.14.0：暗字、无描边、禁用光标，悬停不亮）。

行为归各项目自己接：按级别过滤、自动跟随滚动（用户上翻时暂停）、
复制后给 `.term-copy` 加 `.copied` 再撤掉。**着色用类，别再内联 `style`**。

## 10. 表单排版

`.field` 是 `width: 100%` 的输入件，**自己不留外边距**；间距一律由容器给。三种容器各管一件事：

| 类 | 管什么 | 样子 |
|---|---|---|
| `.form-row` | 一个字段：`<label>` + 控件 + 可选提示 | 块级，块底 16px（v0.28.0 起，之前 14px）；**不排版子元素** |
| `.field-row`（v0.11.0） | 一行里的「输入框 + 按钮」/ 多个小控件 | flex、`gap: 8px`、居中对齐、放不下就换行；`.field` 吃剩余宽度（基准 12rem），按钮 / `.pill` / `.chip` 不伸缩；行里有 `.field` / `.field-wrap` 时 `.btn` / `.btn-ghost`（含 `.btn-small`）拉到与输入框同高（v0.28.1，`.btn-icon` / `.pill` / `.chip` 不拉） |
| `.stack` | 纵向一串控件（无 label 的紧凑表单） | flex 纵向、`gap: 10px` |

```html
<!-- 一个字段 -->
<div class="form-row">
  <label for="name">名称</label>
  <input id="name" class="field">
</div>

<!-- 输入框 + 按钮一行（可与 .form-row 叠加，保留块底 16px） -->
<div class="form-row field-row">
  <input class="field" placeholder="新用户名">
  <button class="btn btn-small">新增</button>
</div>

<!-- 带标签的一行：标签在行内时自动去掉块级 + 下边距 -->
<div class="field-row">
  <label for="q">筛选</label>
  <input id="q" class="field">
  <button class="btn-ghost btn-small">清除</button>
</div>
```

- **别把按钮直接放进只有 `.form-row` 的块里当「同一行」**——`.form-row` 不是 flex，
  100% 宽的输入框会把按钮挤到下一行。v0.11.0 起这种写法会自动在两者之间补 8px（不再贴死），
  但要同一行就加 `.field-row`。`.form-row` 里两个控件上下相邻同理补 8px。
- `.row`（`gap: 10px`，不换行）/ `.row.wrap` / `.spread` 仍可用于一般横排；输入框 + 按钮优先 `.field-row`，
  它额外处理了伸缩与行内 `label`。
- 一排同级操作按钮用 `.actions`（`margin-top: 16px`、`gap: 10px`、换行）。
- 禁用的 `.btn` 是实底「熄灭」态（`--inner-bg` + 描边），不是半透明渐变——半透明紫挨着输入框看着像粘连。
  项目给 `.btn` 加了自己的底色变体（如 `.btn.danger { background: … }`）时写成 `:not(:disabled)`，
  否则禁用态会被盖成可点的样子。
- 开关 `.switch`（v0.19.0 Squish 动效、可选拖动增强）与下拉 Glide Select（原生 `<select>` 的渐进增强）见 §16。

## 11. 公开类与内部类

**公开 API**（项目可以直接写在自己的标记里，跨版本保持语义；改动会进 CHANGELOG 并按 semver 处理）：

- 布局：`.app-frame` `.app-main`（v0.25.0）`.bg-layer` `.row` `.spread` `.stack` `.wrap` `.field-row` `.actions` `.divider` `.section` `.section-name` `.section-head`
- 容器：`.glass` `.panel` `.inner` `.lift` `.sheet` `.sheet-head` `.sheet-title` `.sheet-body` `.sheet-foot` `.overlay` `.close-x`
- 表单：`.field` `.form-row` `.form-grid` `.chip` `.chip-row` `.switch` `.err-text` `.ok-text`
- 按钮：`.btn` `.btn-ghost` `.btn-small` `.danger`
- 文本 / 数据：`.page-title` `.page-sub` `.panel-title` `.panel-head` `.grad-text` `.link` `.muted` `.small` `.tiny` `.num` `.mono`
  `.pill`（+ 色：`cyan` `violet` `green` `red` `amber`，v0.14.0 加 `slate` `pink`）`.amt-*` `.stat-*` `.bar` `.bar-fill` `.tbl` `.table-wrap` `.empty` `.term*`
- 动效：`.rise` `.stagger` `.shake` `.spot`
- 工具位：`.corner-panel`（项目自己的工具位弹层挂它 + `claimCornerPanel`，见 §5）；
  v0.13.0 起 `.corner-tool`（工具位按钮外观）、`.corner-badge`（角标）、`.corner-clear`（让位）也是公开 API
- v0.13.0 新增（§12）：`.warn-text` `.hint` `.callout`（`.ok/.warn/.err/.info`）`.tabs` `.tab`（`.compact` `.scroll`）`.seg`
  `.toast-region` `.toast` `.field.small` `.spinner`（`.lg`）`.tbl.sticky` `.tbl.hover` `th[aria-sort]` `th.sorted` `.col-num`
  `.menu-wrap` `.menu`（`.start` `.up`）`.menu-item` `.menu-sep` `.kv` `.drawer`（`.left`）`.drawer-head` `.drawer-body` `.drawer-foot`
  `.app-header` `.app-brand` `.app-title` `.app-sub` `.app-actions`；token `--chart-1…6` `--pop-shadow` `--on-err` `--corner-gap`
- v0.14.0 新增：`.sheet.wide`、无标题 `.sheet-head`（只含 `.close-x`）、`.term-lvl:disabled` `.term-copy:disabled`、`.pill.slate` `.pill.pink`；
  token `--slate` `--pink` `--tint-slate-bg` `--tint-pink-bg`
- v0.17.0 新增（§15）：`.field-wrap` `.field-clear` `.u-*` 工具类 `.w-sm/.w-md/.w-lg` `.sub-hint` `.inset-list` `.row-hover` `.chip-group` `.chip-group-label` `.field-inset` `.field-inset-btn` `.icon-grid` `.icon-cell` `.btn-icon` `.msg-list` `.msg-item` `.msg-dot` `.msg-text` `.msg-title` `.msg-body` `.msg-time` `.back-link`；JS `./overlay`（`mountOverlay`）
- v0.18.0：`.app-title` 改为新标题字样（§7「标题字样」，有意的可见变化），新增 `.wordmark`（同字样、不设字号）；
  `components.css` 新增 `@font-face "Geist"`（`fonts/`）；`mountChrome` 的 `techText` 缺省开启（`.app-title, .wordmark`，跟进后插入的元素）
- v0.19.0 新增（§16）：`.glide-select`（`__trigger` `__label` `__chevron` `__menu` `__list` `__group` `__group-label` `__pill` `__option` `__name` `__tag` `__check`）
  `.glide-native` `.status-mark`（`__glyph` `__track` `__ring` `__check` `__cross` `__label` `__strike` `__sr`）
  `.lattice-loader`（`__grid` `__layer` `__run` `__mark` `__cell` `__label` `__text` `__timer` `__sr`）`.branched-menu*`；
  `.switch.is-dragging`（switch.js 拖动中）；toast 卡片内部结构 `.toast-slot` `.toast-gate` `.toast-icon` `.toast-body` `.toast-title` `.toast-text` `.toast-action` `.toast-close` `.toast-fuse`；
  属性 `html[data-cursor]`、`data-glide` `data-status` `data-gradual-blur`、`data-cursor-label`；token `--th-*`、`--sw-*`；
  JS `./theme-background` `./themes` `./themes/<id>` `./target-cursor` `./gradual-blur` `./branched-menu` `./switch` `./glide-select` `./status-mark` `./lattice-loader`
- v0.22.0 新增（§13.2）：`.page-head.sticky` `.section-head.sticky`（`.page-head` 必须带 `.sticky`）；属性 `data-stuck` `data-covered`（sticky-heads.js 写）；
  token 旋钮 `--sticky-top` `--sticky-page-h` `--sticky-clear`；JS `./sticky-heads`（`mountStickyHeads`）；`mountGradualBlur` 新选项 `outside`
- v0.23.0（§12.1）：`.tabs` / `.seg` 改为滑块分段外观（类名不变）；`.seg.compact`；token `--seg-*`；属性 `data-pill` `data-pill-on` `data-pill-ready`
  与轨道上的 `--tab-pill-x/y/w/h`（tabs.js 写，应用不要手写）；JS `./tabs`（`enhanceTabs` `TABS_SELECTOR`）、`mountChrome({ tabs })` 与 `handle.tabs`
- v0.28.0 新增（§3.1）：`.field-msg`（`.err`）`.field.invalid` / `.field[aria-invalid="true"]` `.btn.danger`（实底）；空 `.close-x` / `.field-clear` 自动画 x；
  token 刻度段 `--fs-*` `--lh-*` `--r-*` `--h-*` `--sp-*` `--focus*` `--dur-*` `--blur-*` `--ease-out`，语义 `--info` `--tint-info-bg` `--danger`，状态 `--hover-border` `--selected-bg` `--selected-border`
- v0.29.0 新增（§16.3）：`.list`（`.divided` `.gap` `.bleed` `.compact`）`.list-row`（`.selected` `.compact`）`.row-lead` `.row-main` `.row-title` `.row-sub` `.row-end` `.row-chevron` `.avatar`（`.sm`）
  `.disclosure`（`.lead-chevron` `.flush`）`.disclosure-summary` `.disclosure-body` `.summary-meta` `.armed` `.sheet.confirm` `.confirm-message`
  `.dot`（`.ok` `.warn` `.err` `.info` `.idle` `.pulse`）`.dot-label` `.badge-dot` `.badge`（`.neutral` `.float`）、`.pill` 语义名 `.ok` `.warn` `.err` `.info` `.neutral` 与可点 `button.pill` / `a.pill`、`.count`
  `.bar` 语义 `.ok/.warn/.err/.info` `.bar.stacked` `.bar-seg` `.bar-mark` `.bar.indeterminate` `.meter` `.meter-head` `.meter-label` `.meter-value`
  `.field-wrap.search` `.chip-row.scroll` `.filter-bar` `.filter-meta` `.auth-shell` `.auth-card` `.auth-sub` `.auth-foot`；token `--h-item` `--dot`；CSS 变量 `--w` `--c` `--at`；
  JS `./confirm`（`armConfirm` `confirm` `CONFIRM_TEXTS`）`./disclosure`（`mountDisclosure` `enhanceDisclosures`）
- v0.30.0 新增（§16.4）：`.steps`（`.vertical` `.horizontal` `.scroll` `.compact`）`.step`（`.done` `.current` / `[aria-current=step]` `.err` `.blocked`）`.step-marker` `.step-body` `.step-title` `.step-sub` `.step-desc` `.step-end`
  `.timeline`（`.compact`）`.timeline-item`（`.current` `.muted` `.err`）`.timeline-main` `.timeline-head` `.timeline-title` `.timeline-time` `.timeline-desc`
  表格：`.th-sort` `tr[aria-selected]` `tr[tabindex]` `tr.ok/.warn/.err/.info/.idle` `tr.total` `tr.empty-row` `.tbl.compact` `.tbl.numeric` `.tbl.reflow`（`td[data-label]`）`.col-sticky` `.col-actions` `.table-wrap.bleed`
  `.thumb-strip`（`.sm` `.lg` `.wrap`）`.thumb-grid` `.thumb-tile`（`.selected` `.loading` `.error`）`.thumb-more` `.thumb-add` `.thumb-remove` `.choice-group` `.choice-card` `.choice-body` `.choice-title` `.choice-sub` `.choice-img`
  `.stat`（`.ok` `.warn` `.err` `.info` `.compact`）`.stat-unit` `.stat-foot` `.stat-trend`（`.up` `.down` `.flat` + 色）`.kv.end` `.kv.compact` `.copyable` `[data-copy]` `[data-copied]`
  `.action-bar`（`.sticky`）`.action-bar-text` `.action-bar-actions` `.list.multiline` / `.list-row.multiline` `.list.dense` / `.list-row.dense` `.row-lead.lg` `.avatar.lg`
  可点胶囊选中 `button.pill[aria-pressed=true]` `.empty-title` `.empty-desc` `.empty-actions` `.empty.compact` `.term-follow` `.confirm-ack`；
  CSS 变量 `--stat-min` `--thumb` `--thumb-min` `--thumb-ratio` `--action-bar-offset` `--action-bar-w`（应用设）与 `--action-bar-space`（包写，可读）；
  JS `./copy`（`copyText` `mountCopy` `enhanceCopyButtons` `COPY_TEXTS`）`./table`（`enhanceSortTable`）、`confirm({ ack })`；`--mask-*` 是内部变量，别引用
- v0.31.0 新增（§16.5、§15）：`.thumb-strip-empty`（`.sm` `.lg`）`.sheet-grabber`；属性 `data-lightbox-src` `data-lightbox-thumb` `data-lightbox-w` `data-lightbox-h` `data-lightbox-group`，
  `data-drag-close` `data-dragging`（overlay.js 写在 `.sheet` 上）；CSS 变量 `--lightbox-h`；JS `./lightbox`（`openLightbox` `enhanceLightbox` `LIGHTBOX_TEXTS`）、`mountOverlay({ dragClose })` 与 handle 的 `dragBy` `release`
- v0.24.0 新增（§16）：`.depth-carousel` 及其 `__*` 子类与状态类、CSS 变量 `--dc-height` `--dc-min-height` `--dc-tint` `--dc-fit`；JS `./depth-carousel`（`mountDepthCarousel`）
- v0.15.0 新增（§14）：JS `./techtext`（`mountTechText` `enhanceTechText` `DEFAULTS`）、`mountChrome({ techText })` 与 `handle.techText`；
  类 `.tech-text`（JS 加在被增强的元素上，可用来写选中色等外观）。`.tech-text-canvas` 是内部实现，别套用

**内部实现**（只给包里的 JS 组件用，结构和定位随版本变，**项目不要借用这些类名去套自己的元素**，
也不要在自己的 CSS 里覆写）：

- `.settings-panel` `.settings-toggle` `.appearance-*`（含 v0.19.0 的 `.appearance-status`）`.theme-param-choice` `.panel-body` `.panel-foot` `.ctl*` `.update-*`
  （外观 / 背景参数弹层；v0.9.0 把 `.settings-panel` 的定位挪给 `.corner-panel`，借用它的门户抽屉因此摊到了页面底部）
- `.lightbox` `.lightbox-*`（v0.31.0 原图查看器的结构，lightbox.js 生成；只有 `--lightbox-h` 是可调的）
- `.corner-tools` `.scheme-toggle` `.locale-toggle` `.locale-menu*` `.app-switcher*` `.account-*` `.guest-note`
  （`.corner-tools` 容器由 corner.js 管，别手写；按钮用 `createCornerButton`）

项目自有样式**别重名**公开类（例如自己的页面容器叫 `.wrap`、自己的 `.form-row` 写成 flex）：
同名规则会和包里的规则叠加，包一升级就可能出现意料外的布局。要改公开类的样子，用自己的修饰类
（`.form-row.my-inline`）或包一层自己的容器类，不要整条重写。

## 12. v0.13.0 公开组件

全部是新类 / 新属性，旧标记不受影响。手测页 `demo/components-v013.html`（light / dark、zh / ja / en、375 宽）。
下面「替代」一栏是应用里现有的自写实现，迁移时删掉自写、换成包里的。

| 组件 | 用法 | 替代 |
|---|---|---|
| `.warn-text` | 与 `.ok-text` / `.err-text` 同一族（13px、`--warn`） | cosme / 某表单类应用自写 `.warn-text` |
| `.hint` | 字段下方提示：12px、`--text-dim`、上边距 4px（v0.28.0；校验信息用 `.field-msg`，§3.1） | jppost / 某表单类应用自写 `.hint`、内联 `tiny muted` |
| `.callout` + `.ok/.warn/.err/.info` | 提示条：tint 底 + 同色描边；首个 `<strong>` 着语义色；info 用 `--info`（v0.28.0 起，之前跟 accent） | 各处内联 style 的提示块 |
| `.tabs > .tab` | 选中 `.active` 或 `[aria-selected="true"]`；`.tabs.compact` 紧凑；`.tabs.scroll` 不换行横滚（v0.23.0 起外观见 §12.1） | jppost / 某看板类应用 `.nav-tabs .tab`（样子一致）、portal `.tab-bar .tab-btn` |
| `.seg > button` | 分段控件，选中 `.active` 或 `aria-pressed="true"`（v0.23.0 起与 `.tabs` 同一外观，§12.1） | 某看板类应用 `.mode-switch`、portal `.lay-seg`（cosme 的 `.acct-seg` 是账号进度条的色段，不是分段控件，不在此列） |
| `toast()`（toast.js） | `toast(msg, { tone, timeout })`，底部居中堆叠、aria-live；有底部导航时设 `--toast-offset`。v0.19.0 起为 Swipe Toast（下滑关闭，§16） | portal `toast.jsx`、某控制台类 / 看板类应用 `.toast` |
| `.field.small` | 紧凑输入（md 档 36、14px）；触屏 / ≤640px 仍 16px 防 iOS 缩放，触屏最低 40 | portal `.field-small`、某看板类应用 `select.field.small` |
| `.field:disabled` / `.switch:disabled` | 熄灭态 | — |
| `.spinner`（`.lg`） | 跟随文字色与字号；减少动效时停转但可见 | 各自的「加载中…」文字 / 自写转圈 |
| `.tbl.sticky` | 表头吸顶；放在 `.table-wrap` 里，wrap 自动限高 `--table-max-h`（缺省 70vh）并纵向滚动 | — |
| `.tbl.hover` | 行悬停着色 | — |
| `th[aria-sort]` / `th.sorted` | 可排序列箭头（none ↕ / ascending ↑ / descending ↓），`.sorted` 高亮 | 自写排序箭头 |
| `.col-num` | 数字列：右对齐 + 等宽数字（th、td 都加） | 某看板类应用 `.r.num`、某记账类应用 `.data-tbl .num` |
| `.menu-wrap > .menu > .menu-item`（+ `attachMenu`） | 行操作 ⋯。在 `.table-wrap` / `.glass` 里必须用 menu.js 的 `attachMenu`（打开时搬到 body 下 fixed，不被裁切） | 某看板类应用 `.menu` + 自写定位 |
| `dl.kv` | 键值列表；≤520px 上下排 | cosme `.kv`、某看板类应用 `#set-status .kv` |
| `.drawer` | 右侧抽屉（`.drawer-head/.drawer-body/.drawer-foot`），开合用 `hidden`；手机全宽；旋钮 `--drawer-w` / `--drawer-top` | portal `.portal-drawer` + `.drawer-body/.drawer-foot` |
| `.app-header` | 页头：`.app-brand`（`.app-title` + `.app-sub`）+ `.app-actions`，右侧自动让位工具位、可换行 | 四个应用自写的 `.brand-title` / `.brand-sub` / 顶栏 padding |
| `--chart-1…6` | 图表分类色，随配色与明暗 | 应用里写死的图表色板 |
| `--pop-shadow` | 浮层阴影（菜单 / 抽屉 / toast） | 硬编码 rgba 阴影 |

几条注意：

- v0.14.1 起 `components.css` 带全局 `[hidden] { display: none !important }`：`.overlay` / `.stack` / `.callout` 等自带 `display` 的类加 `hidden` 也会隐藏，应用不必再逐个补兜底（只挂 `corner.css` 的应用不含这条，工具位组件各自处理了 `[hidden]`）。
- 抽屉想让右上角工具位露出来：`--drawer-top: calc(10px + var(--corner-rail-h, 36px) + 12px)`。
- `.menu` 纯 CSS 版本只适合不在滚动容器 / 玻璃卡里的场景；表格行操作一律 `attachMenu`。
- `.tbl .num` 不改对齐（已有表格用 `.num` 标日期等，改了会跳）——数字列右对齐用 `.col-num`。
- `.spinner` 的旋转是匀速 `linear`，是唯一不走 `--ease` 的动效（等待语义）。
- 阴影 token 一律拆成「颜色 token（`light-dark()`）+ 固定几何」：`light-dark()` 只接受颜色，整条阴影塞进去会算成 `none`
  （v0.13.0 及之前 `--lift-shadow` 就是这样，`.lift:hover` 的投影从未生效，v0.13.1 修正）。浮层用 `--pop-shadow`。

## 12.1 滑块分段：标签页与分段控件（v0.23.0）

所有标签页与分段切换统一用 `.tabs > .tab` 或 `.seg > button|a`，**应用不再自写标签条**（`.chip` / 链接组当标签页、自写 `.nav-tabs` 都换掉）。
手测页 `demo/tabs.html`（`?js=0` 纯 CSS、`?scheme=light`）。

- **外观**：浅底圆角轨道（`--seg-track`，高 36px、内距 4px、圆角 12px），各段 28px 高、圆角 8px、14px / 500、未选中 `--seg-muted`（v0.28.0 起按 §3.1 刻度）；
  选中项是一块凸起的滑块（`--seg-raised` + `--seg-raised-shadow`，文字 `--seg-text`），悬停浅底 `--seg-hover`，按下 `scale(.97)`，
  `:focus-visible` 为统一焦点环（向内收 2px，横滚时不被裁）。段内可放 16px 的 `<svg>` 图标（间距 7px）。`.compact`（`.tabs` / `.seg` 都有）轨道 28px、段 24px、13px。触屏下缺省档轨道 40px。
- **`.tabs` 与 `.seg` 的差别只在布局**：`.tabs` 是块级、宽度随内容（`fit-content`），放不下换行（`.scroll` 改横滚）；≤767px 撑满一行、各段均分。
  `.seg` 是内联、超出横滚，窄屏不撑满（它常嵌在工具条 / 行内）。
- **纯 CSS 即完整可用**：选中项自己画凸起底。挂了 `tabs.js`（`mountChrome` 缺省挂）后轨道带 `[data-pill]`，选中项的底与阴影去掉，
  改由轨道 `::before` 画一块滑块，按 `--tab-pill-x/y/w/h` 定位、选中变化时 0.38s `--ease` 滑过去；首次测到位置才加 `[data-pill-ready]`（才有过渡），
  首帧不会从 0 滑入；`prefers-reduced-motion` 下无过渡。滑块在轨道内绝对定位，`.scroll` 横滚时随内容滚动；换行的 `.tabs` 也按行定位。
- **JS `enhanceTabs(root?) → { refresh(), destroy() }`**（`@szyyw/design/tabs`）：不插入任何子节点（React / Vue 管理的子节点列表不受影响），
  只在轨道上写属性与 CSS 变量。选中项 = 轨道直接子元素中带 `.active` / `[aria-selected="true"]` / `[aria-pressed="true"]`、未 `hidden` 的第一个；
  选中态始终由应用自己改，本模块只跟随：MutationObserver 跟进轨道增删与选中 / hidden / disabled / class 变化（框架只改 `aria-selected` 也算），
  ResizeObserver 跟进轨道与各段尺寸（文字变化、窗口缩放、隐藏面板显示出来），`document.fonts` 加载完重测。`destroy()` 清掉写过的全部属性与变量。
- **`mountChrome({ tabs })`** 缺省开启（范围 document），`tabs: false` 关闭、`{ root }` 限定范围；`handle.tabs` 是返回的 handle，`chrome.destroy()` 一并撤销。
- **应用不要覆写** `.tabs` / `.tab` / `.seg` 的 padding、高度、字号、背景、边框与圆角：要更矮用 `.compact`；要放进玻璃卡就把 `.glass` 加在外层容器上，
  不要加在轨道自己身上（会叠出两层底）。只改外边距、`flex` 这类排布属性没问题。

## 13. v0.14.0 补充

迁移 cosme 等应用时发现的缺口，全部纯新增（例外：头里只有 ✕ 的 `.sheet-head` 之前 ✕ 靠左，现在靠右、头部变矮）。
手测页 `demo/components-v014.html`。

| 件 | 用法 | 替代 |
|---|---|---|
| `.sheet.wide` | 桌面 760px 的宽版弹层；手机仍是底部全宽抽屉 | cosme 奖品详情自写的弹层宽度 |
| 无标题 `.sheet-head` | 头里只放 `.close-x`：✕ 靠右，头部只有按钮高（见 §8 示例） | 占位空标题、自写 `margin-left: auto` |
| `.term-lvl:disabled` / `.term-copy:disabled` | 终端窗里暂不可用的级别 / 复制键 | 自写的 opacity / pointer-events |
| `.pill.slate` | 中性灰蓝，表示「未知 / 未定」；和默认 `.pill`（无底色）、`amber`、`violet` 分得开 | cosme「未知模式」自写色 |
| `.pill.pink` | 第六种状态色，和 `red` / `violet` 拉开色相 | 自写粉色胶囊 |
| `dotField.note: true` | 外观弹层页脚「仅保存在本浏览器」，内置 zh / ja / en（`appearanceText().localOnly`，可用 `labels.localOnly` 改词） | 应用 i18n 里的 `localOnly` / 「参数仅保存在本浏览器」 |

`--sheet-bg` 未改：375 宽、背后密集文字实测，遮罩模糊 + 92%/94% 底色下弹层空白区的亮度起伏只有约 2/255，
背后文字不可辨。只有 `backdrop-filter` 失效时（不支持、或弹层被放进另一个带 `backdrop-filter` / `filter` 的祖先里，
遮罩模糊作用不到）起伏升到约 8/255、能看出字形——弹层务必按 §3 用 Portal 挂到 body 下、配 `.overlay`。

## 13.1 分区标题行 `.section-head`（v0.16.0）

「小标题 + 右侧操作按钮」的行用 `<div class="section-head"><h3 class="section-name">…</h3><button class="btn btn-small">…</button></div>`。
原因：`.spread` 只有 flex 排版，`.section-name` 自带下边距（v0.28.0 起 12px）在 flex 里只作用于标题，管不到按钮，
按钮会贴着下方内容；窄屏标题与按钮换行时也无行距。`.section-head` 行下留 12px、换行间距 8px 12px，内部 `.section-name` 边距归零。
勿用裸 `.spread` 后紧跟内容；纯新增，`.spread` / `.section-name` 行为不变。

## 13.2 吸顶标题 `.page-head.sticky` / `.section-head.sticky`（v0.22.0）

长页面（账户详情一类）：标题行往下滚时吸顶；页面分几块时每块的小标题也吸顶，叠在标题行下方，滚到哪块显示哪块；
吸住时滚进标题区域的内容被玻璃底模糊（标题下方不加模糊带）。手测页 `demo/sticky-heads.html`（`?topbar=1` / `?js=0` / `?blur=1` 外侧模糊带）。

```html
<div class="stagger">
  <div class="page-head sticky">
    <a class="back-link" href="…">← 账户</a>
    <h1 class="page-title">账户名</h1>
    <button class="btn btn-small">设置</button>
  </div>
  <section>
    <div class="section-head sticky"><h2 class="section-name">余额与同步</h2></div>
    …
  </section>
  <section class="section">
    <div class="section-head sticky"><h2 class="section-name">流水明细</h2><button class="btn-ghost btn-small">…</button></div>
    …
  </section>
</div>
```

- **分块要包容器**：`sticky` 只在父容器范围内生效。每块包一层（`<section>` / `.section`），小标题是它的**第一个子元素**；
  下一块上来时上一块的小标题被自己的容器带走——「滚到哪块显示哪块」就是这么来的，不用 JS。
- **`.page-head` 单用没有样式**（已有应用写过 `.app-header.page-head` 修饰类），一定与 `.sticky` 一起写。
  标题行一行排下：`.page-title` 吃掉剩余宽度、过长省略，`.back-link` / 按钮不压缩；`min-height: 52px`，高度因此稳定。
- **旋钮**（应用 `:root` 里设，或交给 JS 实测）：
  - `--sticky-top`：标题行吸在哪，缺省 0。应用自己有 sticky / fixed 顶栏（手机顶栏一类）时设成顶栏高度，或用 `mountStickyHeads({ offset })` 实测。
  - `--sticky-page-h`：标题行高度，小标题吸在 `--sticky-top + --sticky-page-h`。页面有 `.page-head.sticky` 时 CSS 缺省 52px（无 JS 也对得上），JS 实测后覆盖。
  - `--sticky-clear`：吸顶行右侧让位，缺省 0。工具位纵排（`--corner-tools-dir: column`）会压住吸顶行右端时设
    `calc(var(--corner-rail-w, 0px) + var(--corner-gap) - <页面右内边距>)`，只在会压住的断点设。
- **玻璃底**：`color-mix(--bg 72%)` + `blur(14px)`，画在 `::before` 上——元素自己带 `backdrop-filter` 会成为 backdrop root，
  里面的模糊带就糊不到外面滚过的内容。同理，`.stagger` / `.rise` 的 both 填充会让元素一直是 backdrop root，
  包里已把吸顶标题及其所在块改为 backwards 填充（入场看起来一样）；**别把吸顶标题放进带 `filter` / `opacity < 1` / `backdrop-filter` 的祖先里**。
- **可选 JS `mountStickyHeads({ root, offset, blur }) → { refresh(), destroy() }`**（`@szyyw/design/sticky-heads`）：
  一个应用挂一次（外壳里），换页由 MutationObserver 跟进。做三件事：实测 `--sticky-page-h`（与 `offset` 给的顶栏高度 → `--sticky-top`，
  `display: none` 时为 0，断点切换自动对）；写 `data-stuck="1|0"`（没吸住时玻璃底隐去，看起来就是普通标题）与标题行的 `data-covered`
  （有小标题吸在下面时标题行的模糊带让位）。**模糊只发生在标题区域里**：内容滚进标题时被标题自己的玻璃底模糊，
  标题下方的正文保持清楚。下沿外侧的 Gradual Blur 带（`mountGradualBlur(el, { outside: true })`）v0.22.1 起**缺省不挂**，
  `blur: true` / 参数对象才挂（v0.22.0 缺省挂，会糊住最下层标题下方的正文、并压在吸上来的小标题上）。实测高度向下取整、
  小标题玻璃底上沿多盖 1px，两层标题之间不留缝。v0.22.2 起玻璃底横向铺满视口（JS 实测元素到视口两边的距离写进
  `--sticky-bleed-l/-r`，侧栏等更高层的固定元素盖在它上面），最下面一层吸住的标题底边一条 `--line-soft` 细线。只跟页面（window）滚动。
  不挂 JS 时退化为纯 CSS：照样吸顶，玻璃底常驻、没有模糊带。
- **层级**（§3）：标题行 21、小标题 20，都在内容层里，低于应用顶栏（30）、底部导航（40）、工具位（45）与一切弹层，
  菜单 / 抽屉 / sheet 照旧盖得住它们。
- **移动端 / iOS Safari**：`position: -webkit-sticky` 在前；`backdrop-filter` 前写 `-webkit-backdrop-filter`；
  吸顶的祖先不能有 `overflow: hidden / auto`（会把吸顶限制在那个容器里），`overflow-x: clip` 可以。

## 15. 通用工具类与布局契约（v0.17.0）

**原则：通用样式缺陷修设计包，不在应用里补。** 应用里自己写的 month 输入修正、遮罩关闭逻辑、返回条、消息列表之类，
只要别的站也会遇到，就下沉到这里；应用侧只留业务语义。以下全是纯新增（month iOS 修复除外），手测页 `demo/utilities.html`。

- **month 输入**：`input[type="month"].field` 与 date / datetime-local 同款处理（`appearance: none`、`min-width: 0`、`max-width: 100%`、
  文字左对齐、`::-webkit-date-and-time-value` 左对齐）。这是缺陷修复，并排的 month 不再被 iOS 固有宽度顶出、截断。
- **清除键** `.field-wrap` + `.field-clear`：输入框内最右侧的 ✕，可点区域不小于 32px；有清除键时输入框右内边距自动让位。
  `<div class="field-wrap"><input type="month" class="field"><button type="button" class="field-clear" aria-label="清除"></button></div>`（留空自动画 x，v0.28.0）。
  值为空时由应用不渲染 / `hidden` 清除键。
- **工具类**（统一 `u-` 前缀，因部分应用已有 `.tbl.clickable`）：`.u-m0`；`.u-mt-1/2/3/4`、`.u-mb-1/2/3/4`（4/6/8/12px）；
  `.u-gap-1/2/3/4/6`（2/4/6/8/12px，写在 `.row/.stack/.spread` 之后且有复合选择器，**能压过它们固定的 10px**）；
  `.u-ai-center` `.u-ai-start` `.u-jc-between` `.u-nowrap` `.u-flex-none` `.u-flex-1`（`flex: 1 1 0` + `min-width: 0`）`.u-min-w-0`
  `.u-clickable` `.u-fw-600` `.u-fw-400` `.u-block` `.u-ta-right`。用于一次性微调，别拿它们搭整页布局，重复出现的组合应成为语义类。
- **字段限宽** `.field.w-sm / .w-md / .w-lg`（130 / 160 / 200px）：`max-width` 语义，窄屏收缩不溢出。
- **`.sub-hint`**：紧跟 `h3` / `.panel-title` 的说明段（上拉 6px、下留 8px）。不改 `.panel-title + *` 的既有行为。
- **`.inset-list` + `.row-hover`**：可点击行列表拉到卡片内边距外，hover 背景铺满卡片宽。`--inset` 缺省 16px（= `.panel` 的 padding，v0.28.0 起，之前 18px），
  卡片 padding 不同就在 `.inset-list` 上改该变量；行内容仍与卡片内容对齐。
- **`.chip-group` + `.chip-group-label`** + `.chip-row`：行首标签 + 胶囊，≤520px 标签单独占一行。
- **`.field-inset` + `.field-inset-btn`**：输入框内嵌图标触发钮；**`.icon-grid` + `.icon-cell`**：auto-fill 图标网格；分类标签条复用 `.tabs.scroll`。
- **`.btn-icon`**（`.xs` 更小）：小型方形图标按钮，28×28（`.xs` 24×24，v0.28.0）。
- **`.msg-list` / `.msg-item`**：消息列表。`.msg-item.unread` 为未读（没有则标题不加粗、圆点淡化）；`.msg-dot`（`.warn` `.err`）、
  `.msg-text` 内放 `.msg-title` `.msg-body` `.msg-time`。
- **`.back-link`**：页首返回条（`<a class="back-link" href="…">← 返回</a>`）。凡不在手机底栏的页面都应有。
- **`mountOverlay(overlayEl, { onClose, lockScroll = true }) → { destroy() }`**（`@szyyw/design/overlay`）：遮罩点击关闭要求按下与松开都落在遮罩本身
  （拖选文字松手在遮罩上不误关）；嵌套弹层的 body 滚动锁引用计数；Esc 只关最上层；模块顶层不碰 DOM。
  它不搬动 / 移除元素，`onClose` 里由应用卸载并 `destroy()`。
- **底部抽屉下拉关闭（v0.31.0）**：`mountOverlay(overlay, { onClose, dragClose: true })` + 抓手 `.sheet-grabber`（放在 `.sheet` 第一个子元素）。
  ≤899px（`.sheet` 是底部抽屉）时，从上沿（抓手 + `.sheet-head`，其中的按钮 / 链接 / 输入框除外）往下拖：卡片跟手、遮罩随位移变淡；
  松手时下拖超过卡片高 30%（最多 200px）或快速下甩 → 卡片滑出屏幕后调 `onClose`，否则弹回（`--dur-base` / `--ease-out`，reduced-motion 下无动画）。往上拖只有一点阻尼位移。
  宽屏（居中弹窗）下抓手隐藏、拖动不生效。`dragClose: { sheet?, handle? }` 可指定卡片元素与拖动区选择器（缺省第一个 `.sheet`、`.sheet-grabber, .sheet-head`）。
  返回的 handle 多两个方法：`dragBy(dy)`（组件把自己区域里的下滑接进来，返回是否生效）、`release(dy, velocity?)`（返回是否判定为关闭）——`./lightbox` 没放大时在图上竖向下滑就是这样接的。
  JS 在卡片上写 `data-drag-close`（头部 `touch-action: none`）与拖动中的 `data-dragging`。**不给 `dragClose` 时行为与外观完全不变**；`onClose` 应把弹层移除（不移除时卡片会复原）。

```html
<div class="overlay">
  <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="t1">
    <div class="sheet-grabber" aria-hidden="true"></div>
    <div class="sheet-head"><h2 class="sheet-title" id="t1">筛选</h2><button class="close-x" aria-label="关闭"></button></div>
    <div class="sheet-body">…</div>
  </div>
</div>
<script type="module">
  import { mountOverlay } from "@szyyw/design/overlay";
  const ov = mountOverlay(overlay, { dragClose: true, onClose: () => { ov.destroy(); overlay.remove(); } });
</script>
```

## 15.1 居中主体栏 `.app-main`（v0.25.0）

「定宽居中、两侧留空」的那一栏统一用它，不再各自写 `max-width + margin: 0 auto` 的容器：

```html
<div class="bg-layer"></div>
<div class="app-frame">
  <header class="app-header">…</header>
  <main class="app-main" style="--page-max-w: 980px">…</main>
</div>
```

- 自带一层半透明底 `--page-veil`（暗 `rgba(11,16,32,.52)` / 浅 `rgba(238,241,248,.62)`）：压住背景主题、托起正文与卡片之间的文字，仍透出一点背景；
  明暗两种模式都生效。左右边缘在内距里渐隐（`--page-veil-fade`，缺省 32px）；≤640px 铺满宽度、不渐隐，不产生横向滚动。
- 旋钮：`--page-max-w`（缺省 1080px）、`--page-pad-x`（左右内距，缺省 24px，≤640px 为 16px）。上下内距由应用自定（`.app-main` 不设 padding-block）。
- 底层画在 `::before`（z-index -1），不新建层叠上下文：`.drawer` / `.sheet` / `.overlay` / `.corner-panel` 等 fixed 浮层与
  `.page-head.sticky` / `.section-head.sticky` 吸顶标题的层级都照旧（§3）。顶栏给工具位让位仍用 `.corner-clear` / `--corner-rail-w`。
- `.app-frame` 与 `.app-main` 分两层写：别把两个类放在同一个元素上（`.app-frame` 是内容层，`.app-main` 是其中居中的一栏）。
- 带侧栏、主体偏移的布局（如桌面左侧栏）不要用它。手测页 `demo/app-main.html`（`?veil=0` 为没有半透明底的对照组）。

## 14. TechText 字标（v0.15.0）

`./techtext`：把已有标题（通常左上角 `.app-title`）渐进增强成 canvas 字标，行为对齐 React Bits 官方演示：
**一次只揭示一个字母**——光标（或无指针时自动往复的扫描点）下的那个字母换成虚线描边（只留字形外侧那半条描边），
配选框、四角、闪烁 specks 与尺寸标注；没有指针时扫描点按上游的 cos 轨迹在文字上左右往复，选框因此**一个字一个字地跳**。
字母可以拖离基线，松手弹簧回位（拖走时原位留一个虚线影子与连线，标注显示位移）。手测页 `demo/techtext.html`。

```js
import { enhanceTechText, mountTechText } from "@szyyw/design/techtext";
mountChrome({ /* … */ });                          // 一站式：缺省增强 ".app-title, .wordmark"，并跟进之后插入的标题
enhanceTechText(".app-title", { specks: 6 });       // → handle[]
const h = mountTechText(el, options);               // → { refresh(), destroy() }；同一元素重复调用返回同一个 handle
```

`mountChrome` 的 `techText` 自 v0.18.0 起缺省 **开启**（v0.15.0–v0.17.0 缺省不开），选择器 `".app-title, .wordmark"`；
`false` 关闭，`true` / 选择器字符串 / `{ selector, ...选项 }` 写法照旧。它在 `document.body` 上挂一个 MutationObserver
（childList + subtree，同一微任务内合并扫描，忽略 TechText 自己插拔的画布）：之后新出现的匹配元素自动 `mountTechText`，
脱离文档的元素销毁其 handle——React 等框架在 `mountChrome` 之后才渲染 / 重渲染标题也能生效、不泄漏。
`handle.techText` 是**当前**仍在文档里的 handle 数组（每次增减都换成新数组），`chrome.destroy()` 断开观察并全部销毁。
不调用 `mountChrome` 的页面用 `enhanceTechText(".app-title, .wordmark")`，它只处理调用时已在文档里的元素。

**选项**（上游参数基本保留，缺省值与官方演示一致，尺寸类参数按字号缩放）：

| 选项 | 缺省 | 说明 |
|---|---|---|
| `reveal` | `"letter"` | `"letter"` 只揭示光标 / 扫描点下的那个字母（官方）· `"area"` 圆形区域揭示虚线 · `"off"` |
| `sweep` / `speed` | `"loop"` / 1 | `"loop"` = 官方行为，无指针时一直逐字往复；`true` = 挂载后扫一遍就停；`false` |
| `selection` / `labels` / `specks` | true / true / 15 | 选框、标注、specks 数量（0 关）；标注色缺省 = accent × 0.62（官方） |
| `minLabelFont` | 18 | 字号小于它时不画标注（14–16px 的小字标注会糊成一团） |
| `draggable` | true | 鼠标与触屏都能拖；元素加 `touch-action: pan-y`，纵向滑动照常滚页面 |
| `reach` / `softness` | 约 2.1 × 字号 / 0.7 | 仅 `reveal: "area"`：揭示半径与边缘柔和度 |
| `dashLength` / `dashGap` / `strokeWidth` | 按字号 | 约 0.1 / 0.065 / 0.04 × 字号，夹在 1.4–4 / 1–2 / 0.6–1.5px |
| `lineStyle` | `"dashed"` | `"solid"` = 实线描边 |
| `fill` / `stroke` | `"auto"` | 缺省逐段取元素自己的样子：渐变字（`background-clip: text`，含子元素如 `<span class="grad-text">`）按它的 `background-image` 原样画，否则取文字色 |
| `accent` / `labelColor` | `--accent` / `"accent"` | 选框 / specks 与标注色；token 名或 CSS 颜色 |

**布局约定**（启用前后零位移）：

- 文字、字体、每个字的位置都从 DOM 量（`Range` 逐字素取矩形，`Intl.Segmenter` 拆字，中日文 / emoji 都行），
  canvas 按同一位置逐字绘制——左对齐 / 居中 / 换行 / letter-spacing / 字距都和原文字重合，**不用**上游的「居中 + 缩放到 90%」。
  基线 = 文字片段矩形顶 + 主字体 ascent 比例。混排（`szyyw<span class="grad-text">.xyz</span>`）逐段取色。
- canvas 绝对定位叠在元素上（元素是 `static` 时 JS 补 `position: relative`），比内容盒四周多出约 1.1 × 字号给拖拽与标注，
  横向夹在视口内（不产生横向滚动）；`pointer-events: none`，事件挂在元素本身。
- 渐变按 CSS 规则映射到（带渐变的那个元素的）padding box（角度、色标位置都照算），与原来一模一样。

**渲染时序**（v0.15.0 发布前修过的坑）：layout + 静态帧在挂载 / 失效时**同步**画（失效合并到一个微任务），
不依赖 rAF 或可见性；原文字只在画布第一次画成功之后才变透明。早期实现把文字同步设透明、第一帧却等 rAF，且 rAF 只在
`visibilityState === "visible"` 时才排——页面在后台标签 / 隐藏的预览窗格里加载时画布一直是默认 300×150、整段空白。

**可访问性与行为约定**：

- 原文字留在 DOM 与无障碍树里，只设 `-webkit-text-fill-color: transparent`（渐变字再去掉 `background-image`）；canvas `aria-hidden`。
  选中 / 复制的是原文字；`.tech-text::selection` 用 `--accent` 24% 的选中底色。
- 鼠标按住字母时 `preventDefault`，不会开始选字，也不会触发原生链接拖拽；拖拽后紧跟的 click 被吞掉（标题在链接里不误跳转），
  普通点击照常。
- 悬停揭示只在 `(hover: hover) and (pointer: fine)`；触屏只有拖拽与自动扫描。
- `prefers-reduced-motion`：不扫描、没有 specks，静态显示；悬停揭示 / 选框直接到位，松手立即回位。
- `forced-colors: active` 与打印时整段不启用（还原原文字）。
- 性能：所有实例共用**一个** rAF；没有指针交互时限 30fps；元素离开视口（IntersectionObserver）就停，回来先同步补画；
  隐藏标签由浏览器暂停 rAF，切回时同步补画；不扫描、没有交互、没有收敛中的过渡时不跑 rAF。
- 自动重排：文字变化（MutationObserver；应用 `textContent = …` 会连 canvas 一起删掉，自动挂回）、元素尺寸（ResizeObserver）、
  窗口宽度、字体加载完成；主题 / 配色 / 明暗变化（`<html>` 的 `data-*` / `style` / `class` + `prefers-color-scheme`）只换色。
- `destroy()` 移除 canvas、事件与观察者，行内样式还原到挂载前；React 里在 `useEffect` 的清理函数里调用。

**什么时候用**：每个应用左上角的品牌标题（`.app-title`）、登录页等处的 `.wordmark` 标题，以及门户里展示站点字标 / 域名的地方。不要用在正文、按钮、
表格等需要频繁读的文字上（每个实例一块 canvas + 每字两张小位图）。

**出处与许可**：移植自 [React Bits](https://reactbits.dev/text-animations/tech-text) 的 TechText（Copyright (c) 2026 David Haz），
上游许可是 **MIT + Commons Clause License Condition v1.0**。参考件原样存在 `reference/reactbits/TechText.{tsx,css}`
（与 `LICENSE.md` 一起；`reference/` 被 .gitignore，不进仓库与分发）。改动：框架无关 ESM、基于已有元素的渐进增强与 DOM 逐字定位、
逐段取色、按字号缩放、共享 rAF / 30fps / 离屏暂停、同步首帧、触屏拖拽、reduced-motion / forced-colors / 打印处理。
Commons Clause 一节写的是「可以作为应用 / 网站的一部分使用（含商用），但不得出售、再许可或再分发组件本身」；
包作者知情，决定把移植版随本包（个人站点的设计包）发布、供自己的站点使用。其他使用者请自行评估上游许可。

## 16. 交互组件与控件（v0.19.0）

全部框架无关 ESM + 手写 `.d.ts`，颜色只从 token，尊重 `prefers-reduced-motion`；出处见 §17。手测页
`demo/swipe-toast.html` `target-cursor.html` `gradual-blur.html` `branched-menu.html` `squish-switch.html` `glide-select.html` `status-mark.html` `lattice-loader.html` `depth-carousel.html`。

### Swipe Toast（`./toast`，升级）

`toast(message, { tone, timeout })` / `clearToasts()` 调用方式与语义不变，外观与交互升级：下滑关闭、底边剩余时间引线
（悬停 / 按住 / 聚焦 / 标签页隐藏时暂停）、按 tone 的内置 SVG 图标、Esc 关闭、堆叠折叠动画。
新增可选项：`title`、`action: { label, onClick }`、`icon`（Node / SVG 标记 / false）、`closeButton`、`pauseOnHover`、`onClose(reason)`。
DOM：`.toast-region > .toast-slot > .toast-gate > .toast`（卡片仍是 `.toast.<tone>`，即 `toast()` 返回的 `el`）；卡片内 `.toast-icon` /
`.toast-body`（`.toast-title` / `.toast-text`）/ `.toast-action` / `.toast-close` / `.toast-fuse`。色取 `--toast-tone`
（ok→`--ok`、warn→`--warn`、err→`--err`、info→`--accent`）；位置仍是底部居中，`--toast-offset` 让位底部导航。

### Target Cursor（`./target-cursor`）

`mountTargetCursor(options) → { update(opts), destroy() }`：四角取景框吸附可交互元素，仅 `pointer: fine`；一般经外观弹层的「鼠标效果」开关（§5）。
参数沿用上游名：`targetSelector`（缺省 `.cursor-target, a, button, [role=button]`，别名 `selector`）、`cursorColor` / `cursorColorOnTarget`
（缺省 `var(--accent)` / `var(--accent2)`，吸附时 oklab 混合）、`spinDuration`、`hoverDuration`、`parallaxOn`、`hideDefaultCursor`、`size`、
`cornerSize`、`thickness`、`padding`、`matchRadius`、`dotSize`、`blendMode`（缺省 `normal`，上游 `difference`）、`showLabel`（读目标的
`data-cursor-label`）、`clickEffect`、`container`。destroy 后恢复系统光标并移除全部 DOM / 样式。
v0.21.0：吸附目标每帧校验（消失 / 不可见 / 不在指针下即解除，见 §5「鼠标效果」）；弹簧积分按帧间隔细分步长，掉帧时不再发散。

### Gradual Blur（`./gradual-blur`）

`mountGradualBlur(target, options)` / `enhanceGradualBlur(root?)`：可选的边缘渐进模糊，**不默认挂到任何页面**。
目标 = 元素（模糊带是它的兄弟节点，贴着可视区边缘）或 `window` / `document` / `"page"`（固定在视口边缘）。
声明式：`data-gradual-blur="top|bottom|both"` + `data-gradual-blur-<短横线参数名>`。参数：`position`（`top|bottom|both|left|right`）、
`strength`、`height`、`width`、`divCount`、`exponential`、`zIndex`、`animated`（false / true / "scroll"）、`duration`、`easing`、`opacity`、`curve`、
`responsive` + `mobile|tablet|desktop` `Height|Width`、`preset`、`hoverIntensity`、`onAnimationComplete`、`className`、`style`；
新增 `edgeFade`（px，缺省 64：离开边缘多远才完全显现，0 = 常驻）。
v0.22.0 新增 `outside`（仅元素目标，缺省 false）：模糊带改为元素自己的子节点、贴在该边**外侧**，随元素移动（吸顶标题 / 固定栏），
越靠近元素越糊；元素须是定位元素且自身不带 `backdrop-filter`，`edgeFade` 按页面滚动计算（§13.2 的吸顶标题用的就是它）。

### Branched Menu（`./branched-menu`，备用）

`mountBranchedMenu(container, { sections: [{ label, icon?, value?, items: [{ label, value, icon? }] }], value?, onSelect?, … }) → { set, toggle, destroy }`，
目前不接入现有界面。上游参数全保留（`defaultOpen` / `onToggle` / `color` / `accentColor` / `lineColor` / `width` / `rowHeight` / `indent` / `trunk` /
`radius` / `lineWidth` / `fontSize` / `drawDuration` / `foldDuration` / `className`）；`icon` 取内置名（`ICONS`：install / rocket / settings / paint /
pointer / font / layers / bell）、SVG 标记或 Node。

### Squish Switch（`.switch` + 可选 `./switch`）

- 标记仍是 `<input type="checkbox" class="switch">`，布局零变化（40×22，flex: none）。纯 CSS：颜色渐变、按下滑块横向压扁、
  悬停轻微膨胀（仅 `hover: hover`）、滑块带过冲回弹地滑动；新增 `:focus-visible` 描边；reduced-motion 下无位移动效。
  可调变量 `--sw-w / --sw-h / --sw-inset / --sw-r / --sw-dur / --sw-fade / --sw-squish / --sw-hover`。
- `enhanceSwitches(root?, options?)`：指针拖动（跟手）、拖动时按速度横向拉伸、松手按落点（过半）切换并回弹。语义与原生 checkbox 一致：
  点击 / 空格 / label / 表单 / reset 全是浏览器原生；拖动只在落点与当前状态不同时产生一次原生 click → `input` / `change`，Esc 或取消还原。
  选项（也可写 `data-stretch` / `data-hover-scale` / `data-speed` / `data-color-duration` / `data-width` / `data-height` / `data-radius`）：
  `stretch` 36、`hoverScale` 1.035、`speed` 50、`colorDuration` 200、`width` / `height` / `radius`。
- 对照上游 SquishSwitch：`checked/defaultChecked/onChange` = 原生 checkbox；`label` = 外层 `<label>`；颜色改为 token；其余尺寸 / 速度参数保留。

### Glide Select（`./glide-select`）

- `<select class="field" data-glide>` + `enhanceSelects()`；或 `enhanceSelect(el, options) → { refresh(), destroy() }`。不支持 `multiple`。
- 原生 select 视觉隐藏（`.glide-native`）但留在 DOM，是真实数据源：选中时写 `selectedIndex` 并派发冒泡的 `input`、`change`；外部写 `value` /
  `selectedIndex` 自动同步且不派发事件（不与受控组件回环）；option 列表 / disabled / 文案 / `data-tag` 由 MutationObserver 同步；`form.reset()`、`<label for>` 都处理。
- 触发器：`select.field` → 触发器带 `.field`（+ `.small`）沿用 `.field` 外观；非 `.field` → 紧凑玻璃小块（`size` sm / md / lg）。
- 菜单挂 `<body>` fixed 定位（不被 `.table-wrap` 裁、不被 `.glass` 的 backdrop-filter 困住），放不下自动翻转，过长出滚动条；页面滚动 / 缩放关闭。
- 键盘 ↑↓ Home End Enter / Space Esc Tab + 字母前缀跳转；`role=combobox` + `aria-activedescendant`、`listbox` / `option` / `group`。
- 选项（`data-glide-<kebab>` 同名）：`placeholder` `showTags`（option 的 `data-tag`）`accent` `surface` `highlight` `text`（token 名或 CSS 颜色）`size` `radius`
  `menuWidth`（缺省改为「不小于触发器、按内容」）`placement` `align` `popDuration` `glideDuration` `rememberPosition` `ariaLabel` `className`。

### Status Mark（`./status-mark`）

`mountStatusMark(el, { status, progress, label, … }) → { set(partial), destroy() }`；声明式 `<span class="status-mark" data-status="running" data-progress="0.4" data-label="…">`
+ `enhanceStatusMarks()`（挂载后监听这三个属性）。status：`pending` `running` `done` `failed` `cancelled`（别名 `idle` = pending、`error` = failed），
running 无 progress = 不定进度。选项：`color` `doneColor`（缺省 `--ok`）`errorColor`（缺省 `--err`）`size` `strokeWidth` `dashes` `fontSize` `spinDuration`
`arcLength` `drawDuration` `fillOpacity` `strike` `strikeDelay`，另加 `texts`（读屏文字覆盖）。reduced-motion：不转圈（不定进度改呼吸）、勾叉直接出现。

### Lattice Loader（`./lattice-loader`）

`mountLatticeLoader(el, { label, doneLabel, errorLabel, status, showTimer, elapsed, … }) → { set(partial), destroy() }`：方格波浪 + 实时秒表
（`tabular-nums`，100ms 刷新）；`status` 切到 `done` / `error` 时方格拼成 ✓ / ✕ 并定格用时，切回 `working` 从 0 重计；给了 `elapsed`（秒）就由外部控制秒表。
选项：`pattern`（命名或自定义）`grid` 3|4 `shape` `color` `doneColor` `errorColor` `cellSize` `gap` `fontSize` `step` `idleOpacity` `glow` `glowColor`。
用于替代长任务的「加载中…」；`role="status"`，状态变化时播报「文字 + 用时」。

### Depth Carousel（`./depth-carousel`，v0.24.0）

`mountDepthCarousel(el, { items, start, … }) → { goTo(i, { animate }), next(), prev(), index, count, setItems(items, start), refresh(), destroy() }`。
`el` 即根元素（加 `.depth-carousel`），卡片 / 按钮 / 圆点由 JS 生成；`items` 为图片 url 或 `{ image, alt }`；`onChange(index, item)` 在当前项变化时调用
（用户操作、自动轮播、`goTo` 都算；初始化与 `setItems` 不算），应用用它显示「3 / 8」与「原图」链接。主要用途是**点开照片**：放进 `.overlay` + `.sheet.wide`
（无标题头，§8）里看图，不再跳全屏查看器或新标签页；配 `mountOverlay` 处理 Esc / 点遮罩，关闭时 `destroy()`。

- 上游参数全保留：`cardWidth` 300、`cardHeight` 380、`radius` 18、`tint`（缺省 `var(--bg)`，可传颜色或 token 名）、`depth` 220、`spread` 90、`tilt` 22、
  `tiltDirection` `"right"`、`perspective` 1400、`visibleCards` 4、`falloff` 0.2、`blur` 6、`duration` 700、`ease` `"power3.out"`（另认 gsap 常用名、
  `"cubic-bezier(…)"`、函数）、`autoplay` false、`autoplayDelay` 3200、`loop` true、`controls` / `indicators` true（上游名 `showControls` / `showIndicators` 也认）。
  新增：`aspect`、`fit`（缺省 `"contain"`）、`maxIndicators` 24（超过不显示圆点）、`wheel`（缺省 `"horizontal"`）、`keyboard`、`locale` / `labels` / `label`、`className`。
- **尺寸**：数字 = 上游行为（容器窄时整体缩小，最小 0.4 倍，不放大）。`cardWidth` / `cardHeight` 任一为 `"auto"` 时按容器宽高与 `aspect` 放大或缩小填满，
  圆点在卡片下方单独留位；容器须有确定高度——写 `--dc-height`（缺省 `100%`，父元素没高度时落到 `--dc-min-height` 320px）。
  弹层看图推荐 `cardWidth: "auto", cardHeight: "auto", aspect: 3 / 4` + 容器 `--dc-height: min(68dvh, 580px)`：桌面 760 宽弹层里卡片约 390 × 520，
  手机底部抽屉（375 宽）约 280 × 370。卡片按像素尺寸排版（不用 `scale()` 放大），照片不糊；图片 `object-fit: contain`（`--dc-fit` 可改）。
- 交互：拖动（鼠标与触摸；先判方向，纵向手势交还浏览器，`touch-action: pan-y`，不挡弹层滚动）、松手按速度投射落点；点后排卡片跳到它；
  焦点在组件内时 ← → Home End；左右按钮（`loop: false` 时首尾禁用）；圆点；滚轮缺省只认横向（`wheel: true` = 上游的纵横都认）。
- 自动轮播：悬停（精确指针）/ 拖动 / 聚焦 / 标签页隐藏时暂停；`prefers-reduced-motion` 下不自动轮播、切换无动画。补间只在动画中跑 rAF，空闲零帧。
- 大量图片：只创建当前项前 1 张到后 `visibleCards + 1` 张的卡片，图片随之按需加载；加载中显示转圈、失败显示图标 +「加载失败」。
- 颜色只从 token：卡片底 `--text` 7% 混 `--bg`、按钮 `--sheet-bg` / `--glass-border`、圆点 `--text` 32% / 当前 `--accent`、阴影 `--pop-shadow`；
  后排卡片向 `--dc-tint`（缺省 `--bg`）淡出，深色底时同时按 `falloff` 压暗，浅色底时不压暗（否则发灰）。明暗 / 配色切换即时生效。
- a11y：根 `role="region"` + `aria-roledescription="carousel"`（按 locale）+ `aria-label`、可聚焦；每张 `role="group"` + `aria-label="3 / 8"`，非当前项 `aria-hidden`；
  当前项变化经隐藏的 `aria-live="polite"` 播报「3 / 8 · alt」（自动轮播且未聚焦时关闭播报）；按钮与圆点有 label，当前圆点 `aria-current`。
- 公开类：`.depth-carousel`（+ 状态 `.is-auto` `.is-dragging` `.has-dots` `.is-empty`）、`__stage` `__card`（`.is-active`、`data-state="loading|loaded|error"`）
  `__img` `__msg` `__tint` `__arrow`（`--prev` / `--next`）`__dots` `__dot`（`.is-active`）`__live`；CSS 变量 `--dc-height` `--dc-min-height` `--dc-tint` `--dc-fit`
  （`--dc-w` `--dc-h` `--dc-radius` `--dc-perspective` `--dc-reserve` 由 JS 写，别手设）。卡片与按钮的 z-index（2000± / 3000）只在根元素内部，不进 §3 全局层级。

## 16.1 分页器 `.pager`（v0.20.0）

`import { mountPager } from "@szyyw/design/pager"`；所有列表分页统一用它，应用不自写「上一页 / 加载更多」。

- 结构：「共 N 条 · 第 a–b 条」+ 每页条数下拉（缺省 20 / 50 / 100 / 200）+ 首页 « / 上一页 ‹ / 页码（首尾与当前页两侧，中间省略号）/ 下一页 › / 末页 » + 跳页输入。
- 交互：焦点在分页器内时 ← → 翻页；改每页条数保持当前第一条仍在页内；`setBusy(true)` 取数期间禁用全部控件（`aria-busy`）。
- 窄屏（≤520px）页码收成「3 / 20」，首末与上下页按钮保留；页码键 36px（v0.28.0 起，之前 32），触屏 40px；当前页用凸起族（同 `.tabs` 选中块）。
- 只管界面：`onChange({ page, pageSize, reason })` 里取数，拿到新 total 后 `update({ total })`。服务端分页接口约定返回 `total`、`page`、`page_size`、`items`。
- 公开类：`.pager`、`.pager-info`、`.pager-size`、`.pager-nav`、`.pager-tools`、`.pager-btn`（`.active`）、`.pager-gap`、`.pager-cur`、`.pager-jump`。

## 16.2 图标 `./icons`（v0.27.0）

所有站点的按钮图标统一用包里的 Lucide 线性图标，**不再用字符凑**（✕ ＋ − ‹ › ↗ ⟳ 之类粗细、大小、基线都对不齐），也不在应用里另收图标副本。

```js
import { icon, iconSvg, enhanceIcons } from "@szyyw/design/icons";
closeBtn.append(icon("x"));                          // SVGSVGElement
cell.innerHTML = iconSvg("copy");                    // 字符串：模板拼接 / 服务端渲染
<span dangerouslySetInnerHTML={{ __html: iconSvg("x") }} />   // React
```
```html
<button class="btn-icon" aria-label="复制"><i data-icon="copy"></i></button>
<script type="module">import { enhanceIcons } from "@szyyw/design/icons"; enhanceIcons();</script>
```

- 外观：Lucide 原样（24 视框、`stroke="currentColor"`、`stroke-width` 2、round 端点），颜色跟随文字。
- 选项：`size`（px 数或 CSS 长度；缺省不写 = `1em`）、`label`（有意义的图标给读屏文字，生成 `role="img"` + `aria-label`；缺省为装饰，`aria-hidden`）、
  `className`、`strokeWidth`、`spin`（`.icon-spin` 转圈，reduced-motion 下不转）。
  图标按钮本身要有 `aria-label`（图标是装饰）。
- `enhanceIcons(root)`：把 `[data-icon]` 占位替换成 `svg.icon`；占位上的 class 追加到 svg，`aria-label` 当 label，`data-size` / `data-spin` / `data-stroke-width` 照用。
  动态插入的内容插完后对那块再调一次。
- 尺寸自动适配（不必传 `size`）：`.btn-icon` 16px、`.btn-icon.xs` 14px、`.close-x` 18px、`.field-clear` 16px、`.pager-btn` 16px、`.toast-close` 14px；
  `.btn` `.btn-ghost` `.chip` `.tab` `.seg > *` 里为 1.15em，并与文字间隔 0.4em（含图标时这些元素改为 `inline-flex`）；`.link` 里跟文字同行。正文里 1em、对齐基线。
- 名字是编译期穷举的（`IconName`），运行时未知名字直接抛错，不画占位；`hasIcon(name)` 给外部输入做判断。
  另认 Lucide 改名前的常用旧名：`alert-triangle` `alert-circle` `help-circle` `check-circle` `x-circle` `more-horizontal` `more-vertical` `home`。
- 收录（88 枚，`ICON_NAMES`；手测页 `demo/icons.html` 全列）：
  增减 `x` `plus` `minus` `check`；方向 `chevron-left/right/up/down` `chevrons-left/right` `arrow-left/right/up/down` `arrow-up-right` `arrow-left-right` `arrow-down-right` `chevrons-up-down`（v0.30.0）；
  操作 `copy` `clipboard` `external-link` `link` `refresh-cw` `rotate-ccw` `search` `filter` `trash-2` `pencil` `save` `download` `upload` `share-2` `send`；
  视图 `zoom-in` `zoom-out` `maximize` `minimize` `maximize-2` `minimize-2` `scan`（1:1 原尺寸）`eye` `eye-off` `menu` `ellipsis` `ellipsis-vertical` `grip-vertical` `settings` `sliders-horizontal`；
  状态 `info` `circle-help` `circle-alert` `triangle-alert` `circle-check` `circle-x` `loader` `loader-circle`（配 `spin`）；
  对象 `user` `users` `lock` `log-in` `log-out` `house` `calendar` `clock` `mail` `mic` `bell` `image` `file` `file-text` `folder` `star` `sun` `moon` `monitor`；
  v0.30.0 补 `sparkles`（助手入口，替代 ✦）`calculator` `package`（替代 📦）`pointer`（点按提示，替代 👆），天气 `cloud` `cloud-sun` `cloud-moon` `cloud-rain` `cloud-drizzle` `cloud-snow` `cloud-lightning` `cloud-fog` `wind`（配 `sun` / `moon`）。
- 要加图标：在 `scripts/build-icons.mjs` 的 `NAMES` 里加 Lucide 名字，按脚本头的说明从 `lucide-static` 重新生成，发版。不在应用里手抄 SVG。
- 包内已改用：外观弹层关闭键、Swipe Toast 的语气图标与关闭键、分页器翻页键、Glide Select 的箭头与勾、Depth Carousel 的左右键与加载失败图标。
  右上角工具位的三枚图标（切换器 / 账户 / 外观）与 Branched Menu、Status Mark、Lattice Loader 的图形按各自设计保留。

## 16.3 通用组件（v0.29.0）

多个站点各自手写的同一类形态收进包里：列表行、折叠区块、二次确认、状态点与徽标、胶囊语义、进度条扩展、搜索与筛选条、登录卡外壳、校验态补全。
全部按 §3.1 刻度写（同档等高、统一焦点环与交互状态），颜色只从 token；纯新增，旧类保留不删。手测页 `demo/components-v029.html`（`?scheme=light`）。

### 列表行 `.list > .list-row`

```html
<div class="list divided">
  <div class="list-row">
    <span class="row-lead"><span class="avatar">AC</span></span>
    <span class="row-main"><span class="row-title">名字</span><span class="row-sub">name@example.com</span></span>
    <span class="row-end"><span class="pill info">admin</span><span class="dot ok"></span><button class="btn-icon" aria-label="更多"><i data-icon="ellipsis"></i></button></span>
  </div>
</div>
```

- 结构：`.row-lead`（可选：`./icons` 图标 20px、`<img>` 36 圆角 8、`.avatar` 头像、`.dot`）+ `.row-main`（`.row-title` 14/500 单行省略，`.row-sub` 12 次行省略，可多个）+ `.row-end`（可选：数值 / 胶囊 / 操作 / `.row-chevron`，不收缩、最多占 60%，窄屏只有 `.row-main` 省略）。
- 高度：缺省 `--h-item` 52（两行文字或 36 头像），`.compact`（行或容器上）44；高度由 `min-height` 定、内容垂直居中，分隔线不会把行撑高。
- 容器：`.list`（行间 2px、圆角悬停，像菜单）· `.list.divided`（行间 `--row-line` 分隔线、行不圆角）· `.list.gap`（每行一块 `.inner` 式卡内块，行间 8px）；
  `.list.bleed` 把行拉到卡片内边距外、悬停底铺满卡片宽（`--inset` 缺省 16，同 `.inset-list`）。`ul.list` / `ol.list` 自动去掉列表样式。
- 状态：`a` / `button` / `[role=option]` / `[tabindex]` 的行可点——无边框时悬停衬 `--hover-tint`，`.list.gap` 里悬停描边 `--hover-border`；按下叠一层衬底；焦点环向内收 2px。
  选中 `.selected` / `[aria-selected=true]` / `[aria-current]` 用着色族（`--selected-bg` + 1px `--selected-border`）；禁用 `:disabled` / `[aria-disabled=true]` 为 .45。不提供 `.danger` 行（危险操作放进行尾菜单）。
- `.avatar`：36 圆形首字母或图片（`.sm` 28），底 `--selected-bg`、字 accent。
- 与旧类：新写的列表一律用 `.list-row`。`.row-hover` + `.inset-list`（v0.17.0）等价于 `.list.bleed > .list-row`；`.msg-list` / `.msg-item` 保留给通知面板（未读加粗、圆点淡化的语义）；三者都不删。

迁移示例：

```html
<!-- 前：门户用户行 / 账本流水行各写一套 flex + 省略 -->
<div class="user-row"><div class="avatar-x">Y</div><div class="user-meta"><b>…</b><small>…</small></div><span class="role">admin</span></div>
<!-- 后 -->
<div class="list-row"><span class="row-lead"><span class="avatar">Y</span></span><span class="row-main"><span class="row-title">…</span><span class="row-sub">…</span></span><span class="row-end"><span class="pill info">admin</span></span></div>
```

### 折叠区块 `.disclosure`

```html
<details class="disclosure"><summary>高级选项<span class="summary-meta">3 项</span></summary><div class="disclosure-body">…</div></details>

<div class="disclosure">
  <button type="button" class="disclosure-summary" aria-expanded="false" aria-controls="p1">同步日志</button>
  <div class="disclosure-body" id="p1" hidden>…</div>
</div>
```

- 标题行（`summary` / `.disclosure-summary`）：44 高、14/600、去掉原生三角；右侧 Lucide chevron-down（遮罩画，`--text-dim`），展开转 180°，过渡 `--dur-base`；
  `.lead-chevron` 改为左侧 chevron-right、展开转 90°（正文随之缩进）。悬停衬底、焦点环向内收 2px。`.summary-meta` 是靠右的次要信息（13、等宽数字）。
- 内容 `.disclosure-body`：左右 12、下 12。`.flush`：整块左右外扩 12，标题文字与卡片内容对齐、悬停底伸进卡片内边距。
- 放进容器：`.list.divided` 里每块之间画分隔线、标题不圆角；`.list.gap` 里每块是卡内块；`.inner` 里自洽。
- details 的高度动画只在支持 `interpolate-size` 的浏览器里有（Chromium 129+），其余直接展开；reduced-motion 下都没有过渡。
- **JS `./disclosure`**（只给按钮写法）：`mountDisclosure(button, { panel?, open?, animate = true, onToggle? }) → { open(), close(), toggle(force?), expanded, destroy() }`，
  同步 `aria-expanded` 与内容区 `hidden`，展开收起用 WAAPI 做高度动画（`--dur-base` / `--ease`）；`enhanceDisclosures(root?) → () => void` 处理所有 `.disclosure-summary[aria-controls]`。
- 迁移：`<div class="sec" onclick="toggle()">▸ 明细</div>` + 自写显隐 → 原生 `<details class="disclosure"><summary>明细</summary>…</details>`，▾ / ▸ 字符删掉。

### 二次确认（`./confirm`）

**按钮版** `armConfirm(button, { onConfirm?, timeout = 3000, label?, locale?, labels?, onArm?, onDisarm? }) → { armed, disarm(), destroy() }`：

- 第一次点：拦下（`preventDefault` + 停止传播），按钮加 `.armed`、文字换成「再点一次确认」（`labels.armed`，zh / ja / en），宽度锁住不缩；`.btn-icon` 或无文字按钮只换 `aria-label` / `title`。
- 再点：复原并调用 `onConfirm(e)`；不给 `onConfirm` 时第二次点击照常冒泡，交给应用自己的点击委托。失焦、点别处、Esc、超时都复原（`onDisarm(reason)`）。
- 外观：`.btn.armed` 实底 `--danger` + `--on-err` 字（同 `.btn.danger`）；`.btn-ghost.armed` `.btn-icon.armed` `.menu-item.armed` 红字 + 红描边 + 12% 红底；焦点环变红。
- 行操作菜单里用：`attachMenu(btn, menu, { closeOnSelect: false })`，上膛那一下菜单不关；菜单打开时被搬到 body 下，所在行要在挂载时记住（`closest()` 找不到）。

**对话框版** `confirm({ title?, message?, confirmLabel?, cancelLabel?, danger?, input?, locale?, labels?, signal? })`：

- 返回 `Promise<boolean>`：确认 true；取消 / Esc / 点遮罩 false。带 `input: { value, placeholder, type, maxLength, label, required, requiredMessage, validate }` 时返回 `Promise<string | null>`，
  Enter 确认；`required` 为空或 `validate(v)` 返回文案时不关闭，输入框 `aria-invalid` + 下方 `.field-msg.err`。
- 结构：`.overlay > .sheet.confirm`（`role="dialog"`，`danger` 时 `alertdialog`，`aria-modal`，标题 / 说明作可访问名与描述）；`mountOverlay` 处理 Esc / 点遮罩 / 滚动锁。
  焦点困在弹层内，初始焦点在「取消」（有输入框时在输入框并全选），关闭后还原到打开前的元素。
- `.sheet.confirm`：桌面 420 宽的窄弹层（手机仍是底部抽屉）；`danger` 确认键是实底 `.btn.danger`，**不**按 §8 靠左隔离（它就是主操作）；说明 `.confirm-message` 14、`--text-dim`。
- 迁移：`if (!window.confirm("删除？")) return;` → `if (!(await confirm({ title: "删除？", danger: true, confirmLabel: "删除" }))) return;`；
  自写的「再点一次确认」（`.armed` / `.bp-armed` 一类） → `armConfirm(btn, { onConfirm })`。

### 状态点与徽标 `.dot` `.badge-dot` `.badge`

- `.dot`：`--dot` 8px 圆，缺省 accent；语义 `.ok .warn .err .info .idle`（idle = `--text-dim`）；`.pulse` 呼吸光圈（reduced-motion 下静止）。
  配文字用 `<span class="dot-label"><span class="dot ok"></span>在线</span>`（居中对齐、间距 `--sp-2`）；放在 flex 容器（`.row-lead` `.row-end`）里直接用。
- `.badge-dot`：贴在父元素右上角的红点（`--danger`，2px 底色描边把它从按钮边框上剪出来）；`.badge`：数字徽标（16 高、最小宽 16、`--fs-xs`、pill），
  缺省红底，`.neutral` 灰；`.badge.float` 贴右上角。含这两种的父元素自动 `position: relative`（特异性 0）。外观与工具位的 `.corner-badge` 一致——工具位按钮仍用 `.corner-badge`。
- 与旧类：`.msg-dot` 保留在 `.msg-item` 里；新代码的状态点用 `.dot`。迁移：`<i class="status-dot online"></i>` → `<span class="dot ok"></span>`。

### 胶囊 `.pill` 语义与可点

- 语义名 `.ok .warn .err .info .neutral`：淡底 tint + 同色 45% 描边（与 `.callout` 同浓度；v0.29.0 前描边 50%）。旧颜色名是别名：`green` = ok、`amber` = warn、`red` = err、`slate` = neutral；
  `cyan`（跟 accent）、`violet`（跟 accent2）、`pink` 仍是颜色名，**`cyan` 不是 `info`**（info 是 `--info` 偏青；cyan 自 v0.25.0 起其实是蓝灰 accent）。
- 可点：`button.pill` / `a.pill`——字号显式回到 11px（按钮的 `font` 简写不再盖掉它）；悬停无色胶囊描边 `--hover-border` + `--text` 字、语义胶囊描边加深到本色；按下 .97；焦点环；禁用 .45。
- 计数 `.count`：`.chip > .count` / `.pill > .count`，当前色 14% 淡底的小圆角块、等宽数字。`.chip` 选中除 `.active` 外也认 `[aria-pressed=true]` / `[aria-selected=true]`（着色族）。
- 迁移：`<span class="pill green">` 可不改，新代码写 `.pill.ok`。`<button class="filter-chip">全部 <b>42</b></button>` → `<button class="chip">全部<span class="count">42</span></button>`。

### 进度条扩展（在 `.bar` 上）

```html
<div class="meter">
  <div class="meter-head"><span class="meter-label">本月额度</span><span class="meter-value">86%</span></div>
  <div class="bar warn"><div class="bar-fill" style="width: 86%"></div><span class="bar-mark" style="--at: 80%"></span></div>
</div>
<div class="bar stacked"><span class="bar-seg" style="--w: 34%"></span><span class="bar-seg ok" style="--w: 22%"></span></div>
<div class="bar indeterminate" role="progressbar" aria-label="导入中"></div>
```

- 语义：`.bar.ok/.warn/.err/.info`（或写在 `.bar-fill` 上）→ 实色填充；缺省仍是 `--grad`，`.bar-fill.over` 不变。
- 多段 `.bar.stacked > .bar-seg`：每段 `--w` 宽，段间 2px 细缝；缺省按 `--chart-1…6` 依次取色，`.ok/.warn/.err/.info/.idle` 或 `--c` 改色。
- 限额刻度 `.bar-mark`：`--at` 处一条 2px `--text` 70% 竖线。不定进度 `.bar.indeterminate`：40% 的色块往复滑动（reduced-motion 下改为整条 45% 静止）。
- `.meter`：上一行「标签 … 数值」（12、数值等宽数字、标签省略）+ 下方 `.bar`；相邻 `.meter` 间距 12。
- 迁移：多段账户条 → `.bar.stacked`；自写「标签 + 数值」行 → `.meter-head`；限额刻度的自写伪元素 → `.bar-mark`。

### 搜索框与筛选条 `.field-wrap.search` `.filter-bar`

```html
<div class="filter-bar">
  <div class="field-wrap search"><input type="search" class="field small" placeholder="搜索"><button type="button" class="field-clear" aria-label="清除"></button></div>
  <div class="chip-row scroll"><button class="chip" aria-pressed="true">全部<span class="count">128</span></button>…</div>
  <span class="filter-meta">共 128 条</span>
</div>
```

- `.search`：左侧 16px 放大镜（遮罩画、`pointer-events: none`，输入框左内距随之让位）；`.field[type=search]` 去掉浏览器原生清除键与圆角外观，清除用 `.field-clear`（值为空时 `hidden`）；`.small` 档同样成立。
- `.filter-bar`：一行「搜索（吃剩余宽，基准 14rem）+ `.chip-row`（`.scroll` 不换行横滑、给焦点环留位）+ `.filter-meta`（靠右的计数 / 操作）」；≤640px 搜索独占一行、chip 行在下一行横滑。
  筛选条里搜索用 `.field.small`，与 `.chip` 同为 36。chip 选中用着色族，计数用 `.count`。
- 迁移：`.search-box` + 自写图标定位、`.filters` + `.filter-chip` → 上面的结构；自写的 `::-webkit-search-cancel-button` 隐藏删掉。

### 登录卡外壳 `.auth-shell` `.auth-card`

```html
<div class="bg-layer"></div>
<div class="app-frame">
  <main class="app-main auth-shell">
    <div class="glass auth-card">
      <h1 class="app-title">站点名</h1><p class="auth-sub">用门户账号登录</p>
      <form class="stack">
        <div class="form-row"><label for="u">用户名</label><input id="u" class="field"></div>
        …<button class="btn">登录</button>
      </form>
      <p class="auth-foot">没有账号？<a href="…">联系管理员</a></p>
    </div>
  </main>
</div>
```

- `.auth-shell` 与 `.app-main` 叠在同一元素上：外框（`.app-frame:has(> .app-main)`）把剩余高度分给它，页头可以照常放在外面；单用时自己 `min-height: 100svh`。
  桌面（宽 >640 且高 ≥560）垂直居中；手机靠上、上边距 `max(32px, 12svh)`——用 svh 不随键盘伸缩，输入框聚焦时卡片不跳。
- `.auth-card` 配 `.glass`：宽 `min(400px, 100%)`、内距 24/16/16、圆角 16；里面的 `.app-title` / `.wordmark` 26px；`.auth-sub` 13 说明；
  直接子级 `form` / `.stack` 的字段之间、字段与按钮之间统一 16（`.form-row` 的块底不叠加），按钮全宽；`.auth-foot` 12 居中小字（链接自动下划线）。错误用 `.field-msg.err` 或 `.callout.err`。
- 迁移：各站自写的登录外壳 / 卡片宽度、居中与 padding 删掉，换成上面的结构。

### 校验态补全

- `.field[aria-invalid="true"]` / `.field.invalid` 在 `.field-wrap`（清除键）、`.search`（放大镜同时变红）、textarea、日期类输入里都是红描边 + 红焦点环。
- Glide Select：原生 select 上的 `aria-invalid` / `.invalid` 由 glide-select.js 同步到触发器（MutationObserver 跟进），套 `.field` 的与紧凑触发器都变红。
- `.form-row`：label 下 6px → 控件 → `.field-msg` / `.hint` 上 4px；textarea 改为顶对齐（`vertical-align: top`），下方说明与单行输入框同距（之前多出约 5px 行距）。

## 16.4 通用组件（v0.30.0，第 3 批）

各站还在手写、包里没有的形态：步骤条、时间线、表格增强、缩略图条 / 网格与选项卡、统计数字、键值列表补充、底部操作条，以及迁移中补的列表行多行 / 密集 / 大缩略图、
可点胶囊选中态、空状态、终端「回到最新」浮钮、确认框勾选项。全部按 §3.1 刻度，颜色只从 token；状态色与 `.dot` / `.pill` / `.callout` 同一色族（淡底 tint + 45% 描边），
选中一律着色族 `--selected-*`。纯新增，旧类不删（`.stat-grid` 多了 `--stat-min` 旋钮，缺省值不变）。手测页 `demo/components-v030.html`（`?scheme=light`，`?bar=0` 不显示操作条）。

### 步骤条 `.steps > .step`

```html
<ol class="steps">
  <li class="step done"><span class="step-marker"></span><span class="step-body"><span class="step-title">提交</span><span class="step-sub">11-02</span></span></li>
  <li class="step current" aria-current="step"><span class="step-marker"></span><span class="step-body"><span class="step-title">打包</span></span></li>
  <li class="step"><span class="step-marker"></span><span class="step-body"><span class="step-title">送达</span></span></li>
</ol>
```

- 标记 `.step-marker` 28（`--h-sm`）圆：待办 `--inner-bg` + 细边、序号（CSS 计数器，标记留空时自动）；`.done` 绿淡底 + 勾；`.current` / `[aria-current=step]` 实心 accent + 4px `--selected-bg` 光圈；
  `.err` 红淡底 + 叉、标题标红；`.blocked`（前置未完成）标记虚线、标题淡出。标记里也可以放 `./icons` 图标或自定文字。
- 连接线 2px `--line-soft`，完成段变绿 45%。有当前步时后面的待办标题淡一档；没有当前步（纯说明手顺）时标题照常。
- 正文：`.step-title` 14/500（当前 600）、`.step-sub` 12、`.step-desc` 13 段落（正文行高）；`.step-end` 行尾（状态 / 按钮）：纵向时靠右，窄屏换到正文下方。
- 排布：缺省横向、**≤640px 自动转纵向**；`.vertical` 一直纵向；`.horizontal` 一直横向（短标签）；`.scroll` 横向不换、每步至少 128、放不下横滚。`.compact`：标记 16、不画序号。
- 可点（向导回到某步）：`.step-body` 写成 `a` / `button`，悬停衬底向外扩 4 / 8（画在伪元素上，不挤布局）、焦点环、禁用 .45。
- 迁移：月末流程 `.flow-step`（`is-done` / `is-next` / `is-blocked` + `.flow-state`）→ `.step.done` / `.current` / `.blocked` + `.step-end`；
  门户页 01–04 的 `.guide-step` → `.steps.vertical` + `.step-desc`（渐变序号字删掉）。

### 时间线 `.timeline > .timeline-item`

```html
<ol class="timeline">
  <li class="timeline-item current">
    <span class="dot info pulse"></span>
    <div class="timeline-main">
      <div class="timeline-head"><span class="timeline-title">到达投递局</span><time class="timeline-time">11-08 14:20</time></div>
      <p class="timeline-desc">中央邮局</p>
    </div>
  </li>
</ol>
```

- 状态点直接用 `.dot`（`.ok .warn .err .info .idle .pulse`），竖线 2px `--line-soft` 连到下一条圆点、两头各留 4px；圆点对齐标题第一行中线。
- 头行「标题（吃剩余宽）… 时间（等宽数字、不换行）」，放不下时时间换到标题下一行；`.timeline-desc` 13 次要说明。
- 条目：`.current` 标题加粗（最新一条）、`.muted` 标题淡出 + 点淡化、`.err` 标题与说明标红。`.compact` 字号与行距小一档。
- 直接放卡片里，不需要负外边距对齐（之前借 `.msg-list` 要 `margin: 0 -10px`）。
- 迁移：订单卡物流节点 `.msg-list.track-steps > .msg-item`（借通知面板的类、关掉悬停）→ `.timeline`；任务时间线 `.timeline-list > .timeline-row`
  （时间 | 胶囊 | 状态 + 详情三列）→ `.timeline-item`，胶囊放进 `.timeline-head`，`is-fail` → `.err`。

### 表格增强（都是 `.tbl` / `.table-wrap` 的修饰，不加就和以前一样）

```html
<div class="table-wrap bleed">
  <table class="tbl hover">
    <thead><tr><th aria-sort="none" class="col-sticky"><button type="button" class="th-sort">名称</button></th>
      <th aria-sort="descending" class="col-num"><button type="button" class="th-sort">金额</button></th><th class="col-actions" aria-label="操作"></th></tr></thead>
    <tbody>
      <tr tabindex="0" aria-selected="true" class="err"><td class="col-sticky">…</td><td class="col-num" data-sort="12480">¥12,480</td><td class="col-actions">…</td></tr>
      <tr class="empty-row"><td colspan="3">暂无记录</td></tr>
    </tbody>
    <tfoot><tr class="total">…</tr></tfoot>
  </table>
</div>
```

| 件 | 用法 |
|---|---|
| `th[aria-sort] > button.th-sort` | 整格按钮；图标随 aria-sort：none 淡色上下箭头、ascending / descending accent 箭头（`./icons` 同源）；`.col-num` 列图标在文字左边。有按钮时旧的 `th::after` 字符箭头自动去掉 |
| `./table` `enhanceSortTable(table, { sort?, firstDirection?, onSort? })` | 点按升 / 降序切换并同步各列 aria-sort；缺省按 `data-sort` 或文字重排 tbody（数字感知、空值垫底、稳定；`tr.empty-row` / `tr.total` 不动）。React / Vue 管理的行或服务端排序传 `sort: false`，只用 `onSort` → `{ sortBy(i, dir), state, destroy() }` |
| `tr[tabindex]` / `tr[aria-selected]` | 可点行：指针、悬停衬底、焦点环向内收；`aria-selected="true"` 选中着色族（格子底 + 1px 外圈）。**不认 `.selected`**（已有应用拿它写自己的选中样式） |
| `tr.ok/.warn/.err/.info/.idle` | 首格左侧 3px 色条（同 `.dot` 色族），`.err` 再加淡红底 |
| `.tbl.compact` | 格子内距 4 / 8、12px |
| `.tbl.numeric` | 除首列外全部右对齐 + 等宽数字，`tfoot` 为合计行（600 + 上边线） |
| `tr.total` | 任意位置的合计行 |
| `tr.empty-row > td[colspan]` | 空状态行：居中、`--text-dim`、上下 32 |
| `.col-sticky` | 冻结首列（不透明底 + 右侧细线），与 `.tbl.sticky` 吸顶表头叠用时角格在最上层 |
| `.col-actions` | 操作列：收到内容宽、靠右、不换行 |
| `.table-wrap.bleed` | 横滚区拉到卡片内边距外（`--inset` 16），首尾列文字仍与卡片内容对齐 |
| `.tbl.reflow` | ≤640px 每行塌成一块卡片：表头隐藏，`td[data-label]` 前面显示标签、值靠右；没有 `data-label` 的首格当卡片标题；行状态 / 选中改画在整块上 |

吸顶表头沿用 `.tbl.sticky`（v0.13.0，纯 CSS）；`./sticky-heads` 是页面 / 分区标题用的，不用于表格。
迁移：`.tbl-sort th[aria-sort]::after` 自写箭头 → `.th-sort`；`.tbl.figures`（首列左、其余右、tfoot 加粗）→ `.tbl.numeric`；`tr.degraded/.failed` + 自写色条 → `tr.err/.warn`；
`.empty-row td` → `tr.empty-row`；`td.acts { width: 1% }` → `.col-actions`；首页总览的类表格网格 `.overview-head` / `.overview-row`（左侧状态色条、窄屏塌成卡片）→ `.tbl.reflow` + `tr.err/.warn/.ok`。

### 缩略图条 `.thumb-strip` · 网格 `.thumb-grid` · 选项卡 `.choice-card`

```html
<ul class="thumb-strip">
  <li><button class="thumb-tile" aria-pressed="true"><img src="…" alt="…"></button><button class="thumb-remove" aria-label="删除"></button></li>
  <li><button class="thumb-tile"><img …><span class="thumb-more">+5</span></button></li>
  <li><button class="thumb-add" aria-label="添加图片"></button></li>
</ul>
<div class="thumb-grid" role="group" aria-label="候选图"><button class="thumb-tile" aria-pressed="true"><img …></button>…</div>
<div class="choice-group">
  <label class="choice-card"><input type="radio" name="plan" checked><span class="choice-body"><span class="choice-title">标准</span><span class="choice-sub">每月 5 次</span><img class="choice-img" src="…" alt=""></span></label>
</div>
```

- `.thumb-tile`：方块（`--thumb`，缺省 64；`.sm` 48、`.lg` 96），圆角 12（`.sm` 8），图片 cover；描边画在图片之上（1px `--glass-border`）。可点（a / button）时悬停 2px `--hover-border`、按下 .97、焦点环、禁用 .45；
  选中 `.selected` / `[aria-pressed|aria-selected=true]` / `[aria-current]`：2px accent 内环 + 一圈底色细线（叠在任意图片上都分得出）；`.loading` 转圈、`.error` 红环；`.thumb-more` 是「+N」遮罩。
- `.thumb-add`：同尺寸虚线框（`--control-border`），空按钮自动画加号，有文字时显示文字。`.thumb-remove`：20 圆、反色（`--text` 底 `--bg` 字）+ 2px 底色描边，悬停变 `--danger`；
  它是磁贴的**兄弟**（按钮里不能套按钮），贴在右上角，触屏点按区扩到 36。
- `.thumb-strip`：横向滚动、吸附、给角标与焦点环留 8 的内距（外边距抵消，左缘仍与内容对齐）；`.wrap` 改为换行。
  `.thumb-grid`：自适应网格（列宽下限 `--thumb-min` 120px，格子按 `--thumb-ratio` 4 / 3 定高），同一块 `.thumb-tile`；选中格左上角多一枚勾（多选一眼可见）。
- `.choice-card`：带配图的单选 / 多选卡，整块是 `label`；选中跟随里面的 `input:checked`（也认 `.selected` / `[aria-checked=true]`），着色族；悬停描边、键盘焦点整卡画环、input 禁用整卡 .45。
  `.choice-group` 是自适应网格（最小 14rem）。
- 与 Depth Carousel 的关系：缩略图条 / 网格负责**挑选与编辑**（选中、添加、删除、上传状态）；点开看原图（放大、平移）用 `./lightbox`（v0.31.0，§16.5），纵深轮播式浏览用 `mountDepthCarousel`（§16，放 `.overlay` + `.sheet.wide`）；
  两者并排时用 Depth Carousel 的 `onChange` 同步缩略图的 `aria-current`，点缩略图调 `goTo(i)`。
- 迁移：照片格 `.thumbs > .thumb-btn > img.thumb` + `.thumb-more` / `.thumb-empty`、聊天附件盘 `.bridge-att` + `.bridge-att-x` → `.thumb-strip`；
  候选图多选 `.cand-grid > .cand-thumb.picked` → `.thumb-grid`；配图单选卡 `.opt.picked` → `.choice-card`。

### 统计数字 `.stat`（在 `.stat-grid` / `.stat-label` / `.stat-value` / `.stat-sub` 上补）

```html
<div class="stat-grid">
  <div class="glass stat err">
    <div class="stat-label">失败任务</div>
    <div class="stat-value">3<span class="stat-unit">件</span></div>
    <div class="stat-foot"><span class="stat-trend up err">+2</span><span class="stat-sub">较昨日</span></div>
  </div>
</div>
```

- `.stat` 是一个统计块：配 `.glass`（内距 16）或 `.inner`（12）时自带内距；裸用无内距（一张卡里排几组数）。数字等宽。
- 语义 `.ok .warn .err .info`：数字着色；配 `.glass` / `.inner` 时整块淡底 + 45% 描边（同 `.pill` / `.callout`）。
- `.stat-unit` 单位（12/500、`--text-dim`，跟在数字后）；`.stat-foot` 一行放 `.stat-trend` + `.stat-sub`；`.stat-trend` 变化量（12/600、等宽），`.up` / `.down` / `.flat` 画方向箭头，
  颜色另加 `.ok/.warn/.err/.info`——涨不一定是好事（支出涨用 `.up.err`）。`.compact`：内距 12、数字 18。
- 卡里的明细：`.stat > dl.kv.end`（上方细线隔开，值 600）。`.stat-grid` 新旋钮 `--stat-min`（列宽下限，缺省 150px）。
- 与旧类：`.stat-card`（v0.13.0）保留，等价于 `.glass.stat` 的内距；两者可以叠用（`.glass.stat-card.stat.err`）。
- 迁移：`.stat-card.alert`（自写红底红字）→ `.stat.err`；`.stat-detail`（dl 明细）→ `.stat > .kv.end`，`.stat-unit` 名字相同可直接删自写；`.dv-stats .stat-card` 的小内距 → `.stat.compact`。

### 键值列表补充（在 `dl.kv` 上）

- `.kv.end`：值列靠右、等宽数字（明细 / 金额），窄屏也保持左右两列；`.kv.compact`：行距小一档。`<div>` 包住 `dt + dd` 的写法同样成立（div 不参与网格）。
- 值可复制：`<dd class="copyable"><span>ABC-123</span><button type="button" class="btn-icon xs" data-copy aria-label="复制"></button></dd>`；
  精确指针下悬停 / 聚焦才显示按钮，触屏常显；空按钮自动画 copy 图标，复制成功换成绿勾（`data-copied`）。`.copyable` 也可以用在表格格子等任何地方。
- **JS `./copy`**：`copyText(text) → Promise<boolean>`（剪贴板不可用时退回 execCommand）；`mountCopy(button, { text?, timeout = 1500, locale?, labels?, onCopy? }) → { copy(), destroy() }`；
  `enhanceCopyButtons(root?, options?) → () => void` 处理所有 `[data-copy]`。复制的文字依次取 `text` → `data-copy` 的值 → `data-copy-target` 选择器 → 前一个兄弟元素 → 父元素文字；读屏播报「已复制」（zh / ja / en）。
- 迁移：各处自写的 `navigator.clipboard.writeText` + textarea 兜底 + 1.5s 换勾 → `mountCopy` / `[data-copy]`。

### 底部操作条 `.action-bar`

```html
<div class="action-bar" role="region" aria-label="已选操作">
  <div class="action-bar-text">已选 <b>3</b> 项 · 2.40 kg</div>
  <div class="action-bar-actions"><button class="btn-ghost">清空</button><button class="btn">寄出</button></div>
</div>
```

- 缺省 `position: fixed` 贴底居中：宽 `min(--action-bar-w 720px, 100% − 32)`，底距 `--action-bar-offset`（16）+ `env(safe-area-inset-bottom)`；`--sheet-bg` 玻璃 + `--pop-shadow`、圆角 16、入场 `rise`。
- 层级 40（同底部导航）：低于 `.overlay` / `.sheet` 50、`.menu` 55、toast 60，弹层打开时盖住它。页面有底部导航时设 `--action-bar-offset: calc(var(--nav-h) + 12px)`。
- 显示时（没有 `hidden`）自动：`--toast-offset` 抬到操作条上方；`.app-main` 末尾补一段同高留白（`::after`，高 `--action-bar-space`），最后一行内容滚得出来。不用 `.app-main` 的页面自己用 `padding-bottom: var(--action-bar-space)`。
- ≤640px：左右各留 8、按钮换到下一行等分撑满。`.sticky`：改为 `position: sticky` 留在文档流（贴所在滚动容器底部，比如长表单页尾），不触发上面的全局调整。
- 弹层里的按钮行用 `.sheet-foot`，不要放 `.action-bar`。
- 迁移：寄出条 `.ship-bar`（fixed + 自写居中 / 安全区）、手机端底部状态条 `.pol-bar` + 手调 `--toast-offset` → `.action-bar`。

### 列表行补充（在 `.list-row` 上）

- **多行** `.list.multiline` / `.list-row.multiline`：`.row-title` / `.row-sub` 不再单行省略，长域名、路线说明整段换行；行改为顶部对齐，头像与 `.row-end` 停在第一行 36 高的带子里（单行的行看起来仍居中）。
- **密集** `.list.dense` / `.list-row.dense`：36（`--h-row`，同菜单项）、标题 13、行首图标 16 / 头像图 28，给纯展示的长列表（设备、日志摘要）；副标题会把行撑高。可点的行在触屏下仍抬到 `--h-touch` 40。
- **大缩略图** `.row-lead.lg`：52（`--h-item`，≤520px 44）的图片 / `.thumb-tile`，圆角 8，行高随之变为 60；里面的 `.avatar` 用 44。
- `.avatar.lg`：44（`--h-lg`）。头像叠放组调研里没有用处，未做。
- 迁移：应用里对 `.row-title` / `.row-sub` 取消省略的局部覆写 → `.multiline`；设备列表一类的纯展示长列表 → `.list.dense`；商品行 `.prow-img`（行首自写 52 / 44）→ `.row-lead.lg > img`。

### 其他补充

- **可点胶囊选中**：`button.pill` / `a.pill` 加 `[aria-pressed=true]` / `[aria-selected=true]` / `.selected`。无色胶囊用着色族（同 `.chip` 选中）；语义 / 颜色胶囊不换配色（颜色在表意），描边加深到本色并补 1px 内环。迁移：`.pill.picked` → `aria-pressed="true"`。
- **空状态**（在 `.empty` 上）：直接子级的 `./icons` 图标 40（`--text-dim`）+ `.empty-title`（16/600）+ `.empty-desc`（13，最宽 32em）+ `.empty-actions`（居中按钮行）；`.empty.compact` 留白与图标小一档。
  旧的 `.empty-icon`（emoji 34px）照常，新代码用图标：🎁 → `package` / `star`，📋 → `file-text`，✅ → `circle-check`。
- **终端「回到最新」** `.term-follow`：放在 `.term` 里（`.term-body` 之后），贴右下角、终端配色、`./icons` 的 `arrow-down` 可放在文字前；何时显示（用户往上翻了）由应用决定，用 `hidden` 开关。
- **勾选确认** `confirm({ ack: "我明白…" })`：说明下方加复选框（`.confirm-ack`），勾上之前确认键禁用；不给 `ack` 时与之前完全相同。

## 16.5 原图查看器 `./lightbox` · 空缩略图占位（v0.31.0）

缩略图点开看原图的查看器，框架无关的 JS 模块（写法与 `./confirm` `./copy` 一致）；外观全部由包里已有的件拼成：`.overlay` + `.sheet.wide`、`.close-x`、`.btn-icon` / `.btn-ghost.btn-small`、
`.thumb-strip.sm` + `.thumb-tile`（选中态照旧）、`.spinner.lg`、`.empty.compact`、`.sheet-grabber`。手测页 `demo/lightbox.html`（`?scheme=light`，`?open=<i>` 直接打开第 i 张）。

### 用法

```html
<ul class="thumb-strip">
  <li><button type="button" class="thumb-tile" aria-label="查看照片 1"
      data-lightbox-src="/photos/1.jpg" data-lightbox-w="4032" data-lightbox-h="3024"><img src="/photos/1-360.jpg" alt="门牌"></button></li>
  <li><button type="button" class="thumb-tile" aria-label="查看照片 2" data-lightbox-src="/photos/2.jpg"><img src="/photos/2-360.jpg" alt=""></button></li>
</ul>
<div class="thumb-strip-empty sm">还没有照片</div>
```

```js
import { openLightbox, enhanceLightbox, LIGHTBOX_TEXTS } from "@szyyw/design/lightbox";
const undo = enhanceLightbox();                       // 声明式：事件委托，重复调用不重复绑定，返回解绑函数
const lb = openLightbox({ items, start: 2, onClose }); // 命令式 → { close(), go(i), destroy() }
```

- **`openLightbox({ items, start = 0, locale?, labels?, onClose?, returnFocus? })`**：`items` 为 `{ src, thumb?, alt?, width?, height? }[]`（没有 `src` 的项丢掉），打开时做快照，
  之后调用方换掉数组不影响正在看的。挂到 body，`mountOverlay({ dragClose })` 处理遮罩点击、Esc、滚动锁与下拉关闭；`close()` 关闭并调 `onClose`，`destroy()` 静默移除；
  两者都撤掉全部监听，焦点回到 `returnFocus`（缺省打开时的焦点元素）。`go(i)` 跳到第 i 张。
- **`enhanceLightbox(root = document, { locale?, labels?, onClose? })`**：`.thumb-strip` 里带 `data-lightbox-src` 的 `.thumb-tile` 点击打开，从被点的那张开始。
  属性：`data-lightbox-src`（原图，必填）、`data-lightbox-thumb`（缺省取磁贴里 img 的 src）、`data-lightbox-w` / `data-lightbox-h`（原图尺寸）、`data-lightbox-group`
  （同组跨条；不写时 = 同一条里没写组的磁贴）。禁用 / `aria-disabled` 的磁贴不响应；`a.thumb-tile` 带修饰键点击交给浏览器。带 `data-lightbox-src` 的磁贴是放大光标。
- **文案** `LIGHTBOX_TEXTS`（zh / ja / en，缺省 zh），`labels` 覆盖任意键：`dialog` `close` `prev` `next` `zoomIn` `zoomOut` `reset` `actualSize` `original` `openOriginal`
  `loading` `loadFailed` `openInNewTab` `position`（「第 {i} / {n} 张」）`image`（缺省 alt「图片 {i} / {n}」）`thumbs` `thumb`（「第 {i} 张」）。

### 行为

- **显示原图**：按原图比例算好像素尺寸居中（小图也放大到撑满舞台），只有图上是放大光标，空白处点击不放大。
- **渐进加载**：有 `thumb` 时先用它撑出版面并模糊显示（`--blur-sm`），舞台中央 `.spinner.lg`；原图到了淡入盖上（`--dur-base`）。版面尺寸依次取：已加载原图的 naturalWidth/Height →
  `width` / `height` → 缩略图比例。底栏的「原图 W×H」与 1:1 加载后以 naturalWidth/Height 为准。失败：`.empty.compact`（「图片加载失败」+「在新标签打开原图」）。相邻前后各预加载一张。
- **放大**：双击 / 双点图片（在点的位置放大到 2.5 倍，放大时双击任意处还原）、双指张合、滚轮（没放大时只在图上生效）、`+` / `-` 键与按钮（每步 1.5 倍）、1:1（原图一像素 = 一个 CSS 像素，
  不乘 devicePixelRatio）；`0` 键或点百分比还原。上限 max(5, 1:1 倍数)。放大后拖动平移，不许拖出边。
- **翻页**（没放大时）：左右滑跟手，松手按距离（舞台宽 20%）或速度（快速甩）切换，否则回弹；首尾张拖动 0.3 倍阻尼、不越过。`←` `→` 键与两侧翻页键切换，首尾循环（同原来的看图组件）。
  切换后缩放还原。方向锁：先判定水平还是垂直再跟手。
- **关闭**：关闭键、Esc、点遮罩；≤899px 从抓手 / 头部往下拖（§15 `dragClose`）；**没放大时在图上竖向下滑**（方向锁判为垂直、触屏指针）也接到同一个下拉关闭，与左右翻页不冲突。
- **底部**：一张以上时缩略图带（`.thumb-strip.sm`，当前项 `aria-current` 选中环，自动滚进视野，点了直接跳）；底栏依次「i / n · 原图 W×H」、分隔、缩小、百分比、放大、1:1、分隔、
  「打开原图」（新标签，`rel="noopener"`）。
- **形态**：桌面是居中的独立小窗（`.sheet.wide`，舞台高 `--lightbox-h` 缺省 `min(70dvh, 620px)`，可在 `.lightbox-sheet` 上改）；≤899px 是底部升起的大半屏卡片：下沿贴屏幕底
  （底部安全区用内边距）、上沿离顶部 44px + 顶部安全区，看得到后面变暗的页面，上沿圆角 + 抓手，关闭键与抓手同一行靠右；舞台吃掉除头部与底栏外的全部高度。
  触屏（`hover: none`）收起翻页键与 + − 1:1，只留百分比。reduced-motion 下去掉缩放、淡入、滑动动画。
- **无障碍**：`role="dialog"` `aria-modal="true"` + `labels.dialog`；打开时焦点在弹层上、Tab 困在弹层里；键盘监听挂在弹层自身（不挂 window），关闭即撤；
  翻页键、缩放键、关闭键都有 aria-label；切图时 `aria-live="polite"` 播报「第 i / n 张」。
- 类名 `.lightbox` `.lightbox-*` 是内部实现（§11），应用不要套用或覆写；要调舞台高度用 `--lightbox-h`。

### 空缩略图占位 `.thumb-strip-empty`

放在 `.thumb-strip` 的位置上、不可点的虚线框（`--glass-border`），内含一行小字（`--fs-sm`、`--text-dim`）。高度 = 磁贴 + 上下 8：缺省 64 + 16，`.sm` 48 + 16，`.lg` 96 + 16，
与同档 `.thumb-strip` 等高，换上真缩略图时版面不跳。圆角跟磁贴（缺省 12，`.sm` 8）。

### 迁移

- 应用侧原来的看图组件（`.photo-viewer` `.photo-sheet` `.photo-stage` `.photo-stage-img` `.photo-nav` `.photo-viewer-bar` `.photo-viewer-sep` `.photo-zoom-btn` 一整套样式 + 自写手势）
  → 删掉，点缩略图时 `openLightbox({ items: photos.map((p) => ({ src: 原图, thumb: 缩略图, width, height })), start: i })`；
  或者磁贴写 `data-lightbox-src` 后在应用入口调一次 `enhanceLightbox()`。React 里不需要再 `createPortal`，`useState` 存打开的序号也可以去掉。
- `.thumb-strip .thumb-tile { cursor: zoom-in }` 的局部覆写 → 删掉（带 `data-lightbox-src` 时包里给；用 `openLightbox` 自己接点击的，保留这一条或给磁贴加 `data-lightbox-src`）。
- 自写的空占位 `.thumb-empty`（同高虚线框）→ `.thumb-strip-empty`（`.sm` 同名）。

## 17. 出处与许可

以下模块移植自 [React Bits](https://reactbits.dev)（David Haz），上游许可 **MIT + Commons Clause License Condition v1.0**
（v0.19.0 新增的移植文件头都注明了出处；DotField 的来历见 §4）：

| 本包 | 上游组件 |
|---|---|
| `dotfield.js`（主题 nebula） | DotField |
| `techtext.js` | TechText |
| `themes/cursor-grid.js` · `themes/particles.js` | CursorGrid · Particles |
| `themes/gradient-waves.js` · `themes/side-rays.js` · `themes/pixel-blast.js` | GradientWaves · SideRays · PixelBlast |
| `target-cursor.js` · `gradual-blur.js` · `branched-menu.js` · `toast.js`（Swipe Toast 外观与交互） | TargetCursor · GradualBlur · BranchedMenu · SwipeToast |
| `.switch` + `switch.js` · `glide-select.js` · `status-mark.js` · `lattice-loader.js` | SquishSwitch · GlideSelect · StatusMark · LatticeLoader |
| `depth-carousel.js`（v0.24.0，gsap 补间改为自写 rAF 补间） | DepthCarousel |

Commons Clause 一节的大意是「可以作为应用 / 网站的一部分使用（含商用），但不得出售、再许可或再分发组件本身」。
包作者知情，决定把移植版随本包（个人站点的设计包）发布、供自己的站点使用；其他使用者请自行评估上游许可。
上游原件可按 `components.json` 的 `@react-bits` registry 取到 `reference/reactbits/`（已 gitignore，不随包分发），只作参考、不作依赖。
移植时 React state / effect → 闭包，`motion` → CSS transition / Web Animations，`gsap` → 自写 rAF 补间与缓动，`ogl` / `three` / `postprocessing` → 原生 WebGL，零运行时依赖。

滑块分段（§12.1，`.tabs` / `.seg` + `tabs.js`）的外观参照 reactbits.dev 文档站点外壳里「Preview / Code」的分段切换样式
（站点自身的界面，不是 React Bits 组件库里的组件），尺寸与动效按其观感自行实现，未移植其代码。

其他第三方素材：`icons.js` 收录 [Lucide](https://lucide.dev) 图标子集（ISC，Copyright (c) 2026 Lucide Icons and Contributors；其中源自 Feather 的图标另为 MIT，Copyright (c) 2013-present Cole Bemis），许可全文附在 `LICENSE` 末尾；
Branched Menu 内置图标取自 Hugeicons 免费集（MIT，Copyright (c) 2025 Hugeicons），以内联 SVG 收录；
字体 Geist（SIL OFL 1.1，`fonts/OFL.txt`，见 §7）。

### 文字链接（v0.26.0）

暗色下蓝灰主色与 `--text-dim` 很接近，只靠颜色区分不了链接，所以文字链接一律「主色 + 常驻细下划线」（下划线半透明，悬停加深）。

- 显式写法：`<a class="link" href="…">`。
- 正文、提示、说明文字（`p` `li` `dd` `td` `th` `figcaption` `blockquote` `.hint` `.callout` `.muted` `.small` `.tiny` `.page-sub` `.app-sub` `.err-text` `.ok-text` `.warn-text` `.empty`）里**不带 class** 的 `<a>` 自动套用，不用改标记。
- 带 class 的链接（`.tab` `.btn` `.chip` `.corner-tool` 等导航 / 控件）不受影响。应用里自写的「主色链接」样式请删掉，改用 `.link`。

- v0.26.1：`.app-frame` 里直接有 `.app-main` 时，外框为纵向弹性布局、`.app-main` 撑满剩余高度（短页面半透明底铺到屏幕底部）。页头 / 页脚请放在 `.app-main` 的兄弟位置；嵌在弹层等非 `.app-frame` 直接子级里的 `.app-main` 不受影响。

