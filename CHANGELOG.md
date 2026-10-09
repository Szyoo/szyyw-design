# Changelog

## v0.13.1 — 2026-10-09

- 修 `--lift-shadow`：之前把整条阴影写进 `light-dark()`（它只接受颜色），浏览器算成 `none`，`.lift:hover` 的投影从未生效。改为 `--lift-shadow-color: light-dark(…)` + `--lift-shadow: 0 10px 32px var(--lift-shadow-color)`。可见变化：`.lift` 卡片悬停时出现设计稿里本来就有的投影。

## v0.13.0 — 2026-10-09

补齐各应用自写 / 借用内部类的缺口（审计了 portal、jppost-tracker、payroll、ashare-ai-lab、exit-console、claude-bridge、cosme-vault、finance-ledger）。
**纯新增、向后兼容**：既有类 / 函数 / DOM / 存储键对现有标记不变——v0.12.0 的 `demo/appearance.html`、`demo/forms.html`
（dark / light × 1024 / 375 × 外观弹层开合）逐元素计算样式与位置零差异；切换器 / 账户菜单不传 locale 时 DOM 逐字节相同。
例外（规格明确要求、会影响已有标记的三处）：已禁用的 `.field` 现在显示熄灭态（之前与可用态无区别）、`.switch:disabled` 同理、
写了 `class="field small"` 的元素变紧凑（ashare 唯一用处有自己更高特异性的覆盖，实际无变化）。

- **工具位按钮公开化**（给 portal 的管理 / 账户 / 退出、finance-ledger 的通知等）：`.corner-tool` 移入公开 API（样式不变）；
  新增 `.corner-badge` 角标（空 = 小圆点 / 数字 = 计数 / hidden）；corner.js 新增 `createCornerButton({ icon, label, order, onClick, href, badge })`
  → `{ el, setBadge, destroy }`。替代 portal 照抄的 `.pf-tool` 与各自拼的角标。外观按钮的「有新版」角标仍是原来的 `::after` 小点，未改。
- **`--corner-rail-w` + `.corner-clear`**：corner.js 再发布「视口右缘 → 工具位左缘」的实测宽度（横排 / 纵排、按钮增减、resize 都重算，
  MutationObserver 兜底项目直接 append 的按钮）；`.corner-clear` 给顶栏让位。替代各应用顶栏写死的 `padding-right`。新 token `--corner-gap`（12px）。
- **切换器 / 账户菜单多语言**：新 `chrome-text.js`（`./chrome-text`，零 DOM）内置 zh / ja / en；`mountAppSwitcher({ locale })`、
  `mountAccountMenu({ locale, labels })`（含角色名，未知角色原样），两者 handle 加 `setLocale()`。不传 locale = 旧中文文案。替代应用 i18n 里各抄的一份。
- **语言切换 `mountLocaleToggle()`**（新 `locale-toggle.js`，`./locale-toggle`）：工具位 order 15，短名按钮 + `.corner-panel` 列表，
  `claimCornerPanel` 互斥。`CORNER_ORDER.locale = 15`。替代应用自写的语言切换控件。
- **一站式 `mountChrome()`**（新 `chrome.js`，`./chrome`，新项目首选）：外观 + 切换器 + 账户 + 语言一次挂齐，`setLocale` 同步全部、画布不重建；
  `portal: null` = 非 SSO。替代每个应用入口里那一串 mount 调用与语言联动胶水。
- **`corner.css`**（`./corner.css`）：只含工具位及其弹层，零全局规则，给 claude-bridge 这类自有样式体系的应用配 tokens.css 单独挂。
  由新脚本 `scripts/build-corner-css.mjs` 从 components.css 的 `@corner:begin/end` 段落 + 弹层依赖的公开类（限定到工具位内部）生成，`--check` 防过期。
  实测 corner.css 独立挂载与 components.css 下的工具位 / 四种弹层计算样式零差异。
- **新公开组件**（components.css，DESIGN.md §12 有「替代谁」对照表）：`.warn-text` `.hint` `.callout`(+ok/warn/err/info)
  `.tabs/.tab`（与 jppost / ashare 自写的 `.tab` 同外观）`.seg` toast（新 `toast.js`，`./toast`：`toast(msg, { tone, timeout })` / `clearToasts()`）
  `.field.small` `.field:disabled` `.switch:disabled` `.spinner` `.tbl.sticky` `.tbl.hover` `th[aria-sort]` `th.sorted` `.col-num`
  `.menu/.menu-item`（新 `menu.js`，`./menu`：`attachMenu()` 打开时搬到 body 下 fixed 定位，表格里不被裁）`dl.kv` `.drawer`（z 51）`.app-header/.app-brand/.app-title/.app-sub/.app-actions`。
- **tokens**：`--chart-1…6`（default / aurora 各一套，light-dark）、`--pop-shadow`（+ `--pop-shadow-color`）、`--on-err`、`--corner-gap`。
  `check-tokens.mjs` 照旧通过。
- `.tbl .num` **没有**改成右对齐（finance-ledger / exit-console 的表格用 `.num` 标日期与计数，改了会跳）；数字列右对齐用新的 `.col-num`。
- `sync.sh`：文件清单加入 corner.css / chrome-text.js / locale-toggle.js / chrome.js / toast.js / menu.js（现为 18 个运行时文件）；
  已有 `VENDORED.md` 时连「同步到此目录的文件」一行一起刷新（没有就补上）；README / 脚本头部的一行用法改为从目标 tag 取 sync.sh。
- 新增 `demo/components-v013.html`（不进 `files`）。
- 记录：`--lift-shadow` 把阴影整条写进 `light-dark()`，实测计算为 `none`（`.lift:hover` 阴影从未生效）；修它会改外观，本版未动。

## v0.12.0 — 2026-10-09

外观文案与接线收进包里，应用不再各抄一份。旧 API 签名不变；可见变化只有三处：外观弹层不传 labels 时配色名显示中文名而不是 id、版本行的「版本」改叫「设计包版本」、「复制升级命令」改为 tarball 形式。

- **新增 `appearance-text.js`（导出路径 `./appearance-text`）**：外观弹层 / 🌗 / 背景参数控件的内置 zh / ja / en 文案，`appearanceText(locale, overrides)`（"ja-JP" 也认，不认识回退中文，缺键按中文补齐）。零 DOM。
- **各 mount 函数加 `locale`**：`mountAppearancePanel`（缺省 "zh"）、`mountSchemeToggle`、`mountDotFieldSettings`（后两者不传仍是旧缺省）。`labels` 照旧逐键覆盖，新增 `labels.controls` 覆盖背景参数控件名——控件名之前写死中文。
- **新增 `mountAppearance()`**（`./appearance`）：一个调用挂齐 configureScheme + configureAppearance + 点阵背景 / 光斑 + 🌗 + 外观弹层，`cookiePrefix` 统一三项存储键，`handle.setLocale()` 切语言只重挂按钮与弹层、画布不重建。
- **新增 `appearanceCookieNames(prefix)`**（`./appearance-data`）：服务端 `readAppearanceFromCookies` 与客户端用同一个前缀。
- 版本行缺省升级命令改为 `npm i "https://codeload.github.com/<repo>/tar.gz/refs/tags/v<x>"`（node:alpine 构建镜像不带 git，`github:` 形式装不上）；vendored 项目照旧传自己的 `command`。
- `sync.sh` 文件清单加入 `appearance-text.js`（现为 12 个运行时文件）。
- `demo/appearance.html` 改用 `mountAppearance` 并加语言切换。

## v0.11.0 — 2026-10-08

修「输入框和按钮粘在一起」。现有标记不改代码升级不会出现新的布局破坏：新增类是纯新增，`.form-row` 兜底只在原来贴死（0px）的地方补间距。

- **新增 `.field-row`**：输入框 + 按钮（或多个小控件）一行——flex、`gap: 8px`、居中对齐、放不下就换行；`.field` 吃剩余宽度（基准 12rem），`.btn` / `.btn-ghost` / `button` / `.pill` / `.chip` 不伸缩，行内 `<label>` 去掉块级下边距。可与 `.form-row` 叠加（`class="form-row field-row"`）。
- **`.form-row` 兜底**：`.form-row` 仍是块级、不排版（label + 控件 + 提示的现有用法逐像素不变）；只在它的直接子级「控件后面紧跟按钮 / 另一个控件」时给后者 `margin-top: 8px`（之前 100% 宽的输入框把按钮挤到下一行后上下贴死）。叠了 `.field-row` 的不生效；规则全在 `:where()` 里，特异性 0。
  - 没有加全局的 `.field + .btn` 相邻规则：多数这类组合在 `.row` / 自有 flex 容器里已有 gap，外边距会叠成双倍、并在横排里把按钮顶歪。
- **`.btn:disabled` 改为实底「熄灭」态**（`--inner-bg` 底 + `--text-dim` 字 + inset 描边），不再是 0.45 透明度的渐变——半透明紫挨着输入框边界看不清，像粘连（cosme 报过，并已自行这样覆写）。描边用 inset 阴影，尺寸不变、切换不跳。项目自己的 `.btn.xxx { background }` 变体请写成 `:not(:disabled)`。
- DESIGN.md 新增 §10「表单排版」（`.form-row` / `.field-row` / `.stack` 各管什么、示例）与 §11「公开类与内部类」（`.settings-panel` / `.panel-body` / `.ctl*` / `.appearance-*` 等是组件内部实现，项目不要借用；项目自有样式不要重名公开类）。
- 新增 `demo/forms.html` 手测页（不进 `files`）。

## v0.10.0 — 2026-10-07

纯新增，旧 API（`mountDotFieldSettings` / `configureScheme` / `mountSchemeToggle` / `mountAccountMenu` / `mountAppSwitcher` …）签名、行为、DOM、class、存储键一律不变。

- **新增 `appearance-data.js`（导出路径 `./appearance-data`）**：主题 / 配色 / 明暗的选项表与纯函数——`THEMES` / `PALETTES`（含 `bg.dark` / `bg.light`）/ `SCHEMES` / `DEFAULT_APPEARANCE` / `APPEARANCE_COOKIES` / `normalizeAppearance` / `themeColorFor` / `readAppearanceFromCookies` / `appearanceAttrs`。零 DOM、零 import，服务端可直接 import（SSR 读 cookie 铺 `<html>`、算 theme-color）。
- **新增 `appearance.js`（导出路径 `./appearance`）**：`getAppearance` / `setAppearance` / `onAppearanceChange` / `configureAppearance` / `mountAppearancePanel` / `openAppearancePanel`。
  - `mountAppearancePanel`：统一「外观」弹层（配色 / 明暗 / 折叠的背景参数 / 版本行），是 `mountDotFieldSettings` 的上位替代——**两者二选一**（同一枚调色板按钮、同 order 20、同一份 `szyyw:dotfield`）。
  - 🌗 改明暗也会广播 `szyyw:appearancechange`（`changed = ["scheme"]`），应用只在 `onChange` 一处存账号级偏好。
  - `openAppearancePanel()`：打开最近一次挂出的外观弹层（设置页「打开外观」按钮用），没挂返回 false。
- `scheme.js` 新导出 `refreshThemeColor()`：换配色后重算 `<meta name="theme-color">`，不必整页刷新。
- `settings.js` 内部重构：控件 / 版本行 / 按钮 / 骨架 / 开合拆成 `@internal` 导出（`.d.ts` 不声明）供外观弹层复用；`mountDotFieldSettings` 的 DOM 与行为逐字节不变（旧版与新版逐步对比 outerHTML / localStorage 一致）。
- `components.css` 新增 `.appearance-panel` / `.appearance-advanced*` 少量布局规则，视觉沿用 `.settings-panel` / `.chip` / `.ctl`。
- `sync.sh` 文件清单加入 `appearance.js` / `appearance-data.js`（现为 11 个运行时文件）。
- 新增 `scripts/check-tokens.mjs`（断言 `PALETTES` 与 tokens.css 的 `--bg` 一致）与 `demo/appearance.html`（静态手测页），均不进 `files`。
- DESIGN.md 新节 §2.1「外观的持久化与首屏」；§5「背景参数」小节扩写为「外观」；§3 层级表修正 v0.9.0 遗留（删已不存在的 `.panel-backdrop`，`.settings-panel` 44 → `.corner-panel` 46）。

## v0.9.0 — 2026-10-05

- **工具位弹层统一为 `.corner-panel`**：背景参数、应用切换器、账户菜单同一种位置、底色、开合与动效（DESIGN.md §5「工具位弹层」）。
  - `corner.js` 实测发布弹层锚点 `--corner-panel-top` / `--corner-panel-right`：横排贴工具位下方，纵排贴工具位左侧、顶端对齐（之前纵排时切换器 / 账户菜单挂在第一枚按钮下方，压住下面的按钮）。窗口缩放时重算；`claimCornerPanel` 打开前会先量一次。
  - 底色改用 `--sheet-bg`（比 `--glass-bg` 不透明），高度随内容、上限视口。
- **背景参数从抽屉改为弹层（破坏性的视觉变化）**：去掉遮罩（`.panel-backdrop` 已删）、不再锁 `body` 滚动（之前滚动条消失导致整页横跳）、不再从右侧滑入、不再抢焦点；点外面 / Esc 关闭，与切换器 / 账户菜单互斥。`.settings-panel.open` 不再使用，开合用 `hidden`。
- 项目自己挂进工具位的按钮，面板加 `glass corner-panel` 两个类并在打开时调 `claimCornerPanel` 即可对齐，不要再自己写 top/right。

## v0.8.0 — 2026-10-02

- 新增 `account.js` / `mountAccountMenu()`（导出路径 `./account`，`./switcher` 也转导出）：右上角工具位 order 6 的账户菜单。读 portal `/api/me`：未登录显示「登录」，弹 `/login?popup=1` 小窗（被拦则整页跳 `/login?rd=…`），只接受 portal 源的 `szyyw-portal:login` 消息 → `onChange` → reload；登录后显示首字圆形头像，面板含用户名 + 角色徽章 + 「账户设置」（`/?account=1`）+「登出」（`POST /api/logout`，失败面板内提示）。网络错误时不渲染，3s 后重试一次。
- `corner.js` 新增 `claimCornerPanel(close)`：工具位下方面板互斥，切换器与账户菜单同一时刻只开一个。
- `components.css` 新增 `.account-login` / `.account-avatar` / `.account-menu*` 样式。
- `sync.sh` 文件清单加入 `account.js`（现为 9 个运行时文件）。

## v0.7.0 — 2026-10-01

- 新增 `switcher.js` / `mountAppSwitcher()`：右上角工具位最左的「九宫格」应用切换器，列表来自 portal `/api/apps`，含「回到门户」；高亮当前站点，Esc / 点击外部关闭，60s 缓存。
- 新增 `sync.sh`：vendoring 的唯一来源。`sh sync.sh <dest> [tag|--local]`，写 `VENDORED.md`。各项目原有的 `update-design.sh` 应改为调用它。
- `components.css` 新增 `.app-switcher*` 样式。
- 新增本文件。

## v0.6.2 及更早

按 tag 看提交说明：v0.1.0 tokens + 玻璃层 + DotField → v0.1.1 光晕渐变修复 → v0.2.0 主题→配色→明暗三层 → v0.3.0 明暗模式模块 → v0.4.0 背景参数面板 + 右上角工具位 → v0.5.0 面板内版本检测 → v0.6.x React Bits 接入与 DotField 出处补记。
