# themes-framework：待并入的文档

本文件是 `feat/themes-framework` 分支要并入 DESIGN.md / README.md / CHANGELOG.md 的内容，合并时拆进对应位置后删掉。

## 1. 打包清单（package.json / sync.sh）

新增运行时文件：

| 文件 | 说明 |
|---|---|
| `theme-background.js` + `.d.ts` | 背景主题运行时（`mountThemeBackground` 等）。**appearance.js 静态依赖它** |
| `themes/index.js` + `.d.ts` | 主题注册表。**静态依赖** |
| `themes/types.d.ts` | 主题模块公共类型 |
| `themes/nebula.js` + `.d.ts` | 缺省主题（DotField 适配器）。**静态依赖** |
| `themes/cursor-grid.js` + `.d.ts` | 光标网格（按需加载） |
| `themes/particles.js` + `.d.ts` | 粒子（按需加载） |

`package.json`：

```jsonc
"exports": {
  "./theme-background": { "types": "./theme-background.d.ts", "default": "./theme-background.js" },
  "./themes": { "types": "./themes/index.d.ts", "default": "./themes/index.js" },
  "./themes/*": { "types": "./themes/*.d.ts", "default": "./themes/*.js" }
},
"files": ["theme-background.js", "theme-background.d.ts", "themes/"]
```

`sync.sh` 的 `FILES` 追加（**缺了前三个，vendored 项目的 appearance.js 会整个加载失败**）：

```
theme-background.js themes/index.js themes/nebula.js themes/cursor-grid.js themes/particles.js
```

（B 的 `themes/gradient-waves.js themes/side-rays.js themes/pixel-blast.js`、C 的 `target-cursor.js` 也要加；
没加的主题 / 鼠标效果只会在面板里置灰为「暂不可用」，不报错。）

## 2. DESIGN.md

### §2 三层 → 改写「主题」与「配色」两条，并加「鼠标效果」

- **主题（theme）**：`html[data-theme]`，决定**背景效果**。v0.19.0 起可插拔：`nebula`（星云，缺省，DotField 点阵）、
  `cursor-grid`（光标网格）、`gradient-waves`（渐变波浪）、`side-rays`（侧光）、`pixel-blast`（像素爆破）、`particles`（粒子）。
  切换主题时销毁旧背景、按需加载并挂上新背景，不刷新页面。毛玻璃层级、.spot 光斑与所有组件在各主题下一致。
- **配色（palette）**：`html[data-palette]`，v0.19.0 起**对所有主题通用**（tokens.css 的配色块本就不依赖 data-theme；
  `PALETTES[].theme` 只作来源标注）。各主题从 token 取色，配色 / 明暗切换即时换色、不重建。
- **鼠标效果（cursor，v0.19.0）**：`html[data-cursor]`，`default`（系统指针，不写属性）/ `target`（Target Cursor）。
  只在 `pointer: fine` 下生效，外观弹层里也只在精确指针设备上出现。

### §2.1 外观的持久化与首屏 → 改动点

- 存储键从三项变四项：`appearanceCookieNames(prefix)` → `{ theme, palette, scheme, cursor }`（`fl_cursor`）。
  `readAppearanceFromCookies` / `normalizeAppearance` / `appearanceAttrs` 都认 `cursor`；`appearanceAttrs` 在 cursor 为 default 时不写 `data-cursor`。
  只传三项键名的旧调用照旧可用（cursor 用缺省名 `cursor`）。
- 未知主题 id（含本版本没有的主题）一律回退 `nebula`；配色不再随主题过滤。
- 客户端的鼠标效果只在动过时落盘（旧应用不会多写一个 cookie）。
- **静态页首屏片段**（推荐，替换原片段）：

  ```html
  <script>
    (function () {
      var d = document.documentElement;
      try {
        var t = localStorage.getItem("app:theme"), p = localStorage.getItem("app:palette"),
            s = localStorage.getItem("app:scheme"), c = localStorage.getItem("app:cursor");
        if (t) d.setAttribute("data-theme", t);
        if (p && p !== "default") d.setAttribute("data-palette", p);
        if (s === "auto" || s === "dark" || s === "light") d.setAttribute("data-scheme", s);
        if (c && c !== "default") d.setAttribute("data-cursor", c);
      } catch (e) {}
    })();
  </script>
  ```

  **旧片段（只恢复 theme / palette / scheme）不会坏**：没有 `data-cursor` 时 `configureAppearance` 会从存储补上；
  片段写进去的未知主题 id 也由 `configureAppearance` 归一化回 nebula。data-cursor 只影响 JS 挂载的光标，
  首屏晚一拍出现无闪烁问题，所以旧片段可以不改。

### §4 DotField → 开头加一句

DotField 是缺省主题 `nebula` 的背景（`themes/nebula.js` 是它的主题适配器）。旧 API `mountDotField` / `mountDotFieldSettings` /
`restoreDotFieldSettings` 不变；nebula 的主题参数与旧「背景参数」同键、同存储（`szyyw:dotfield`）、同「只存动过的键」语义。

### 新增 §4.1 背景主题（`themes/`、`theme-background`，v0.19.0）

**注册表** `themes/index.js`：`THEME_REGISTRY = [{ id, labels: { zh, ja, en }, load: () => import("./<id>.js") }]`，
`loadTheme(id)`（同一 id 只加载一次，失败不缓存）。nebula 由 theme-background.js 静态引入（首帧同步挂上），
其余**只加载当前主题**。`appearance-data.js` 的 `THEMES` 与注册表由 `scripts/check-tokens.mjs` 断言同序一致。

**主题模块接口**（`themes/types.d.ts`）：

```js
export const meta = { id, labels: { zh, ja, en }, params: [ /* 见下 */ ] };
export function mount(container, params, ctx) { return { update(params, info), reset?(params), destroy() }; }
```

- `params` 项类型：`range`（min / max / step / default）、`toggle`、`select`（options[].value / labels）、
  `token`（值是 token 名，如 `"--accent"`；颜色一律来自 token）、`color`（直接改写一个颜色 token，只给 nebula 兼容旧取色用）。
  可选 `hints`（说明行）、`visibleWhen: { key, equals } | { key, notEquals }`（条件显示）。
- `ctx`：`reducedMotion()`、`finePointer()`、`color(token) → [r, g, b, a]`（**r/g/b 0–255，a 0–1**，light-dark / color-mix 已求值；
  取不到 `[0,0,0,0]`）、`onColorsChange(cb) → 退订`（主题 / 配色 / 明暗 / 行内 token 变化，同一帧合并）、`overrides`（用户动过的参数）。
- `update(params, { changed, overrides })`：参数变化热更新；`reset` 可选（「恢复缺省」时调用，不实现则以缺省值调 update）。
- 约定：canvas `pointer-events: none`，指针在 window 上监听且只在 `pointer: fine` 下启用；标签页隐藏 / 不可见时暂停；
  `fps` 参数（背景缺省 30）；reduced-motion 下静态；destroy 移除 canvas / 监听 / rAF。

**运行时** `mountThemeBackground(container, { theme?, follow = true, persist, storageKey, storagePrefix })`：
跟随 `html[data-theme]` 切换；参数按主题分别持久化——nebula 用 `szyyw:dotfield`，其余 `szyyw:theme-params:<id>`，只存动过的键。
句柄：`theme` / `requested` / `meta` / `ready` / `field`（nebula 时为 DotField 句柄）/ `status(id)` / `setTheme` / `params()` /
`overrides(id?)` / `allOverrides()` / `setParams(patch)` / `resetParams()` / `subscribe(fn)` / `destroy()`。
加载失败（文件缺失 / 网络 / 模块不合规）不抛错：状态记 `failed`，保留当前背景（首挂失败回退 nebula）；
外观弹层把该主题 chip 置灰并提示，用户刚点选的会退回当前主题。

**新增一个主题**：写 `themes/<id>.js`（+ `.d.ts`），在 `themes/index.js` 登记一行、在 `appearance-data.js` 的 `THEMES` 加 id、
在 `appearance-text.js` 的 `themes` 加三语名字，跑 `node scripts/check-tokens.mjs`；需要新颜色就在 tokens.css 为
default / aurora × light / dark 各加 `--th-<主题>-*`。

**上游参数对照**（出处：React Bits，David Haz，MIT + Commons Clause）：

- CursorGrid → `cursor-grid`：`cellSize radius falloff holdTime fadeDuration lineWidth maxOpacity fillOpacity gridOpacity cellRadius clickPulse pulseSpeed`
  同名保留；`color`（hex）→ token 选择（缺省 `--accent`）；`gridOpacity` 缺省 0 → 0.08（触屏 / 减少动效时不至于全空）；新增 `fps`（30）。
- Particles → `particles`：`particleCount particleSpread speed moveParticlesOnHover particleHoverFactor alphaParticles particleBaseSize
  sizeRandomness cameraDistance disableRotation shape glow twinkle depthOfField connections connectionDistance hoverEffect hoverRadius
  clickBurst drift driftSpeed variation intro opacity paused` 同名保留；`particleColors`（数组）→ `colorA` / `colorB` 两个 token
  （缺省 `--accent` / `--accent2`）；`lightMode`（布尔）→ `auto | on | off`，auto 按解析后的 `--bg` 亮度；`pixelRatio` 0 = 跟随设备；
  新增 `fps`（30）。WebGL2 优先，降级 WebGL1（ANGLE_instanced_arrays），都没有则不画。

### §5「外观」弹层 → 改写面板结构

从上到下：**主题行**（有背景时；按注册表列出，名字优先用 `labels.themes`，其次注册表 / meta 的三语名）→ 配色行 → 明暗行 →
**鼠标效果行**（`pointer: fine` 时；`默认 / Target Cursor`）→ **主题参数**（`<details class="appearance-advanced">`，替代旧「背景参数」段；
按当前主题 `meta.params` 自动生成控件，换主题即重建；「恢复默认」只作用于当前主题）→ 版本行。

- `mountAppearancePanel({ background })`：新写法，传 `mountThemeBackground()` 的句柄；旧写法 `{ field }`（DotField 句柄）照旧可用，
  只有 nebula 的参数段、没有主题行。`cursor: false` 可隐藏鼠标效果行。
- `dotField.onSave(values, info)`：`values` 仍是当前主题动过的键（nebula 时与旧版完全相同，可直接喂 `restoreDotFieldSettings`）；
  新增第二参数 `info = { theme, params, all }`（`all` = 各主题动过的参数），想按主题存服务端就用它。
- `onChange(appearance, changed)`：`appearance` 多了 `cursor` 与 `themeParams`（当前主题动过的参数）；
  主题参数改动会以 `changed = ["themeParams"]` 去抖（600ms）通知一次。旧代码只读 theme / palette / scheme 不受影响。
- `dotField.storagePrefix`（新）：非 nebula 主题的参数存储前缀，缺省 `szyyw:theme-params:`。
- `mountAppearance()` 的返回值新增 `background`（主题背景句柄）；`field` 改为 getter：当前主题是 nebula 时为 DotField 句柄，否则 null。
- 文案新增（appearance-text，zh / ja / en）：`themeParams` `cursor` `cursors.{default,target}` `unavailable` `loading`
  `themeFailed` `cursorFailed` `noParams`，`themes` 补齐六个主题名。主题参数控件名来自各主题 `meta.params[].labels`；
  `labels.controls[key]` 仍可逐键覆盖（说明行 `${key}Hint`）。旧 `labels.background` 若给了，作为主题参数段标题的回退。

### 新增 §5.x 鼠标效果

外观弹层（或 `mountCursorEffect()`）挂着时，`data-cursor="target"` → 按需 `import("./target-cursor.js")` 并
`mountTargetCursor(options)`；选回默认 → `destroy()`。只在 `pointer: fine` 下生效。加载器与选项可换：
`configureCursorEffect({ load, options })`（`mountAppearance` / `mountChrome` 的 `appearance.cursorEffect` 同义）。
`getCursorEffectStatus()` → `off | loading | active | failed`；加载失败时弹层把 Target Cursor 置灰并提示。
引用计数：`setLocale` 重挂弹层不会让光标闪一下。

### §11 公开类与内部类

内部实现一栏加：`.appearance-status`、`.theme-param-choice`（外观弹层内部）。

## 3. README.md

- 「外观」示例后补一句：右上角外观弹层可切换主题与鼠标效果，主题参数按当前主题生成；
  `mountAppearance({ background })` 返回的 `background` 是主题背景句柄。
- API 表：
  - `./appearance` 加 `configureCursorEffect`、`mountCursorEffect`、`getCursorEffectStatus`
  - `./appearance-data` 加 `CURSORS`
  - 新行 `./theme-background`：`mountThemeBackground`、`createThemeContext`、`tokenColor`、`parseCssColor`、`themeDefaults`、`sanitizeThemeParams`、`readThemeParams`
  - 新行 `./themes` · `./themes/<id>`：`THEME_REGISTRY`、`themeEntry`、`loadTheme`、`pickLabel`；各主题 `meta` / `mount`
- 「开发」段：`check-tokens` 现在也断言 `THEMES` 与主题注册表一致；手测页加 `demo/themes.html`（`?cursorStub=1` 用页内桩代替 target-cursor.js）。

## 4. CHANGELOG（v0.19.0 草稿条目，框架部分）

- 新增：可插拔背景主题。`html[data-theme]` 取值扩展为 `nebula` / `cursor-grid` / `gradient-waves` / `side-rays` / `pixel-blast` / `particles`；
  切换不刷新页面，只加载当前主题。新模块 `theme-background`、`themes/`（注册表 + 主题模块接口）。
- 新增：主题「光标网格」（React Bits CursorGrid 移植）、「粒子」（React Bits Particles 移植，WebGL2 / WebGL1）。
- 新增：鼠标效果 `html[data-cursor]`（默认 / Target Cursor），随外观持久化（`<prefix>cursor`）。
- 变更：外观弹层新增主题行、鼠标效果行；「背景参数」段改为通用「主题参数」段，按当前主题参数表生成，每个主题分别持久化。
- 变更：配色对所有主题通用；`normalizeAppearance` / `readAppearanceFromCookies` / `appearanceAttrs` / `appearanceCookieNames` 增加 cursor。
- 兼容：nebula 参数沿用 `szyyw:dotfield`；`mountDotField` / `mountDotFieldSettings` / `restoreDotFieldSettings` /
  `mountAppearancePanel({ field })` 不变；`onSave` 第一个参数不变（新增第二参数）；旧首屏片段可继续使用。
- 注意（vendored 项目）：`appearance.js` 现在依赖 `theme-background.js`、`themes/index.js`、`themes/nebula.js`，同步清单要带上。
