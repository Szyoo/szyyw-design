# docs-pending · themes-webgl

供合并时并入 DESIGN.md / README.md / CHANGELOG.md 的内容。

## 新增运行时文件与导出（package.json / sync.sh）

| 文件 | 建议导出路径 |
|---|---|
| `themes/_gl.js` + `themes/_gl.d.ts` | 不单独导出（内部共用；三个主题 `import "./_gl.js"`，必须进 `files`） |
| `themes/gradient-waves.js` + `.d.ts` | `./themes/gradient-waves` |
| `themes/side-rays.js` + `.d.ts` | `./themes/side-rays` |
| `themes/pixel-blast.js` + `.d.ts` | `./themes/pixel-blast` |

`_gl.js` 引用了 `../dotfield.js` 的 `resolveTokenColor`（缺省 ctx 用），dotfield.js 本来就在 files 里。
`demo/themes-webgl.html` 是手测页，不进 files。

## CHANGELOG 条目（草稿）

- 新背景主题（原生 WebGL，WebGL2 优先、降级 WebGL1，零依赖）：
  `gradient-waves`（渐变波浪）、`side-rays`（侧光）、`pixel-blast`（像素爆破，含液态拖尾 / 噪点的第二遍渲染）。
  移植自 React Bits GradientWaves / SideRays / PixelBlast（David Haz，MIT + Commons Clause），上游参数全部保留。
- 新 token：`--th-gradient-waves-horizon / -wave / -crest`、`--th-side-rays-1 / -2`、`--th-pixel-blast-color`
  （default 与 aurora 配色、light 与 dark 各一套）。

## DESIGN.md 新段落（草稿）：WebGL 背景主题

三个主题都按「主题模块接口」写（`meta` + `mount(container, params, ctx)` → `{ update, destroy, webgl }`），
共用 `themes/_gl.js`：

- **上下文**：先 `webgl2` 后 `webgl`；着色器源码统一写 GLSL ES 1.00，WebGL2 下自动加 `#version 300 es` 头
  （`attribute/varying/gl_FragColor/texture2D` 用宏换成 300 es 写法），WebGL1 需要 `fwidth` 时自动开
  `OES_standard_derivatives`。都拿不到或着色器编译失败：`mount` 不抛错，container 留 `background: var(--bg)`，
  返回 `webgl: false` 的空 handle，由框架决定回退到哪个主题。
- **画布**：`pointer-events: none`、铺满 container；像素比 = `min(devicePixelRatio, maxDpr)`（参数，缺省 1.5）；
  ResizeObserver + window resize（DPR 变化）。全部输出**预乘 alpha**。
- **丢上下文**：`webglcontextlost` 时 `preventDefault` 并停画，`webglcontextrestored` 后重建程序 / 缓冲 / 纹理继续，
  canvas 不换。
- **帧循环**：`fps` 参数（缺省 30）限帧；时间按真实间隔累加、单帧最多补 100ms（暂停恢复不跳）；
  标签页隐藏、container 不在视口时停 rAF；`prefers-reduced-motion` 时不进循环，只在挂载 / 参数变化 / 换色时画一帧静态图。
- **取色**：颜色参数是 `type: "token"`，值为 token 名（options 里是主题自有 token + `--accent` / `--accent2` /
  `--df-from` / `--df-to` / `--text` / `--text-dim`）。经 `ctx.color()` 解析成 rgba，`ctx.onColorsChange` 时即时换色、不重建。
  **token 的 alpha 是强度系数**：浅色模式的主题 token 用较低 alpha，叠在浅底上不刺眼、不抢正文。
- **指针**：只在 `pointer: fine` 且非 reduced-motion 时在 window 上监听，不拦截页面点击。
- **参数热更新**：除 PixelBlast 的 `antialias`（上下文属性，内部重建）外都只改 uniform。

### 参数对照（上游 prop → 本包 key；缺省值与上游相同，颜色改 token）

**gradient-waves**（React Bits GradientWaves）

| key | 类型 / 范围 | 缺省 |
|---|---|---|
| horizonColor / waveColor / crestColor | token | `--th-gradient-waves-horizon` / `-wave` / `-crest`（上游 #5227FF / #FF9FFC / #FFFFFF） |
| speed | 0–2 | 0.4 |
| amplitude | 0–6 | 2.5 |
| waveScale | 0.1–2 | 0.6 |
| waveRatio | 0.1–3 | 0.9 |
| swell | 0–80 | 35 |
| turbulence | 0–60 | 20 |
| tilt（弧度） | 0–2 | 1.11 |
| zoom | 0.3–3 | 1 |
| height | 0–15 | 5.5 |
| fogDepth | 1–50 | 15 |
| detail | low / medium / high（步进 40 / 70 / 110） | medium |
| brightness | 0.2–2 | 1 |
| opacity | 0–1 | 1 |
| mouseInteraction | toggle | on |
| parallaxStrength | 0–2 | 0.5 |
| grain | toggle | on |
| grainIntensity | 0–0.3 | 0.05 |
| fps / maxDpr（本包新增） | 10–60 / 0.5–2 | 30 / 1.5 |

**side-rays**（React Bits SideRays）

| key | 类型 / 范围 | 缺省 |
|---|---|---|
| speed | 0–10 | 2.5 |
| rayColor1 / rayColor2 | token | `--th-side-rays-1` / `-2`（上游 #EAB308 / #96c8ff） |
| intensity | 0–5 | 2 |
| spread | 0–5 | 2 |
| origin | top-right / top-left / bottom-right / bottom-left | top-right |
| tilt（度） | −90–90 | 0 |
| saturation | 0–3 | 1.5 |
| blend | 0–1 | 0.75 |
| falloff | 0.2–4 | 1.6 |
| opacity | 0–1 | 1 |
| fps / maxDpr（本包新增） | 10–60 / 0.5–2 | 30 / 1.5 |

**pixel-blast**（React Bits PixelBlast）

| key | 类型 / 范围 | 缺省 |
|---|---|---|
| variant | square / circle / triangle / diamond | square |
| pixelSize | 1–12 | 3 |
| color | token | `--th-pixel-blast-color`（上游 #B497CF） |
| antialias | toggle（改动会重建上下文） | on |
| patternScale | 0.5–8 | 2 |
| patternDensity | 0–2 | 1 |
| pixelSizeJitter | 0–1 | 0 |
| enableRipples | toggle（点击涟漪） | on |
| rippleIntensityScale | 0–3 | 1 |
| rippleThickness | 0.01–0.5 | 0.1 |
| rippleSpeed | 0.05–1.5 | 0.3 |
| liquid | toggle | off |
| liquidStrength | 0–0.5 | 0.1 |
| liquidRadius | 0.2–3 | 1 |
| liquidWobbleSpeed | 0–10 | 4.5 |
| speed | 0–3 | 0.5 |
| edgeFade | 0–1 | 0.5 |
| noiseAmount | 0–0.5 | 0 |
| transparent | toggle（关 = 底色取 `--bg`，上游是黑） | on |
| autoPauseOffscreen | toggle | on |
| fps / maxDpr（本包新增） | 10–60 / 0.5–2 | 30 / 1.5 |

### 与上游的差异（都是有意的）

- ogl / three / postprocessing → 原生 WebGL。PixelBlast 开 `liquid` 或 `noiseAmount > 0` 时：
  第一遍画进帧缓冲（RGBA8 纹理），第二遍全屏着色器做 UV 扭曲（拖尾纹理 = 64×64 的 2D 画布，同上游）与叠噪点，
  对应上游 EffectComposer 的 RenderPass + EffectPass；都关时一遍直出。
- SideRays 上游画布是非预乘 alpha，这里输出预乘形式，合成结果一致；上游每次改参数都重建上下文，这里只改 uniform。
- PixelBlast 上游 sRGB→线性→sRGB 的颜色往返净效果为原色，这里直接用 token 色；时间按 `speed` 积分（上游改速度时相位会跳）；
  液态拖尾按真实时间老化（上游按帧数，降帧会变慢）。
- 指针都在 window 上监听（上游监听 canvas），只对精确指针开启。
- GradientWaves 鼠标缓动按真实时间折算（上游每帧 0.05，按 60fps 写死）。

## 给外观框架（themes/index.js）的接口备注

- `ctx.color(token)` 按约定返回 `[r,g,b,a]`；`_gl.js` 的 `tokenColor()` 两种刻度都接受（r/g/b 任一 > 1 视为 0–255）。
- `ctx` 可省略：`mount(container, params)` 会用 `defaultThemeContext()`（读 CSS token、监听 `<html>` 的
  `data-theme/data-palette/data-scheme/style/class` 与系统明暗）。
- `handle.webgl === false` 表示已回退为纯色底，框架可据此换回 nebula 或提示。
- reduced-motion 状态在 `mount` 时读取；`update()` 时若 `ctx.reducedMotion()` 变了会内部重建。
