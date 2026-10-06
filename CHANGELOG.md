# Changelog

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
