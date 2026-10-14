# Changelog

## v0.21.0 — 2026-10-14

**主题缺省随机、移除 aurora 配色、Target Cursor 修复**（DESIGN.md §2、§2.1、§2.2、§5、§16）。

**可见变化**
- **主题缺省「随机」**：外观弹层主题行第一个新增「随机」（zh 随机 / ja ランダム / en Random），并成为缺省。每个时间段（缺省 1 天，按本地日期换日）
  从全部主题里均匀抽一个，同一时间段内所有页面、所有标签页一致；换段时避开上一次抽中的主题。选中随机时提示行显示「本次：<主题名>」，
  主题参数段显示实际主题的参数。面板里从别的主题切回随机会立即重抽并开始新的时间段。抽到的主题加载失败会排除它再抽，全部失败回退星云。
- **移除「极光翠青」（aurora）配色**：tokens.css 的 `:root[data-palette="aurora"]` 两段（基础 token 与 `--th-*` 主题 token）、`PALETTES`、
  三语文案与 demo 里的切换按钮一并删除。存着 `aurora` 的用户回到缺省配色，首屏不闪。
- **只有一种配色时外观弹层不显示「配色」栏**（以后加回配色自动出现）。
- **Target Cursor**：修复点外观弹层右上角 ✕ 后准星跳到页面左上角——吸附中的按钮随弹层 `display: none`，矩形变成 (0, 0) 的 0×0，准星按它吸附。
  现在每帧校验吸附目标（脱离文档 / 不可见 / 尺寸为 0 / 不在指针下方即解除，回到真实指针位置），关闭弹层、换路由、移除元素、`hidden` 都覆盖；
  同时修复帧间隔变长（掉帧、切回标签页）时弹簧积分发散、准星飞出屏幕。

**接口**
- `./appearance-data`：`THEMES` 第一项为 `{ id: "random", random: true }`；`DEFAULT_APPEARANCE.theme = "random"`；未知主题回退 `random`（原 nebula）。
  新增 `RANDOM_THEME`、`REAL_THEME_IDS`、`FALLBACK_THEME`、`resolveThemeChoice(stored, explicit)`、`isRealTheme`、`pickRandomTheme`。
  `APPEARANCE_COOKIES` / `appearanceCookieNames(prefix)` 增加 `themeSet`（`<prefix>theme_set`）。`PaletteId` 只剩 `"default"`；新增类型 `ThemeChoice`。
- `appearanceAttrs`：theme 为 random 时不写 `data-theme`，写 `data-theme-mode="random"`（服务端不知道客户端会抽到哪个；配色与明暗照常铺）。
- `<html>`：`data-theme` 永远是实际挂着的主题，随机模式另有 `data-theme-mode="random"`。
- `./appearance`：`getAppearance()` / `onChange` / `onAppearanceChange` 的外观对象多 `resolvedTheme`（实际主题），`theme` 可为 `"random"`。
  新增 `randomEvery` 选项（`"day"` 缺省 / `"week"` / 毫秒数；`mountAppearance`、`mountChrome` 的 `appearance`、`configureAppearance` 均可传）、
  `rerollRandomTheme(failedId)`、`randomPeriodExpired(at, now, every)`。抽中的主题存在 localStorage `<主题键>_random`（不可用时退回同名 cookie）。
- 文案新增 `randomNow`、`themes.random`；删除 `palettes.aurora`。`scripts/check-tokens.mjs` 增加随机项、缺省主题与三语文案的检查。

**迁移规则**（一次性，cookie 与 localStorage 两种 persist、服务端读取与首屏片段同一条）
- 新增显式选择标记 `<主题键>_set`（如 `fl_theme_set=1`）。没有标记时，已存的 `nebula`（v0.19.0 之前唯一的主题，只能是缺省值）/ 缺省 / 非法值视为 `random`；
  已存的其他真实主题（v0.19.0 里用户点过的）保持。用户此后在面板里显式选任何主题（含 nebula、含随机）就写入标记，按其选择保持。

**首屏片段更新**（DESIGN.md §2.1）
- 静态页片段多读 `<prefix>theme_set`：随机 / 待迁移时只写 `data-theme-mode="random"`，实际主题由 `configureAppearance` 抽定后写入 `data-theme` 再挂背景。
  旧片段照旧可用（主题、迁移与已移除的配色都会被 `configureAppearance` 校正，不闪错色）。
- SSR：`readAppearanceFromCookies` 已含迁移，`appearanceAttrs` 按上面写属性；React 系应用给 `<html>` 加 `suppressHydrationWarning`（客户端会补 `data-theme`）。

**应用侧需留意**
- 服务端校验主题 / 配色白名单的：主题接受 `random`，配色去掉 `aurora`（或直接用 `normalizeAppearance`）。
- 保存账号级外观偏好的：`theme` 可能是 `"random"`；`resolvedTheme` 只供展示不要存。v0.19.0 期间存进库的 `nebula` 多半是缺省值，
  写回时连同显式标记一起存，或用 `resolveThemeChoice(theme, explicit)` 迁移。

## v0.20.0 — 2026-10-14

**新增分页器**（DESIGN.md §16.1）。纯新增，旧标记不受影响。

- `./pager`（`mountPager` / `pageItems`）：总数与范围、每页条数、首页 / 上一页 / 页码（省略号）/ 下一页 / 末页、跳页、← → 翻页、`setBusy`；
  zh / ja / en 文案，`labels` 可覆盖；窄屏收成「当前 / 总页数」。
- 新公开类 `.pager` 一族（components.css 末尾）。

## v0.19.0 — 2026-10-14

**背景主题可插拔、鼠标效果、一批交互组件与控件**（DESIGN.md §2、§4.1–§4.2、§5、§16、§17）。纯新增为主；可见变化是 toast 与 `.switch` 的新外观。

**新增**
- 背景主题：`html[data-theme]` 取值扩展为 `nebula`（缺省）/ `cursor-grid`（光标网格）/ `gradient-waves`（渐变波浪）/ `side-rays`（侧光）/
  `pixel-blast`（像素爆破）/ `particles`（粒子），新增 5 个；切换不刷新页面，只加载当前主题。上游参数全部保留，**每个主题的参数都在外观弹层里可调**
  （按主题 `meta.params` 自动生成控件），每个主题分别持久化。WebGL 主题为原生 WebGL2（降级 WebGL1）、零依赖，带 fps / DPR 上限、
  视口外与隐藏标签页暂停、丢上下文恢复；颜色全部取自 token，配色 / 明暗切换即时换色。
- 新模块 `./theme-background`（`mountThemeBackground` 等）、`./themes`（注册表 `THEME_REGISTRY` / `loadTheme`）与 `./themes/<id>`（主题模块接口见 `themes/types.d.ts`）。
- 新 token：`--th-gradient-waves-horizon / -wave / -crest`、`--th-side-rays-1 / -2`、`--th-pixel-blast-color`（default / aurora × light / dark）。
- 鼠标效果 `html[data-cursor]`：默认 / Target Cursor，外观弹层里切换（仅精确指针设备），选回默认完全恢复系统光标；随外观持久化（`<prefix>cursor`）。
  `./appearance` 新增 `configureCursorEffect`、`mountCursorEffect`、`getCursorEffectStatus`，`./appearance-data` 新增 `CURSORS`。
- `./target-cursor`（`mountTargetCursor`）、`./gradual-blur`（`mountGradualBlur` / `enhanceGradualBlur`，不默认挂到任何页面）、
  `./branched-menu`（`mountBranchedMenu`，备用组件，未接入现有界面）。
- Swipe Toast：`toast()` 新增可选项 `title`、`action`、`icon`、`closeButton`、`pauseOnHover`、`onClose(reason)`。
- Squish Switch：`./switch` 的 `enhanceSwitches()` 为 `.switch` 加指针拖动、速度拉伸与回弹（可选）；`.switch` 新增 `--sw-*` 旋钮与 `:focus-visible` 描边。
- `./glide-select`（`enhanceSelect` / `enhanceSelects`，原生 `<select>` 的渐进增强）、`./status-mark`（`mountStatusMark` / `enhanceStatusMarks`）、
  `./lattice-loader`（`mountLatticeLoader`，方格波浪 + 秒表）。新公开类见 DESIGN.md §11。
- DESIGN.md §17「出处与许可」：React Bits 移植件（MIT + Commons Clause）与 Hugeicons 图标的统一说明。

**可见变化**
- toast 换成 Swipe Toast 外观：卡片带标题 / 描述排版、按 tone 的线性图标（不再是实心圆点）、底边剩余时间引线，可下滑或 Esc 关闭；
  `toast(message, { tone, timeout })` / `clearToasts()` 的调用与语义不变。components.css 中段被覆盖的旧 toast 规则与 `@keyframes toast-in / toast-out` 已删除。
- `.switch` 换成 Squish 动效（颜色渐变、按下压扁、过冲回弹），标记、尺寸与布局不变；`prefers-reduced-motion` 下无位移动效。
- 外观弹层：新增主题行与鼠标效果行；「背景参数」段改为通用「主题参数」段。
- 配色对所有主题通用（不再随主题过滤）。

**兼容**
- nebula 参数沿用 `szyyw:dotfield`（其余主题 `szyyw:theme-params:<id>`）；`mountDotField` / `mountDotFieldSettings` / `restoreDotFieldSettings` /
  `mountAppearancePanel({ field })` 不变；`dotField.onSave` 第一个参数不变，新增第二参数 `{ theme, params, all }`；
  `onChange` 的 appearance 多了 `cursor` 与 `themeParams`。`mountAppearance()` 返回值新增 `background`，`field` 在非 nebula 主题时为 null。
- `appearanceCookieNames` / `readAppearanceFromCookies` / `normalizeAppearance` / `appearanceAttrs` 增加 cursor，只传三项键名的旧调用照旧可用；未知主题 id 回退 nebula。
- 静态页首屏片段推荐多读一个 cursor 键（DESIGN.md §2.1），旧片段可继续使用。
- `corner.css` 重新生成（`.switch` 新规则）。

**升级提示**
- **vendored 项目必须用 v0.19.0 的 `sync.sh`**：`appearance.js` 现在静态依赖 `theme-background.js`、`themes/index.js`、`themes/nebula.js`，
  用旧清单同步会让外观整体加载失败。新清单含 `themes/` 子目录（含 WebGL 主题共用的 `themes/_gl.js`）与全部新模块。
- CDN 项目只改版本号即可（模块之间相对 import，主题按需加载）。
- 自己在 CSS 里覆写过 `.toast` / `.toast-icon` / `.switch` 外观的应用检查一下效果。

## v0.18.0 — 2026-10-14

**新标题字样**（取自门户主页左上角，DESIGN.md §7「标题字样」）。`.app-title` 的外观是**有意的可见变化**，其余类与函数行为不变。

**变化**
- `.app-title`：700 + 整行 `--grad` 渐变、26px（≤640px 22px）、`line-height: 1.25`、`letter-spacing: 0.01em`
  → **Geist 600、整行纯色 `var(--text)`、`clamp(28px, 7vw, 44px)`、`line-height: 1.1`、`letter-spacing: -0.01em`**。
  去掉了 `background` / `background-clip: text` / `color: transparent`；想保留一段渐变就在标题里用 `<span class="grad-text">…</span>`。
  另加 `text-wrap: balance`：375 宽时约 28px，11 个字的长标题在页头里均分成两行、不溢出、不留单字孤行。
- `mountChrome` 的 `techText` 缺省由 `false` 改为**开启**，缺省选择器 `".app-title, .wordmark"`；`techText: false` 可关闭，字符串 / 对象写法照旧。
  新增跟进：MutationObserver 观察 `document.body`（childList + subtree），之后插入的匹配元素自动增强、脱离文档的元素销毁 handle；
  `handle.techText` 是当前 handle 数组，`destroy()` 断开观察并全部销毁。

**新增**
- 公开类 `.wordmark`：与 `.app-title` 同字体 / 字重 / 字距 / 纯色，不设字号（继承），用于登录页等非左上角标题。
- 字体 `fonts/Geist-Variable.woff2`（Geist 1.7.2 可变字重，SIL OFL 1.1，许可原文 `fonts/OFL.txt`），`package.json` `files` 加入 `fonts/`；
  `components.css` 顶部 `@font-face "Geist"`（相对 URL，`font-display: swap`）。缺字体时回退到正文字体链。
- `sync.sh`：`FILES` 加入 `fonts/Geist-Variable.woff2` `fonts/OFL.txt`，支持清单里的子目录；`VENDORED.md` 清单行的 sed 改用 `|` 分隔（清单含 `/`）。

**升级提示**
- 不想要 TechText 的应用传 `techText: false`；自己调过 `enhanceTechText(".app-title")` 的可以删掉（重复挂载返回同一 handle，不删也无害）。
- 覆写过 `.app-title` 字号 / 渐变的应用检查一下左上角；用旧版 `sync.sh` 同步 v0.18.0 不会带上 `fonts/`（标题回退到正文字体），请用 v0.18.0 的 `sync.sh`。
- `corner.css` 不变。

## v0.17.0 — 2026-10-13

纯新增（month 修复除外），既有类与函数行为不变；设计细则见 DESIGN.md §15，手测页 `demo/utilities.html`。

**新增**
- 清除键契约 `.field-wrap` + `.field-clear`（框内最右、可点区域 ≥ 32px）。
- 工具类（`u-` 前缀）：`.u-m0`、`.u-mt-1…4`、`.u-mb-1…4`、`.u-gap-1/2/3/4/6`（能压过 `.row/.stack/.spread` 的 10px）、`.u-ai-center/start`、`.u-jc-between`、
  `.u-nowrap`、`.u-flex-none/1`、`.u-min-w-0`、`.u-clickable`、`.u-fw-600/400`、`.u-block`、`.u-ta-right`。
- `.field.w-sm/.w-md/.w-lg`、`.sub-hint`、`.inset-list` + `.row-hover`、`.chip-group` + `.chip-group-label`、`.field-inset` + `.icon-grid`、
  `.btn-icon`（`.xs`）、`.msg-list` / `.msg-item`、`.back-link`。
- JS `./overlay`：`mountOverlay(overlayEl, { onClose, lockScroll })`——按下与松开都在遮罩上才关、嵌套滚动锁引用计数、Esc 关最上层；SSR 可 import。
  `sync.sh` 的 `FILES` 同步加入 `overlay.js`。

**修复（month iOS）**
- `input[type="month"].field` 与 date / datetime-local 同款处理（收缩、左对齐、`::-webkit-date-and-time-value` 左对齐），
  并排时不再被 iOS 固有宽度截断。这是唯一的既有行为变化。

## v0.16.0 — 2026-10-12

**新增 `.section-head`**（`components.css`，DESIGN.md §13.1）：分区标题行（`.section-name` + 右侧操作按钮），行下 12px，窄屏换行 8px 12px，内部 `.section-name` 边距归零。
修复「`.spread` + `.section-name` 的按钮贴着下方内容」这一通用缺陷。纯新增，`.spread` / `.section-name` 不变，既有页面零视觉差异。

## v0.15.0 — 2026-10-09

**新增 TechText 字标**（`./techtext`，新文件 `techtext.js` / `techtext.d.ts`，已进 `exports` / `files` 与 `sync.sh` 清单）。纯新增、缺省不开，向后兼容：
v0.14.2 的 `demo/appearance.html`、`demo/forms.html`、`demo/components-v013.html`、`demo/components-v014.html`（dark / light × 1024 / 375）逐元素计算样式与位置零差异。

- `mountTechText(el, options?)` → `{ refresh(), destroy() }`；`enhanceTechText(selectorOrRoot = ".app-title", options?)` → handle 数组。
  把已有标题渐进增强为 canvas 字标，缺省与 React Bits 官方演示一致：`reveal: "letter"`（只揭示光标下的那个字母，配选框 / 四角 / specks / 标注）、
  `sweep: "loop"`（无指针时扫描点在文字上往复，选框逐字跳）、`specks: 15`；字母可拖离基线、松手弹簧回位。
  文字 / 字体 / 逐字位置都取自 DOM，启用前后布局零位移；原文字留在无障碍树（填充透明），canvas `aria-hidden`；
  渐变字逐段按元素自己的 `background-image` 原样画（含 `<span class="grad-text">` 混排），主题 / 配色 / 明暗变化只换色不重建。
  参数按字号缩放，字号 < `minLabelFont`（18）不画标注；悬停只在 `pointer: fine`；拖拽鼠标 / 触屏都可用（`touch-action: pan-y`），
  拖拽后的 click 与原生链接拖拽被拦下（元素在 `<a>` 里不误跳转）；reduced-motion 静态显示；forced-colors 与打印不启用。
  性能：所有实例共用一个 rAF，无交互时限 30fps，离开视口 / 隐藏标签暂停。
  首帧同步绘制、画成功后才隐藏原文字（修掉了预发布版本在后台标签 / 隐藏窗格里加载时整段空白、画布停在 300×150 的问题）。
- `mountChrome({ techText })`：`true` = `enhanceTechText(".app-title")`，也可传选择器或 `{ selector, ...选项 }`；缺省不开。`handle.techText` 为 handle 数组，`destroy()` 一并销毁。
- `components.css`：`.tech-text` 选中色、`.tech-text-canvas`（定位等由 JS 写行内样式，不加载 components.css 的应用也能用）。`corner.css` 不变。
- DESIGN.md §14（出处、许可、API、使用场合、可访问性约定），§11 公开 API 清单；新增 `demo/techtext.html`（尺寸 20 / 28 / 40、中英日、文字动态变化、
  非渐变字、「全部域名」字标列表）。
- 出处：React Bits「TechText」（Copyright (c) 2026 David Haz），许可 MIT + Commons Clause License Condition v1.0；参考件在 `reference/reactbits/`（gitignored）。
  Commons Clause 限制再分发组件本身；包作者知情并决定随本包发布供自己的站点使用，见 DESIGN.md §14。

## v0.14.2 — 2026-10-09

- **毛玻璃在 Next.js 应用的 Chrome / Android 上失效**：`components.css` 里 7 处都是先写 `backdrop-filter` 再写 `-webkit-backdrop-filter`，Next.js 的 CSS 处理（lightningcss）会把这种顺序里的标准属性吞掉，只留带前缀的那条，Chrome 算出 `none`——`.glass` / `.overlay` / `.sheet` / `.corner-panel` / `.menu` / `.drawer` 全都没有模糊（手机弹层「透字」就是这个）。改为先 `-webkit-` 后标准，两条都会保留。Safari 与不经构建直接引用（vendored）的应用本来就正常。cosme 定位。`corner.css` 已重新生成。

## v0.14.1 — 2026-10-09

- **`[hidden]` 永远隐藏**：`components.css` 加全局 `[hidden] { display: none !important }`。之前 `.overlay`（flex）、`.stack`、`.callout`、`.row` 等自带 `display` 的类会盖掉 `hidden` 属性（某看板类应用迁移时复盘页一块空表单因此一直露着），应用只能各补 `.x[hidden]` 兜底——现在可以删掉这些兜底。可见变化：只影响「写了 `hidden` 却被类的 display 显示出来」的元素，它们现在按本意隐藏。`corner.css` 不含全局规则，不变。

## v0.14.0 — 2026-10-09

各应用迁到设计包时发现的缺口（cosme-vault 迁移为主）。**纯新增、向后兼容**：v0.13.1 的 `demo/appearance.html`、`demo/forms.html`、
`demo/components-v013.html`（dark / light × 1024 / 375 × 外观弹层开合）逐元素计算样式与位置零差异。
唯一会影响已有标记的一处：`.sheet-head` 里**只有**一枚 `.close-x`（没有标题）时，✕ 从靠左改为靠右、头部从 57px 收到 41px。

- **`.sheet.wide`**：宽版弹层，桌面 `max-width: 760px`（普通 560px），给「大图 + 键值表」的详情（cosme 奖品详情）；手机仍是底部全宽抽屉。
- **无标题 `.sheet-head`**：头里只放 `.close-x` 时自动 `justify-content: flex-end` + `padding: 10px 18px 0`（✕ 与有标题时同一右缘）。
  选择器 `.sheet-head:where(:has(> .close-x:only-child))`，特异性与 `.sheet-head` 相同。DESIGN.md §8 有示例。
- **`.term-lvl:disabled` / `.term-copy:disabled`**：熄灭态（`--term-dim` 60%、无描边、`not-allowed`，悬停不亮；active 的级别禁用后也熄灭）。
- **`.pill.slate` / `.pill.pink`**：slate = 中性灰蓝「未知 / 未定」（cosme「未知模式」，与 amber「已下架」、violet「待选择」分开），pink = 补充色。
  新 token `--slate` `--pink` `--tint-slate-bg` `--tint-pink-bg`（default 与 aurora 各一套，light-dark；aurora 的 slate 略偏青）。corner.css 随之重建。
- **外观弹层内置「仅本地保存」提示**：`dotField.note: true`（`mountAppearance` / `mountAppearancePanel` / `mountChrome` 的 `appearance.dotField`，
  以及 `mountDotFieldSettings({ note: true })`）显示内置文案 `localOnly`：「仅保存在本浏览器」/「このブラウザにのみ保存されます」/「Saved in this browser only」，
  随 locale 切换；`labels.localOnly` 可改词；传字符串照旧原样显示。cosme 迁移时这句因包无内置文案而丢了。
- **`--sheet-bg` 不变**（评估结论）：375 宽、背后满屏文字、light / dark × default / aurora 实测，标准用法（`.overlay` 遮罩模糊 + 92% / 94% 底色）下
  弹层空白区亮度起伏约 2/255，背后文字不可辨；去掉遮罩模糊（弹层自身 18px 模糊仍在）也是约 2/255。只有 `backdrop-filter` 完全失效时
  起伏约 8/255、能看出字形——那是挂载方式问题（弹层应 Portal 到 body 下、配 `.overlay`），不靠调 token 解决。
- DESIGN.md：§12「替代谁」更正——cosme 的 `.acct-seg` 是账号进度条色段，不是分段控件，不是 `.seg` 的替代对象；新增 §13（v0.14.0 对照表），§11 公开类清单补齐。
- 新增 `demo/components-v014.html`（不进 `files`）。

## v0.13.1 — 2026-10-09

- 修 `--lift-shadow`：之前把整条阴影写进 `light-dark()`（它只接受颜色），浏览器算成 `none`，`.lift:hover` 的投影从未生效。改为 `--lift-shadow-color: light-dark(…)` + `--lift-shadow: 0 10px 32px var(--lift-shadow-color)`。可见变化：`.lift` 卡片悬停时出现设计稿里本来就有的投影。

## v0.13.0 — 2026-10-09

补齐各应用自写 / 借用内部类的缺口（审计了 portal、jppost-tracker、claude-bridge、cosme-vault 及另外几个私有应用）。
**纯新增、向后兼容**：既有类 / 函数 / DOM / 存储键对现有标记不变——v0.12.0 的 `demo/appearance.html`、`demo/forms.html`
（dark / light × 1024 / 375 × 外观弹层开合）逐元素计算样式与位置零差异；切换器 / 账户菜单不传 locale 时 DOM 逐字节相同。
例外（规格明确要求、会影响已有标记的三处）：已禁用的 `.field` 现在显示熄灭态（之前与可用态无区别）、`.switch:disabled` 同理、
写了 `class="field small"` 的元素变紧凑（某看板类应用唯一用处有自己更高特异性的覆盖，实际无变化）。

- **工具位按钮公开化**（给 portal 的管理 / 账户 / 退出、某记账类应用的通知等）：`.corner-tool` 移入公开 API（样式不变）；
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
  `.tabs/.tab`（与 jppost / 某看板类应用自写的 `.tab` 同外观）`.seg` toast（新 `toast.js`，`./toast`：`toast(msg, { tone, timeout })` / `clearToasts()`）
  `.field.small` `.field:disabled` `.switch:disabled` `.spinner` `.tbl.sticky` `.tbl.hover` `th[aria-sort]` `th.sorted` `.col-num`
  `.menu/.menu-item`（新 `menu.js`，`./menu`：`attachMenu()` 打开时搬到 body 下 fixed 定位，表格里不被裁）`dl.kv` `.drawer`（z 51）`.app-header/.app-brand/.app-title/.app-sub/.app-actions`。
- **tokens**：`--chart-1…6`（default / aurora 各一套，light-dark）、`--pop-shadow`（+ `--pop-shadow-color`）、`--on-err`、`--corner-gap`。
  `check-tokens.mjs` 照旧通过。
- `.tbl .num` **没有**改成右对齐（某记账类 / 某控制台类应用的表格用 `.num` 标日期与计数，改了会跳）；数字列右对齐用新的 `.col-num`。
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

- v0.4.0 破坏性变更：`.scheme-toggle` 不再自带 fixed 定位——定位归 `.corner-tools`，按钮长相归 `.corner-tool`。走 `mountSchemeToggle()` 的项目无需改动；手写 `<button class="scheme-toggle">` 的静态页要改成 `class="corner-tool scheme-toggle"` 并套一层 `.corner-tools`。
