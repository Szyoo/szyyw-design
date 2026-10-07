# @szyyw/design

szyyw.xyz 设计语言的共享实现：design tokens、玻璃组件层、交互式点阵背景。
纯 CSS/JS，无构建步骤，React 与非 React 项目都能用。

## 用法

```jsonc
// package.json
"dependencies": {
  "@szyyw/design": "github:Szyoo/szyyw-design#v0.11.0"
}
```

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

// 外观弹层（v0.10.0，推荐）：调色板排在明暗切换右边——配色 / 明暗 / 折叠的「背景参数」/ 版本行。
// 与下面的 mountDotFieldSettings 二选一（同一枚按钮、同一个 order、同一份存储）。
import { configureAppearance, mountAppearancePanel } from "@szyyw/design/appearance";
configureAppearance({ persist: "cookie", storageKeys: { theme: "app_theme", palette: "app_palette" } });
mountAppearancePanel({
  field,
  labels: { palettes: { default: "青紫", aurora: "极光翠青" } },  // 包不内置语言，缺省显示 id
  dotField: { note: "仅本地预览" },                                // 背景参数段 / 版本行，与旧面板同名同义
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
curl -fsSL https://raw.githubusercontent.com/Szyoo/szyyw-design/main/sync.sh \
  | sh -s -- ./static/vendor/szyyw-design v0.11.0
```

它拷贝 11 个运行时文件并写 `VENDORED.md` 记录版本；`--local` 代替 tag 可从本机 clone 同步未发版改动。

右上角是一条共用工具位（`.corner-tools`），项目自己的全局按钮用
`mountCornerTool(el, { order })` 插进同一条，别各自 fixed。

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

vendored 项目（jppost-tracker 那种）拷文件清单：tokens.css / components.css /
dotfield.js / scheme.js / corner.js / settings.js / switcher.js / account.js / version.js /
appearance.js / appearance-data.js（以 `sync.sh` 的 `FILES` 为准）。

### v0.4.0 破坏性变更

`.scheme-toggle` 不再自带 fixed 定位——定位归了新的 `.corner-tools`，按钮长相归 `.corner-tool`。
走 `mountSchemeToggle()` 的项目无需改动（按钮自动进工具位）；
手写 `<button class="scheme-toggle">` 的静态页要改成 `class="corner-tool scheme-toggle"` 并套一层 `.corner-tools`。
