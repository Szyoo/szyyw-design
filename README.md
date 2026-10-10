# @szyyw/design

szyyw.xyz 设计语言的共享实现：design tokens、玻璃组件层、右上角工具位（明暗 / 外观 / 语言 / 应用切换器 / 账户菜单）、交互式点阵背景、TechText 字标。
纯 CSS/JS、零依赖、无构建步骤，React 与非 React 项目（Flask / 静态页）都能用。设计规范见 [DESIGN.md](DESIGN.md)。

## 功能

- `tokens.css`：颜色、字号、间距等 token；主题 `data-theme` → 配色 `data-palette` → 明暗 `data-scheme` 三层
- `components.css`：玻璃面板、按钮、表单、标签页、分段、表格、抽屉、弹层等公开类（清单见 DESIGN.md §11–§13）
- `corner.css`：只含工具位及其弹层，给有自己样式体系、不加载 `components.css` 的应用
- 右上角工具位：`mountChrome` 一次挂齐，也可逐个挂；项目自己的按钮插进同一条
- 外观持久化（cookie / localStorage）与 SSR 首屏不闪
- 点阵背景 DotField、toast、行菜单、TechText 字标
- 内置 zh / ja / en 文案

## 安装

npm（钉精确 tag）：

```jsonc
// package.json
"dependencies": {
  "@szyyw/design": "github:Szyoo/szyyw-design#v0.15.0"
}
```

CDN（无构建步骤的项目，免 vendoring）：每个 `vX.Y.Z` tag 发布到 `https://design.szyyw.xyz/vX.Y.Z/`，内容即该 tag 的 `git archive`，发布后不再改写（`Cache-Control: immutable`，CORS `*`）。

```html
<link rel="stylesheet" href="https://design.szyyw.xyz/v0.15.0/tokens.css">
<link rel="stylesheet" href="https://design.szyyw.xyz/v0.15.0/components.css">
<script type="module">
  import { mountChrome } from "https://design.szyyw.xyz/v0.15.0/chrome.js";
  mountChrome({ /* … */ });
</script>
```

- URL 写完整的 `vX.Y.Z`，同一页所有文件同一版本（模块之间相对 import，混版本会各加载一份）；建议集中成模板变量 `DESIGN_VERSION`。
- 不要引用 `/latest/`：它只是给人浏览的软链，随时跳版本、只缓存 5 分钟。
- 目录不可列出，文件名以 package.json 的 `files` / `exports` 为准。

vendoring（复制到项目目录）：只用上游 `sync.sh`，从目标 tag 取脚本，文件清单与该版本一致：

```bash
curl -fsSL https://raw.githubusercontent.com/Szyoo/szyyw-design/v0.15.0/sync.sh \
  | sh -s -- ./static/vendor/szyyw-design v0.15.0
```

它复制运行时文件（清单见 `sync.sh` 的 `FILES`）并写 / 刷新 `VENDORED.md`；第二个参数用 `--local` 可从本机 clone 同步未发版改动。

## 用法

### 一次挂齐：`mountChrome`

```ts
import "@szyyw/design/tokens.css";
import "@szyyw/design/components.css";
import { mountChrome } from "@szyyw/design/chrome";

const chrome = mountChrome({
  background: document.querySelector(".bg-layer"),  // 点阵背景（可省）
  cookiePrefix: "app_",                             // 存储键 → app_theme / app_palette / app_scheme
  locale: "zh",                                     // "zh" | "ja" | "en"
  portal: "https://szyyw.xyz",                      // SSO 门户；非 SSO 应用传 null（不挂切换器与账户菜单）
  appearance: { onChange: (a) => savePrefs(a) },    // 账号级外观持久化
  localeToggle: { locales: ["zh", "ja", "en"], onChange: (l) => setAppLocale(l) },  // 可省
  techText: true                                    // 左上角 .app-title 变 TechText 字标（缺省不开）
});
chrome.setLocale("ja");   // 切换器 / 账户菜单 / 明暗 / 外观 / 语言按钮一起换，画布不重建
```

其余选项：`persist`（`"cookie" | "localStorage" | "none"`）、`switcher` / `account`（透传选项，`false` = 不挂）、`appearance.dotField`、`appearance.labels`；完整类型见 `chrome.d.ts`。返回的 handle 含 `appearance` / `switcher` / `account` / `localeToggle` / `techText`。

工具位从左到右的 order：应用切换器 5 · 账户 6 · 明暗 10 · 语言 15 · 外观 20 · 项目按钮（缺省 50）。顶栏用 `.app-header`（或给自己的顶栏加 `.corner-clear`）给工具位让位，不要写死 `padding-right`。

只挂工具位、不要全局样式的应用：加载 `tokens.css` + `corner.css`（代替 `components.css`），JS 照常。

### 项目自己的工具位按钮、toast、行菜单

```js
import { createCornerButton, mountCornerTool } from "@szyyw/design/corner";
const bell = createCornerButton({ icon: BELL_SVG, label: "通知", order: 30, onClick: openInbox });
bell.setBadge(3);      // true = 小圆点；0 / null = 隐藏
// 已有元素：mountCornerTool(el, { order })；工具位下的面板打开时调 claimCornerPanel(close) 互斥

import { toast } from "@szyyw/design/toast";
toast("已保存", { tone: "ok" });                   // ok | err | warn | info；timeout 缺省 3000（0 = 不自动消失）

import { attachMenu } from "@szyyw/design/menu";  // .menu-wrap > button + .menu > .menu-item
attachMenu(button, button.nextElementSibling);
```

### TechText 字标

```js
import { enhanceTechText, mountTechText } from "@szyyw/design/techtext";
const titles = enhanceTechText(".app-title");               // → handle 数组；handle.destroy() 还原
const h = mountTechText(el, { specks: 6, sweep: true });     // 单个元素；sweep 缺省 "loop"
```

`mountChrome({ techText })` 也接受选择器或 `{ selector, ...选项 }`。启用前后布局零位移，原文字留给读屏。行为细则见 DESIGN.md §14，手测页 `demo/techtext.html`。

### 分开挂

```ts
// 点阵背景 + hover 光斑
import { mountDotField, attachSpot } from "@szyyw/design/dotfield";
import { restoreDotFieldSettings } from "@szyyw/design/settings";
const field = mountDotField(document.querySelector(".bg-layer"), restoreDotFieldSettings());
attachSpot();

// 外观一站式（mountChrome 内部即此）：明暗 + 外观弹层 + 点阵背景 + 持久化
import { mountAppearance } from "@szyyw/design/appearance";
const appearance = mountAppearance({
  background: document.querySelector(".bg-layer"),
  cookiePrefix: "app_",
  locale: "zh",
  onChange: (a) => savePrefs(a)
});

// 或更细：明暗切换（auto → light → dark）+ 外观弹层
import { configureScheme, mountSchemeToggle } from "@szyyw/design/scheme";
import { configureAppearance, mountAppearancePanel } from "@szyyw/design/appearance";
configureScheme({ persist: "cookie", storageKey: "app_scheme" });
mountSchemeToggle({ labels: { auto: "跟随系统", light: "浅色", dark: "深色" } });
configureAppearance({ persist: "cookie", storageKeys: { theme: "app_theme", palette: "app_palette" } });
mountAppearancePanel({
  field,
  labels: { palettes: { default: "青紫", aurora: "极光翠青" } },
  dotField: { note: true },                  // 背景参数段 / 版本行；true = 内置「仅保存在本浏览器」
  onChange: (a, changed) => savePrefs(a)
});

// 应用切换器（列表来自门户 /api/apps）与账户菜单
import { mountAppSwitcher, mountAccountMenu } from "@szyyw/design/switcher";  // 账户菜单也可从 "@szyyw/design/account" 引入
mountAppSwitcher({ portal: "https://szyyw.xyz" });
mountAccountMenu({ portal: "https://szyyw.xyz", onChange: (d) => {} });     // 登录成功后自动 reload

// 语言切换按钮
import { mountLocaleToggle } from "@szyyw/design/locale-toggle";
```

`mountAppearancePanel` 与旧的 `mountDotFieldSettings`（`./settings`，只有背景参数，底部带版本检测与「复制升级命令」，接 `update.onUpdate` 可做服务端一键更新）二选一：同一枚按钮、同一个 order、同一份存储。切换器与账户菜单都收 `locale` 和 `labels`，handle 有 `setLocale()`。

### SSR 首屏不闪

`appearance-data` 零 DOM，可在 server component 里 import：

```ts
import { readAppearanceFromCookies, appearanceAttrs, themeColorFor } from "@szyyw/design/appearance-data";
const a = readAppearanceFromCookies((n) => cookies().get(n)?.value, { theme: "app_theme", palette: "app_palette", scheme: "app_scheme" });
// <html {...appearanceAttrs(a)}>；theme-color = themeColorFor(a.palette, a.scheme)（auto 时返回 { dark, light }）
// 存储键名：appearanceCookieNames("app_")
```

静态页的内联脚本写法见 DESIGN.md §2.1。

### 主题与明暗

```html
<html data-theme="nebula" data-palette="aurora" data-scheme="auto">
```

- `data-theme`：主题（背景 / 动效 / 光效 / 配色族），目前只有 `nebula`
- `data-palette`：主题的配色，nebula 缺省青紫，可选 `aurora`（极光翠青）
- `data-scheme`：`dark`（缺省）| `light` | `auto`（跟随系统，靠 `color-scheme` + `light-dark()`，无需 JS）

### 表单排版

一个字段用 `.form-row`（label + 控件），输入框 + 按钮同一行用 `.field-row`（可与 `.form-row` 叠加），纵向一串用 `.stack`。哪些类是公开 API、哪些是组件内部实现不要借用，见 DESIGN.md §10–§11，手测页 `demo/forms.html`。

```html
<div class="form-row field-row">
  <input class="field" placeholder="新用户名">
  <button class="btn btn-small">新增</button>
</div>
```

## 接口说明

| 导出路径 | 内容 |
|---|---|
| `./tokens.css` · `./components.css` · `./corner.css` | 样式 |
| `./chrome` | `mountChrome` |
| `./appearance` | `mountAppearance`、`configureAppearance`、`mountAppearancePanel`、`openAppearancePanel`、`getAppearance` / `setAppearance` / `onAppearanceChange` |
| `./appearance-data` | `THEMES`、`PALETTES`、`SCHEMES`、`DEFAULT_APPEARANCE`、`APPEARANCE_COOKIES`、`appearanceCookieNames`、`normalizeAppearance`、`readAppearanceFromCookies`、`appearanceAttrs`、`themeColorFor`（零 DOM） |
| `./appearance-text` · `./chrome-text` | 内置文案（`appearanceText`、`chromeText`、`chromeLocale`、`roleLabel`） |
| `./scheme` | `configureScheme`、`mountSchemeToggle`、`getScheme` / `setScheme` / `cycleScheme` / `onSchemeChange`、`refreshThemeColor`、`destroyScheme` |
| `./dotfield` | `mountDotField`、`attachSpot`、`resolveTokenColor`、`DEFAULTS` |
| `./settings` | `restoreDotFieldSettings`、`mountDotFieldSettings`、`checkDesignUpdate` |
| `./corner` | `CORNER_ORDER`、`mountCornerTool`、`createCornerButton`、`claimCornerPanel`、`cornerRail`、`syncCornerRail` |
| `./switcher` | `mountAppSwitcher`、`SWITCHER_ORDER`；转导出 `mountAccountMenu`、`ACCOUNT_ORDER` |
| `./account` | `mountAccountMenu`、`ACCOUNT_ORDER` |
| `./locale-toggle` | `mountLocaleToggle` |
| `./toast` | `toast`、`clearToasts` |
| `./menu` | `attachMenu` |
| `./techtext` | `enhanceTechText`、`mountTechText`、`runningCount`、`DEFAULTS` |
| `./version` | `VERSION`、`REPO` |

每个 JS 模块都有同名 `.d.ts`，选项与返回值以其为准。

切换器与账户菜单依赖门户提供：

- `GET /api/apps`：当前账号能进的站点列表
- `GET /api/me`：200 `{ id, user, role }` / 401
- `POST /api/logout`
- `/login?popup=1`：登录成功后对 `window.opener` 发 `{ type: "szyyw-portal:login", ... }`（只接受门户源的消息）
- `/?account=1`：打开账户抽屉
- 跨源接口回 `Access-Control-Allow-Origin: <origin>` + `Access-Control-Allow-Credentials: true`

## 开发

```bash
python3 -m http.server 8080        # 仓库根目录；手测页在 /demo/*.html
node scripts/check-tokens.mjs      # tokens.css 配色块与 appearance-data.js 的 PALETTES 一致
node scripts/build-corner-css.mjs  # 由 components.css 的 @corner 段与公开类重新生成 corner.css；--check 只检查
```

- 改 `tokens.css` 的配色块（`:root` 或 `:root[data-palette=…]`）要同步 `appearance-data.js` 的 `PALETTES` 并跑 `check-tokens`。
- 改 `components.css` 的 `@corner:begin` … `@corner:end` 段或弹层用到的公开类后重新生成 `corner.css`。
- 发版：`package.json` 与 `version.js` 的版本号同步改（版本检测读后者），再打 `vX.Y.Z` tag。变更记录见 [CHANGELOG.md](CHANGELOG.md)。

## 许可

MIT，见 [LICENSE](LICENSE)。
