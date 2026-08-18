# @szyyw/design

szyyw.xyz 设计语言的共享实现：design tokens、玻璃组件层、交互式点阵背景。
纯 CSS/JS，无构建步骤，React 与非 React 项目都能用。

## 用法

```jsonc
// package.json
"dependencies": {
  "@szyyw/design": "github:Szyoo/szyyw-design#v0.6.1"
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

// 背景参数面板：调色板排在明暗切换右边，实时调点阵。
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

非 React 项目（Flask/静态页）直接 `<link>` 两个 css、`<script type="module">` 引 dotfield.js。

右上角是一条共用工具位（`.corner-tools`），项目自己的全局按钮用
`mountCornerTool(el, { order })` 插进同一条，别各自 fixed。

## 主题与明暗

```html
<html data-theme="nebula" data-palette="aurora" data-scheme="auto">
```

- `data-theme`: 主题（一整套：背景/动效/光效/配色族）。目前唯一 `nebula`（深空）
- `data-palette`: 主题的附属配色。nebula 缺省青紫，可选 `aurora`（极光翠青）
- `data-scheme`: `dark`（缺省）| `light` | `auto`（跟随系统，靠 `color-scheme` + `light-dark()`，无 JS）

规范与参数详见 [DESIGN.md](DESIGN.md)。

## 升级流程

改动 → 升版本（**package.json 与 version.js 两处同步改**，检测更新读的是后者）→
打 tag（`git tag v0.x.y && git push --tags`）→ 各项目改依赖引用后 `npm install`。

vendored 项目（jppost-tracker 那种）拷文件清单：tokens.css / components.css /
dotfield.js / scheme.js / corner.js / settings.js / version.js。

### v0.4.0 破坏性变更

`.scheme-toggle` 不再自带 fixed 定位——定位归了新的 `.corner-tools`，按钮长相归 `.corner-tool`。
走 `mountSchemeToggle()` 的项目无需改动（按钮自动进工具位）；
手写 `<button class="scheme-toggle">` 的静态页要改成 `class="corner-tool scheme-toggle"` 并套一层 `.corner-tools`。
