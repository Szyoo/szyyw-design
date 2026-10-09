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

### 2.1 外观的持久化与首屏

三层的**选项表**与**纯函数**在 `@szyyw/design/appearance-data`（零 DOM、零 import，服务端可直接 import）：
`THEMES` / `PALETTES`（含每个配色 `--bg` 的 `bg.dark` / `bg.light`）/ `SCHEMES` / `DEFAULT_APPEARANCE` /
`normalizeAppearance` / `themeColorFor` / `readAppearanceFromCookies` / `appearanceAttrs`。
客户端状态与「外观」弹层在 `@szyyw/design/appearance`。状态的唯一真相仍是 `<html>` 上的三个属性。

1. **SSR 项目（Next 等）**：服务端读 cookie → 铺到 `<html>`，theme-color 也在服务端算，首屏不闪。

   ```ts
   import { readAppearanceFromCookies, appearanceAttrs, themeColorFor } from "@szyyw/design/appearance-data";
   const COOKIES = { theme: "fl_theme", palette: "fl_palette", scheme: "fl_scheme" };
   const a = readAppearanceFromCookies((n) => jar.get(n)?.value, COOKIES);
   // <html lang="zh" {...appearanceAttrs(a)}>      —— palette 为 default 时不写 data-palette
   // theme-color：themeColorFor(a.palette, a.scheme)；auto 返回 { dark, light }，各配一条 media 查询
   ```

2. **客户端对齐**：`configureScheme({ persist: "cookie", storageKey: "fl_scheme" })` +
   `configureAppearance({ persist: "cookie", storageKeys: { theme: "fl_theme", palette: "fl_palette" } })`。
   两者都是「`<html>` 上已有合法属性的项不覆盖，没有的才从存储恢复」。
3. **静态页（无服务端）**：`<head>` 里、样式表之前内联一段同步脚本，从 localStorage 读三个键写到 `<html>`，
   然后用 `persist: "localStorage"`（完整示例见 `demo/appearance.html`）：

   ```html
   <script>
     (function () {
       var d = document.documentElement;
       try {
         var t = localStorage.getItem("app:theme"), p = localStorage.getItem("app:palette"), s = localStorage.getItem("app:scheme");
         if (t) d.setAttribute("data-theme", t);
         if (p && p !== "default") d.setAttribute("data-palette", p);
         if (s === "auto" || s === "dark" || s === "light") d.setAttribute("data-scheme", s);
       } catch (e) {}
     })();
   </script>
   ```

4. **账号级持久化**归应用：`mountAppearancePanel({ onChange })` 里存库（🌗 改明暗也走这一个回调，别再另外订阅
   `onSchemeChange` 存一遍）；登录后把库里的值写回 cookie，换设备不用重设。
5. **文案**（v0.12.0 起）：包内置 zh / ja / en（`appearance-text.js`），应用只传 `locale`，
   不要再在应用的 i18n 里抄一份外观文案；个别词要改用 `labels` 逐键覆盖（`controls` 管背景参数控件名）。
   v0.13.0 起应用切换器 / 账户菜单 / 语言切换的文案也内置（`chrome-text.js`，同一套规则：未知语言回退中文、缺键按中文补齐）。
6. **配色色值手工双写**：JS 不能 import CSS，`PALETTES[].bg` 与 tokens.css 的 `--bg: light-dark(L, D)` 各写一份。
   改 tokens.css 的配色块必须同步 appearance-data.js，并跑 `node scripts/check-tokens.mjs`（不一致退出码 1）。

## 3. 层级模型

```
z-index 0   .bg-layer        点阵背景（fixed，独立合成层）
z-index 1   .app-frame       内容层
z-index 30  侧栏 / 顶栏（sticky/fixed + backdrop-blur）
z-index 40  底部导航
z-index 45  .corner-tools    右上角工具位
z-index 46  .corner-panel    工具位弹层（外观 / 背景参数、应用切换器、账户菜单、语言；无遮罩）
z-index 50  .overlay         弹层遮罩（Portal 挂 body，避开 transform 包含块陷阱）
z-index 51  .drawer          侧边抽屉（v0.13.0；要遮罩就配一个兄弟 .overlay）
z-index 55  .menu            锚定下拉菜单（v0.13.0；抽屉 / 弹层里的 ⋯ 也要盖得住）
z-index 60  .toast-region    操作反馈（v0.13.0；压在一切之上，不拦点击）
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

出处：原型是 [React Bits](https://reactbits.dev) 的 DotField（portal 用它替掉 Dashy，
分支 `vps/portal-reactbits`）。上游是 React 组件、mousemove 用 pageX/pageY、
光晕终点写 `stop-color="transparent"`；本实现改成框架无关 ESM、颜色量化缓存、
token 取色，并修掉了那个 transparent 灰晕。取用上游素材见 README。

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
紧凑布局要纵向堆叠（finance-ledger 那种）就在自己的 `:root` 里设 `column`，
别用同权重 CSS 去覆盖整条规则。`order` 与按钮的挂载逻辑在两个方向下同样生效。

### 工具位弹层（.corner-panel）

工具位按钮点开的面板**只有一种**：外观 / 背景参数、应用切换器、账户菜单，以及项目自己挂进工具位的按钮
（finance-ledger 的通知）都挂 `.glass.corner-panel`，打开时调 `claimCornerPanel(close)`。规则：

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

- **配色行**：当前主题下的配色 chip（`.chip` / `.chip-row`）。主题只有一个时**不渲染主题行**，别为唯一主题留空行
- **明暗行**：跟随系统 / 深色 / 浅色。与 🌗 并列——🌗 是一键循环的快捷入口，弹层是完整设置；
  两者经 scheme.js 的事件互相同步
- **背景参数**（传了 `field` 才有）：`<details class="appearance-advanced">` 折叠段，`summary` 用 `.ctl-label`；
  内容就是下面「背景参数」的全部控件与语义（同一份代码），「恢复默认 / 保存」在折叠段底部
- **版本行**（`dotField.update !== false`）：同下「版本检测」

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

#### 背景参数（.settings-panel，`mountDotFieldSettings` 或外观弹层的折叠段）

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
没传就显示 `note`（如「访客模式 · 仅本地预览」）。

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

## 10. 表单排版

`.field` 是 `width: 100%` 的输入件，**自己不留外边距**；间距一律由容器给。三种容器各管一件事：

| 类 | 管什么 | 样子 |
|---|---|---|
| `.form-row` | 一个字段：`<label>` + 控件 + 可选提示 | 块级，块底 14px；**不排版子元素** |
| `.field-row`（v0.11.0） | 一行里的「输入框 + 按钮」/ 多个小控件 | flex、`gap: 8px`、居中对齐、放不下就换行；`.field` 吃剩余宽度（基准 12rem），按钮 / `.pill` / `.chip` 不伸缩 |
| `.stack` | 纵向一串控件（无 label 的紧凑表单） | flex 纵向、`gap: 10px` |

```html
<!-- 一个字段 -->
<div class="form-row">
  <label for="name">名称</label>
  <input id="name" class="field">
</div>

<!-- 输入框 + 按钮一行（可与 .form-row 叠加，保留块底 14px） -->
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

## 11. 公开类与内部类

**公开 API**（项目可以直接写在自己的标记里，跨版本保持语义；改动会进 CHANGELOG 并按 semver 处理）：

- 布局：`.app-frame` `.bg-layer` `.row` `.spread` `.stack` `.wrap` `.field-row` `.actions` `.divider` `.section` `.section-name`
- 容器：`.glass` `.panel` `.inner` `.lift` `.sheet` `.sheet-head` `.sheet-title` `.sheet-body` `.sheet-foot` `.overlay` `.close-x`
- 表单：`.field` `.form-row` `.form-grid` `.chip` `.chip-row` `.switch` `.err-text` `.ok-text`
- 按钮：`.btn` `.btn-ghost` `.btn-small` `.danger`
- 文本 / 数据：`.page-title` `.page-sub` `.panel-title` `.panel-head` `.grad-text` `.muted` `.small` `.tiny` `.num` `.mono`
  `.pill`（+ 色）`.amt-*` `.stat-*` `.bar` `.bar-fill` `.tbl` `.table-wrap` `.empty` `.term*`
- 动效：`.rise` `.stagger` `.shake` `.spot`
- 工具位：`.corner-panel`（项目自己的工具位弹层挂它 + `claimCornerPanel`，见 §5）；
  v0.13.0 起 `.corner-tool`（工具位按钮外观）、`.corner-badge`（角标）、`.corner-clear`（让位）也是公开 API
- v0.13.0 新增（§12）：`.warn-text` `.hint` `.callout`（`.ok/.warn/.err/.info`）`.tabs` `.tab`（`.compact` `.scroll`）`.seg`
  `.toast-region` `.toast` `.field.small` `.spinner`（`.lg`）`.tbl.sticky` `.tbl.hover` `th[aria-sort]` `th.sorted` `.col-num`
  `.menu-wrap` `.menu`（`.start` `.up`）`.menu-item` `.menu-sep` `.kv` `.drawer`（`.left`）`.drawer-head` `.drawer-body` `.drawer-foot`
  `.app-header` `.app-brand` `.app-title` `.app-sub` `.app-actions`；token `--chart-1…6` `--pop-shadow` `--on-err` `--corner-gap`

**内部实现**（只给包里的 JS 组件用，结构和定位随版本变，**项目不要借用这些类名去套自己的元素**，
也不要在自己的 CSS 里覆写）：

- `.settings-panel` `.settings-toggle` `.appearance-*` `.panel-body` `.panel-foot` `.ctl*` `.update-*`
  （外观 / 背景参数弹层；v0.9.0 把 `.settings-panel` 的定位挪给 `.corner-panel`，借用它的门户抽屉因此摊到了页面底部）
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
| `.warn-text` | 与 `.ok-text` / `.err-text` 同一族（13px、`--warn`） | cosme / payroll 自写 `.warn-text` |
| `.hint` | 字段下方提示：12px、`--text-dim`、上边距 6px | jppost / payroll 自写 `.hint`、内联 `tiny muted` |
| `.callout` + `.ok/.warn/.err/.info` | 提示条：tint 底 + 同色描边；首个 `<strong>` 着语义色；info 跟 accent | 各处内联 style 的提示块 |
| `.tabs > .tab` | 选中 `.active` 或 `[aria-selected="true"]`；`.tabs.compact` 紧凑；`.tabs.scroll` 不换行横滚 | jppost / ashare `.nav-tabs .tab`（样子一致）、portal `.tab-bar .tab-btn` |
| `.seg > button` | 分段控件，选中 `.active` 或 `aria-pressed="true"` | ashare `.mode-switch`、portal `.lay-seg`、cosme `.acct-seg` |
| `toast()`（toast.js） | `toast(msg, { tone, timeout })`，底部居中堆叠、点击关闭、aria-live；有底部导航时设 `--toast-offset` | portal `toast.jsx`、exit-console / ashare `.toast` |
| `.field.small` | 紧凑输入（14px、6px 10px）；触屏 / ≤640px 仍 16px 防 iOS 缩放 | portal `.field-small`、ashare `select.field.small` |
| `.field:disabled` / `.switch:disabled` | 熄灭态 | — |
| `.spinner`（`.lg`） | 跟随文字色与字号；减少动效时停转但可见 | 各自的「加载中…」文字 / 自写转圈 |
| `.tbl.sticky` | 表头吸顶；放在 `.table-wrap` 里，wrap 自动限高 `--table-max-h`（缺省 70vh）并纵向滚动 | — |
| `.tbl.hover` | 行悬停着色 | — |
| `th[aria-sort]` / `th.sorted` | 可排序列箭头（none ↕ / ascending ↑ / descending ↓），`.sorted` 高亮 | 自写排序箭头 |
| `.col-num` | 数字列：右对齐 + 等宽数字（th、td 都加） | ashare `.r.num`、finance `.data-tbl .num` |
| `.menu-wrap > .menu > .menu-item`（+ `attachMenu`） | 行操作 ⋯。在 `.table-wrap` / `.glass` 里必须用 menu.js 的 `attachMenu`（打开时搬到 body 下 fixed，不被裁切） | ashare `.menu` + 自写定位 |
| `dl.kv` | 键值列表；≤520px 上下排 | cosme `.kv`、ashare `#set-status .kv` |
| `.drawer` | 右侧抽屉（`.drawer-head/.drawer-body/.drawer-foot`），开合用 `hidden`；手机全宽；旋钮 `--drawer-w` / `--drawer-top` | portal `.portal-drawer` + `.drawer-body/.drawer-foot` |
| `.app-header` | 页头：`.app-brand`（`.app-title` + `.app-sub`）+ `.app-actions`，右侧自动让位工具位、可换行 | 四个应用自写的 `.brand-title` / `.brand-sub` / 顶栏 padding |
| `--chart-1…6` | 图表分类色，随配色与明暗 | 应用里写死的图表色板 |
| `--pop-shadow` | 浮层阴影（菜单 / 抽屉 / toast） | 硬编码 rgba 阴影 |

几条注意：

- **`.overlay` 带 `display: flex`，`hidden` 属性压不住**——遮罩按开合渲染 / 移除（React 条件渲染），别靠 `hidden`。
- 抽屉想让右上角工具位露出来：`--drawer-top: calc(10px + var(--corner-rail-h, 34px) + 12px)`。
- `.menu` 纯 CSS 版本只适合不在滚动容器 / 玻璃卡里的场景；表格行操作一律 `attachMenu`。
- `.tbl .num` 不改对齐（已有表格用 `.num` 标日期等，改了会跳）——数字列右对齐用 `.col-num`。
- `.spinner` 的旋转是匀速 `linear`，是唯一不走 `--ease` 的动效（等待语义）。
- 阴影 token 一律拆成「颜色 token（`light-dark()`）+ 固定几何」：`light-dark()` 只接受颜色，整条阴影塞进去会算成 `none`
  （v0.13.0 及之前 `--lift-shadow` 就是这样，`.lift:hover` 的投影从未生效，v0.13.1 修正）。浮层用 `--pop-shadow`。
