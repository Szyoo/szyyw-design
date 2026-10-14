# controls：并入 DESIGN / README / CHANGELOG 的内容

## CHANGELOG（v0.19.0 条目素材）
- `.switch` 升级为 Squish 动效：标记与尺寸不变；颜色渐变、按下压扁、滑块带过冲回弹地滑动（纯 CSS）；新增 `:focus-visible` 描边；新增可调变量 `--sw-w / --sw-h / --sw-inset / --sw-r / --sw-dur / --sw-fade / --sw-squish / --sw-hover`；`prefers-reduced-motion` 下无位移动效。
- 新增 `switch.js`：`enhanceSwitches(root?, options?)`，指针拖动滑块、按速度拉伸、松手挤压回弹（渐进增强，可选）。
- 新增 `glide-select.js`：`enhanceSelect(select, options?)` / `enhanceSelects(root?)`，原生 `<select>` 的渐进增强。
- 新增 `status-mark.js`：`mountStatusMark(el, options)` / `enhanceStatusMarks(root?)`。
- 新增 `lattice-loader.js`：`mountLatticeLoader(el, options)`。
- 新公开类：`.glide-select*` `.glide-native` `.status-mark*` `.lattice-loader*`（见下）。
- 出处：移植自 React Bits（David Haz，MIT + Commons Clause）的 Squish Switch / Glide Select / Status Mark / Lattice Loader；零依赖，图标为内联 SVG。

## DESIGN.md
### §10 表单：.switch
- 标记仍是 `<input type="checkbox" class="switch">`，布局零变化（40×22，flex: none）。
- 不挂 JS：颜色渐变（`--sw-fade`）、按下滑块横向压扁（`--sw-squish`）、悬停轻微膨胀（`--sw-hover`，仅 `hover: hover`）、滑动带过冲缓动（`--sw-dur`）。
- 挂 `enhanceSwitches()` 后：指针拖动（跟手，无过渡）、拖动时按速度横向拉伸、松手按落点（过半）切换并带回弹。
  语义与原生 checkbox 一致：点击 / 空格 / label / 表单 / reset 全是浏览器原生；拖动只在落点与当前状态不同时产生一次原生 click → `input` / `change`，Esc 或取消还原。
- 选项（也可写 `data-stretch` / `data-hover-scale` / `data-speed` / `data-color-duration` / `data-width` / `data-height` / `data-radius`）：`stretch` 36、`hoverScale` 1.035、`speed` 50、`colorDuration` 200、`width` / `height` / `radius`。
- 对照上游 SquishSwitch：`checked/defaultChecked/onChange` = 原生 checkbox；`label` = 外层 `<label>`；`trackColor` 等颜色改为 token（`.switch` 的背景 / `--grad`）；`width/height/radius/speed/stretch/hoverScale/colorDuration` 保留；`ariaLabel/className/id` 用原生属性。

### Glide Select（glide-select.js）
- `<select class="field" data-glide>` + `enhanceSelects()`；或 `enhanceSelect(el, options)` → `{ refresh(), destroy() }`。
- 原生 select 视觉隐藏（`.glide-native`）但留在 DOM，是真实数据源；选中时写 `selectedIndex` 并依次派发冒泡的 `input`、`change`；外部写 `value` / `selectedIndex` 自动同步且不派发事件（不会与受控组件回环）；option 列表 / disabled / 文案 / `data-tag` 由 MutationObserver 同步；`form.reset()`、`<label for>` 点击（焦点转给触发器）都处理。不支持 `multiple`。
- 触发器：`select.field` → 触发器带 `.field`（+ `.small`）完全沿用 `.field` 外观；非 `.field` → 紧凑玻璃小块（`size` sm / md / lg）。
- 菜单挂 `<body>` fixed 定位（不被 `.table-wrap` 裁、不被 `.glass` backdrop-filter 困住），放不下自动翻转，过长出滚动条；页面滚动 / 缩放关闭。
- 键盘 ↑↓ Home End Enter / Space Esc Tab + 字母键前缀跳转；aria：`role=combobox` + `aria-activedescendant`，`listbox` / `option` / `group`；触屏在无滚动时可按住拖选。
- 选项（`data-glide-<kebab>` 同名）：`placeholder` `showTags`（option 的 `data-tag`）`accent` `surface` `highlight` `text`（token 名或 CSS 颜色）`size` `radius` `menuWidth` `placement` `align` `popDuration` `glideDuration` `rememberPosition` `ariaLabel` `className`。
- 对照上游 GlideSelect：`options/value/defaultValue/onChange/disabled` = 原生 select 的 option / value / change / disabled；其余同名保留；`menuWidth` 缺省改为「不小于触发器、按内容」。

### Status Mark（status-mark.js）
- `mountStatusMark(el, { status, progress, label, … })` → `{ set(partial), destroy() }`；声明式 `<span class="status-mark" data-status="running" data-progress="0.4" data-label="…">` + `enhanceStatusMarks()`（挂载后监听 `data-status` / `data-progress` / `data-label`）。
- status：`pending` `running` `done` `failed` `cancelled`，别名 `idle`（= pending）、`error`（= failed）。running 无 progress = 不定进度。
- 选项（上游全部）：`color` `doneColor`（缺省 `--ok`）`errorColor`（缺省 `--err`）`size` `strokeWidth` `dashes` `fontSize` `spinDuration` `arcLength` `drawDuration` `fillOpacity` `strike` `strikeDelay`；另加 `texts`（读屏文字覆盖）。
- reduced-motion：不转圈（不定进度改呼吸）、勾叉直接出现、划线淡入。

### Lattice Loader（lattice-loader.js）
- `mountLatticeLoader(el, { label, doneLabel, errorLabel, status, showTimer, elapsed, … })` → `{ set(partial), destroy() }`。
- 方格波浪 + 实时秒表（`tabular-nums`，100ms 刷新）；`status` 切到 `done` / `error` 时方格拼成 ✓ / ✕ 并定格用时，切回 `working` 从 0 重计；`elapsed`（秒）给了就由外部控制秒表。
- 选项（上游全部）：`pattern`（命名或自定义）`grid` 3|4 `shape` `color` `doneColor` `errorColor` `cellSize` `gap` `fontSize` `step` `idleOpacity` `glow` `glowColor`。
- 用法：替代长任务的「加载中…」；`role="status"`，状态变化时播报「文字 + 用时」。

### §11 公开类追加
`.glide-select`（`__trigger` `__label` `__chevron` `__menu` `__list` `__group` `__group-label` `__pill` `__option` `__name` `__tag` `__check`）`.glide-native` `.status-mark`（`__glyph` `__track` `__ring` `__check` `__cross` `__label` `__strike` `__sr`）`.lattice-loader`（`__grid` `__layer` `__run` `__mark` `__cell` `__label` `__text` `__timer` `__sr`）；`.switch` 的 `.is-dragging`（switch.js 拖动中状态类）。

## README
- 模块表追加四行：`@szyyw/design/switch` `/glide-select` `/status-mark` `/lattice-loader`。
- vendoring 清单（sync.sh）追加：`switch.js glide-select.js status-mark.js lattice-loader.js`。
