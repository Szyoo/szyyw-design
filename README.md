# @szyyw/design

szyyw.xyz 设计语言的共享实现：design tokens、玻璃组件层、交互式点阵背景。
纯 CSS/JS，无构建步骤，React 与非 React 项目都能用。

## 用法

```jsonc
// package.json
"dependencies": {
  "@szyyw/design": "github:Szyoo/szyyw-design#v0.14.1"
}
```

### 新项目首选：`mountChrome`（v0.13.0）一次挂齐右上角整条

```ts
import "@szyyw/design/tokens.css";
import "@szyyw/design/components.css";
import { mountChrome } from "@szyyw/design/chrome";

const chrome = mountChrome({
  background: document.querySelector(".bg-layer"),  // 点阵背景（可省）
  cookiePrefix: "app_",                             // 外观三项存储键 → app_theme / app_palette / app_scheme
  locale: "zh",                                     // "zh" | "ja" | "en"：工具位全部文案内置
  portal: "https://szyyw.xyz",                      // SSO 站点；非 SSO 应用传 null（不挂切换器与账户菜单）
  appearance: { onChange: (a) => savePrefs(a) },    // 账号级外观偏好
  localeToggle: { locales: ["zh", "ja", "en"], onChange: (l) => setAppLocale(l) }  // 可省
});
// 应用自己换语言时：chrome.setLocale("ja")——切换器 / 账户菜单 / 🌗 / 外观 / 语言按钮一起换，画布不重建
```

工具位从左到右：应用切换器 5 · 账户 6 · 🌗 10 · 语言 15 · 外观 20 · 项目按钮（`createCornerButton`，缺省 50）。
顶栏用 `.app-header`（或给自己的顶栏加 `.corner-clear`）给工具位让位，不要写死 `padding-right`。

```js
import { createCornerButton } from "@szyyw/design/corner";
const bell = createCornerButton({ icon: BELL_SVG, label: "通知", order: 30, onClick: openInbox });
bell.setBadge(3);      // true = 小圆点；0 / null = 隐藏
```

操作反馈与行菜单（v0.13.0）：

```js
import { toast } from "@szyyw/design/toast";
toast("已保存", { tone: "ok" });                   // ok | err | warn | info，timeout 缺省 3000（0 = 不自动消失）
import { attachMenu } from "@szyyw/design/menu";  // .menu-wrap > button + .menu > .menu-item
attachMenu(button, button.nextElementSibling);
```

有自己样式体系、不加载 `components.css` 的应用（claude-bridge）：只挂 `tokens.css` + `corner.css`（工具位及弹层，
不含任何全局规则），JS 照常 `mountChrome` / `mountAppSwitcher` 等。

新组件一览（提示条 / 标签页 / 分段 / toast / 紧凑输入 / 转圈 / 表格吸顶排序 / 下拉菜单 / 键值列表 / 侧边抽屉 / 页头 / 图表色）
见 DESIGN.md §12，手测页 `demo/components-v013.html`。

### 分开挂（细调或旧项目）

```ts
// 入口（Next.js: app/layout.tsx）
import "@szyyw/design/tokens.css";
import "@szyyw/design/components.css";

// 点阵背景 + hover 光斑（restore 把上次调过的参数带回来）
import { mountDotField, attachSpot } from "@szyyw/design/dotfield";
import { restoreDotFieldSettings, mountDotFieldSettings } from "@szyyw/design/settings";
const field = mountDotField(document.querySelector(".bg-layer"), restoreDotFieldSettings());
attachSpot();

// 明暗模式：常驻右上角切换按钮（auto → light → dark）
import { configureScheme, mountSchemeToggle } from "@szyyw/design/scheme";
configureScheme({ persist: "cookie", storageKey: "app_scheme" });
mountSchemeToggle({ labels: { auto: "跟随系统", light: "浅色", dark: "深色" } });

// 应用切换器：右上角最左边的九宫格，列出当前账号能进的站点 + 回到门户。
// 列表来自 portal 的 /api/apps（portal 的权限矩阵决定给谁看什么）。
import { mountAppSwitcher } from "@szyyw/design/switcher";
mountAppSwitcher({ portal: "https://szyyw.xyz" });

// 账户菜单：切换器右边。未登录是「登录」（弹 portal 登录小窗），登录后是首字头像，
// 点开有角色、账户设置、登出。也可从 "@szyyw/design/account" 引入（同一实现）。
import { mountAccountMenu } from "@szyyw/design/switcher";
mountAccountMenu({ portal: "https://szyyw.xyz", onChange: (d) => console.log("logged in", d) });
// v0.13.0：两者都收 locale（"zh" | "ja" | "en"，缺省中文、与旧版逐字相同），handle.setLocale() 切语言；
// 账户菜单的 labels 可覆盖角色名 roles: { admin: "…" }。语言切换按钮：mountLocaleToggle（"@szyyw/design/locale-toggle"）

// 外观一站式（v0.12.0；mountChrome 内部就是它）：明暗 🌗 + 外观弹层 + 点阵背景 + 持久化，文案按 locale 内置（zh / ja / en）。
// 等价于下面 configureScheme / configureAppearance / mountDotField / mountSchemeToggle / mountAppearancePanel 的组合。
import { mountAppearance } from "@szyyw/design/appearance";
const appearance = mountAppearance({
  background: document.querySelector(".bg-layer"),
  cookiePrefix: "app_",              // → app_theme / app_palette / app_scheme
  locale: "zh",
  onChange: (a) => savePrefs(a)       // 账号级持久化
});
// 切语言：appearance.setLocale("ja")（画布不重建）；服务端读：appearanceCookieNames("app_")

// 外观弹层（v0.10.0）：调色板排在明暗切换右边——配色 / 明暗 / 折叠的「背景参数」/ 版本行。
// 与下面的 mountDotFieldSettings 二选一（同一枚按钮、同一个 order、同一份存储）。
import { configureAppearance, mountAppearancePanel } from "@szyyw/design/appearance";
configureAppearance({ persist: "cookie", storageKeys: { theme: "app_theme", palette: "app_palette" } });
mountAppearancePanel({
  field,
  labels: { palettes: { default: "青紫", aurora: "极光翠青" } },  // 包不内置语言，缺省显示 id
  dotField: { note: true },                                       // 背景参数段 / 版本行；note: true = 内置「仅保存在本浏览器」（v0.14.0，随 locale），字符串原样显示
  onChange: (a, changed) => savePrefs(a)                          // 账号级持久化；🌗 改明暗也会走这里
});

// 旧：只有背景参数的面板（仍可用，行为不变）。
// 面板底部自带版本检测（GitHub tags，6h 缓存）；有新版时调色板亮角标。
// 缺省动作是「复制升级命令」；有服务端的项目接 onUpdate 才是真·一键更新：
mountDotFieldSettings({
  field,
  note: "仅本地预览",
  update: {
    // onUpdate: (r) => fetch("/api/design/update", { method: "POST", body: JSON.stringify(r) })
  }
});
```

SSR 首屏不闪（服务端，零 DOM 的 `appearance-data` 可在 server component 里 import）：

```ts
import { readAppearanceFromCookies, appearanceAttrs, themeColorFor } from "@szyyw/design/appearance-data";
const a = readAppearanceFromCookies((n) => cookies().get(n)?.value, { theme: "app_theme", palette: "app_palette", scheme: "app_scheme" });
// <html {...appearanceAttrs(a)}>；theme-color = themeColorFor(a.palette, a.scheme)（auto 时返回 { dark, light }）
```

细则（静态页内联脚本、账号级持久化）见 DESIGN.md §2.1；手测页 `demo/appearance.html`
（仓库根目录 `python3 -m http.server 8080` 后打开 `/demo/appearance.html`）。

表单排版（DESIGN.md §10）：一个字段用 `.form-row`（label + 控件），**输入框 + 按钮同一行用 `.field-row`**
（v0.11.0，可与 `.form-row` 叠加），纵向一串用 `.stack`。哪些类是公开 API、哪些是组件内部实现不要借用，见 §11。
手测页 `demo/forms.html`。

```html
<div class="form-row field-row">
  <input class="field" placeholder="新用户名">
  <button class="btn btn-small">新增</button>
</div>
```

非 React 项目（Flask/静态页）直接 `<link>` 两个 css、`<script type="module">` 引 dotfield.js。

vendoring 用上游的 `sync.sh`，**各项目不要自己写同步脚本**（那是版本漂移的来源）：

```bash
curl -fsSL https://raw.githubusercontent.com/Szyoo/szyyw-design/v0.14.1/sync.sh \
  | sh -s -- ./static/vendor/szyyw-design v0.14.1
```

脚本从**目标 tag** 取（文件清单与那个版本一致，不用 main 上的）。它拷贝 18 个运行时文件并写 `VENDORED.md`
（已有时刷新版本行与文件清单行）；`--local` 代替 tag 可从本机 clone 同步未发版改动。

右上角是一条共用工具位（`.corner-tools`），项目自己的全局按钮用
`createCornerButton({ icon, label, order })`（v0.13.0，带角标）或 `mountCornerTool(el, { order })` 插进同一条，别各自 fixed。

## 账户菜单（v0.8.0）

```js
import { mountAppSwitcher, mountAccountMenu } from "@szyyw/design/switcher"; // 或 "@szyyw/design/account"
const portal = "https://szyyw.xyz";
mountAppSwitcher({ portal });                       // order 5
mountAccountMenu({ portal, onChange: (d) => {} });  // order 6，登录成功后自动 reload
```

依赖 portal 侧：`GET /api/me`（200 `{id,user,role}` / 401）、`POST /api/logout`、
`/login?popup=1` 成功后对 `window.opener` 发 `{ type: "szyyw-portal:login", ... }`、
`/?account=1` 打开账户抽屉；跨源接口回 `Access-Control-Allow-Origin: <origin>` + `Allow-Credentials: true`。
切换器与账户面板经 `claimCornerPanel()`（corner.js）互斥，同一时刻只开一个。

## 主题与明暗

```html
<html data-theme="nebula" data-palette="aurora" data-scheme="auto">
```

- `data-theme`: 主题（一整套：背景/动效/光效/配色族）。目前唯一 `nebula`（深空）
- `data-palette`: 主题的附属配色。nebula 缺省青紫，可选 `aurora`（极光翠青）
- `data-scheme`: `dark`（缺省）| `light` | `auto`（跟随系统，靠 `color-scheme` + `light-dark()`，无 JS）

规范与参数详见 [DESIGN.md](DESIGN.md)。

## React Bits 素材（可选）

点阵背景 DotField 最早就来自 [React Bits](https://reactbits.dev)（portal 用它替掉 Dashy，
再演化成本仓库的框架无关实现）。上游 166 个组件可以通过 shadcn MCP 随时取用：

- **MCP server 配在用户级**（`~/.claude.json`），开发工具而已，不属于这个包
- **registry 配在本仓库** [components.json](components.json)：`@react-bits` → `https://reactbits.dev/r/{name}.json`
- 组件落到 `reference/reactbits/`——已 gitignore，且不在 package.json 的 `files` 白名单里，
  **不会随包分发**

```bash
npx shadcn@latest add @react-bits/DotField-TS-CSS   # 变体：{名字}-{JS|TS}-{CSS|TW}
```

用途是**素材与参考，不是依赖**。本包是纯 CSS/JS、零依赖、Flask 也能 vendored，
而 React Bits 是 React 组件（多数还要 ogl / three / gsap / motion）。
看上某个效果就照 DotField 的路子移植成框架无关实现，别直接塞进分发。
没装 Tailwind 的项目选 `-CSS` 变体即可。

## 升级流程

改动 → 升版本（**package.json 与 version.js 两处同步改**，检测更新读的是后者）→
打 tag（`git tag v0.x.y && git push --tags`）→ 各项目改依赖引用后 `npm install`。

**改 tokens.css 的配色块（`:root` 主块或 `:root[data-palette=…]`）必须同步 `appearance-data.js` 的 `PALETTES`，
并跑 `node scripts/check-tokens.mjs`**——JS 不能 import CSS，服务端算 theme-color 用的是 JS 那份。

vendored 项目（jppost-tracker 那种）拷文件清单：tokens.css / components.css / corner.css /
dotfield.js / scheme.js / corner.js / settings.js / switcher.js / account.js / version.js /
appearance.js / appearance-data.js / appearance-text.js / chrome-text.js / locale-toggle.js / chrome.js / toast.js / menu.js
（以 `sync.sh` 的 `FILES` 为准）。

**改 components.css 的 `@corner:begin` … `@corner:end` 段落、或弹层里用到的公开类（.btn / .chip / .switch …）后
必须跑 `node scripts/build-corner-css.mjs` 重新生成 corner.css**；发版前跑 `node scripts/build-corner-css.mjs --check`（过期退出码 1）。

### v0.4.0 破坏性变更

`.scheme-toggle` 不再自带 fixed 定位——定位归了新的 `.corner-tools`，按钮长相归 `.corner-tool`。
走 `mountSchemeToggle()` 的项目无需改动（按钮自动进工具位）；
手写 `<button class="scheme-toggle">` 的静态页要改成 `class="corner-tool scheme-toggle"` 并套一层 `.corner-tools`。
