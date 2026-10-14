/* ============================================================
   @szyyw/design · themes/particles.js
   背景主题「粒子」（v0.19.0）：漂浮的 3D 粒子云，可选辉光 / 闪烁 / 景深 / 连线 / 指针互动 / 点击冲击波。
   出处：React Bits Particles（David Haz），MIT + Commons Clause。

   移植说明：React 组件 → 框架无关 ESM，原生 WebGL2（实例化绘制），不支持时降级 WebGL1
   （ANGLE_instanced_arrays + 着色器改写成 GLSL ES 1.00），两者都没有就不画。参数全部保留、名字不变；
   与上游的差异：
   - particleColors（颜色数组）→ colorA / colorB 两个 token 选择（缺省 --accent / --accent2），配色 / 明暗即时换色；
   - lightMode 改为 auto / on / off，auto 按解析后的 --bg 亮度自动判断（浅色模式下压暗粒子、减弱辉光）；
   - pixelRatio 0 = 跟随设备（上限 2）；
   - 指针互动只在 pointer: fine 下启用，在 window 上监听，不拦截页面点击；
   - 新增 fps 上限（缺省 30）；标签页隐藏 / 不可见时停；prefers-reduced-motion 下只画静态一帧。
   ============================================================ */

const L = (zh, ja, en) => ({ zh, ja, en });

const COLOR_TOKENS = [
  { value: "--accent", labels: L("主色", "アクセント", "Accent") },
  { value: "--accent2", labels: L("辅色", "アクセント 2", "Accent 2") },
  { value: "--df-from", labels: L("点阵色 A", "ドット色 A", "Dot color A") },
  { value: "--df-to", labels: L("点阵色 B", "ドット色 B", "Dot color B") },
  { value: "--text", labels: L("文字色", "文字色", "Text") },
  { value: "--text-dim", labels: L("次要文字色", "補助文字色", "Dim text") }
];

export const meta = {
  id: "particles",
  labels: L("粒子", "パーティクル", "Particles"),
  params: [
    { key: "colorA", type: "token", default: "--accent", options: COLOR_TOKENS, labels: L("颜色 A", "色 A", "Color A") },
    { key: "colorB", type: "token", default: "--accent2", options: COLOR_TOKENS, labels: L("颜色 B", "色 B", "Color B") },
    { key: "particleCount", type: "range", min: 10, max: 5000, step: 10, default: 200, labels: L("粒子数量", "粒子の数", "Particle count") },
    { key: "particleSpread", type: "range", min: 1, max: 30, step: 0.5, default: 10, labels: L("分布范围", "広がり", "Spread") },
    { key: "speed", type: "range", min: 0, max: 2, step: 0.05, default: 0.1, labels: L("速度", "速度", "Speed") },
    { key: "particleBaseSize", type: "range", min: 10, max: 400, step: 5, default: 100, labels: L("粒子大小", "粒子の大きさ", "Base size") },
    { key: "sizeRandomness", type: "range", min: 0, max: 3, step: 0.1, default: 1, labels: L("大小随机度", "大きさのばらつき", "Size randomness") },
    {
      key: "shape",
      type: "select",
      default: "circle",
      options: [
        { value: "circle", labels: L("圆点", "円", "Circle") },
        { value: "square", labels: L("方块", "四角", "Square") },
        { value: "ring", labels: L("圆环", "リング", "Ring") },
        { value: "sparkle", labels: L("星芒", "きらめき", "Sparkle") }
      ],
      labels: L("形状", "形", "Shape")
    },
    { key: "glow", type: "range", min: 0, max: 2, step: 0.05, default: 0.5, labels: L("辉光", "グロー", "Glow") },
    { key: "twinkle", type: "range", min: 0, max: 1, step: 0.05, default: 0.3, labels: L("闪烁", "またたき", "Twinkle") },
    { key: "opacity", type: "range", min: 0, max: 1, step: 0.05, default: 1, labels: L("不透明度", "不透明度", "Opacity") },
    { key: "alphaParticles", type: "toggle", default: false, labels: L("柔边半透明", "ソフトな半透明", "Soft alpha particles") },
    { key: "depthOfField", type: "range", min: 0, max: 3, step: 0.1, default: 0, labels: L("景深模糊", "被写界深度", "Depth of field") },
    { key: "cameraDistance", type: "range", min: 1, max: 60, step: 1, default: 20, labels: L("镜头距离", "カメラ距離", "Camera distance") },
    { key: "disableRotation", type: "toggle", default: false, labels: L("停止旋转", "回転を止める", "Disable rotation") },
    { key: "connections", type: "toggle", default: false, labels: L("连线", "線でつなぐ", "Connections") },
    {
      key: "connectionDistance",
      type: "range",
      min: 10,
      max: 300,
      step: 5,
      default: 110,
      labels: L("连线距离", "接続距離", "Connection distance"),
      visibleWhen: { key: "connections", equals: true }
    },
    {
      key: "drift",
      type: "select",
      default: "none",
      options: [
        { value: "none", labels: L("无", "なし", "None") },
        { value: "up", labels: L("上升", "上へ", "Up") },
        { value: "down", labels: L("下落", "下へ", "Down") },
        { value: "forward", labels: L("向前", "手前へ", "Forward") }
      ],
      labels: L("漂移", "ドリフト", "Drift")
    },
    {
      key: "driftSpeed",
      type: "range",
      min: 0,
      max: 5,
      step: 0.1,
      default: 1,
      labels: L("漂移速度", "ドリフト速度", "Drift speed"),
      visibleWhen: { key: "drift", notEquals: "none" }
    },
    { key: "moveParticlesOnHover", type: "toggle", default: true, labels: L("指针互动", "ポインターに反応", "Move on hover") },
    {
      key: "hoverEffect",
      type: "select",
      default: "parallax",
      options: [
        { value: "parallax", labels: L("视差", "視差", "Parallax") },
        { value: "repel", labels: L("排斥", "反発", "Repel") },
        { value: "attract", labels: L("吸引", "引き寄せ", "Attract") }
      ],
      labels: L("互动方式", "反応の種類", "Hover effect"),
      visibleWhen: { key: "moveParticlesOnHover", equals: true }
    },
    {
      key: "particleHoverFactor",
      type: "range",
      min: 0,
      max: 5,
      step: 0.1,
      default: 1,
      labels: L("互动强度", "反応の強さ", "Hover factor"),
      visibleWhen: { key: "moveParticlesOnHover", equals: true }
    },
    {
      key: "hoverRadius",
      type: "range",
      min: 20,
      max: 500,
      step: 10,
      default: 140,
      labels: L("互动半径", "反応半径", "Hover radius"),
      visibleWhen: { key: "moveParticlesOnHover", equals: true }
    },
    { key: "clickBurst", type: "toggle", default: true, labels: L("点击冲击波", "クリックで衝撃波", "Click burst") },
    { key: "variation", type: "range", min: 0, max: 20, step: 1, default: 0, labels: L("随机种子", "ランダムシード", "Variation") },
    { key: "intro", type: "toggle", default: true, labels: L("入场动画", "登場アニメーション", "Intro") },
    {
      key: "lightMode",
      type: "select",
      default: "auto",
      options: [
        { value: "auto", labels: L("自动", "自動", "Auto") },
        { value: "on", labels: L("开", "オン", "On") },
        { value: "off", labels: L("关", "オフ", "Off") }
      ],
      labels: L("浅底模式", "ライト背景モード", "Light mode"),
      hints: L("自动 = 按当前底色深浅", "自動＝背景の明るさで判断", "Auto = follow the background brightness")
    },
    {
      key: "pixelRatio",
      type: "range",
      min: 0,
      max: 2,
      step: 0.25,
      default: 0,
      labels: L("像素比（0 = 跟随设备）", "ピクセル比（0＝端末に合わせる）", "Pixel ratio (0 = device)")
    },
    { key: "paused", type: "toggle", default: false, labels: L("暂停", "一時停止", "Paused") },
    { key: "fps", type: "range", min: 15, max: 60, step: 5, default: 30, labels: L("帧率上限", "フレームレート上限", "Frame-rate cap") }
  ]
};

const SHAPES = { circle: 0, square: 1, ring: 2, sparkle: 3 };
const EFFECTS = { parallax: 0, repel: 1, attract: 2 };
const DRIFTS = { none: 0, up: 1, down: 2, forward: 3 };
const MAX_COUNT = 20000;
const MAX_LINKED = 900;
const MAX_LINES = 9000;
const MAX_BURSTS = 4;
const DEPTH = 10;
const FOCAL = 1 / Math.tan((7.5 * Math.PI) / 180);
const NEAR = 0.1;
const FAR = 100;
const INTRO_SECONDS = 1.8;
const BURST_SECONDS = 1.5;
const BURST_SPEED = 520;
const BURST_WIDTH = 46;

/* ---------- 着色器（GLSL ES 3.00；WebGL1 下由 toGLSL100 改写） ---------- */

const PARTICLE_VERTEX = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aCorner;
layout(location = 1) in vec3 aPosition;
layout(location = 2) in vec4 aRandom;
layout(location = 3) in vec3 aColor;
uniform mat3 uRotation;
uniform vec3 uOffset;
uniform float uSpread;
uniform float uTime;
uniform float uCamera;
uniform float uAspect;
uniform vec2 uView;
uniform float uRatio;
uniform float uSize;
uniform float uRandomness;
uniform float uBlur;
uniform float uFocus;
uniform float uGlow;
uniform float uTwinkle;
uniform int uShape;
uniform int uDrift;
uniform float uTravel;
uniform vec4 uPointer;
uniform int uEffect;
uniform float uStrength;
uniform vec4 uBursts[${MAX_BURSTS}];
uniform int uBurstCount;
uniform float uReveal;
out vec2 vLocal;
out float vRadius;
out float vBlur;
out float vAlpha;
out float vHalo;
out float vSeed;
out vec3 vColor;

vec3 bob(vec4 r, float t) {
  return vec3(
    sin(t * r.z + 6.28 * r.w) * mix(0.1, 1.5, r.x),
    sin(t * r.y + 6.28 * r.x) * mix(0.1, 1.5, r.w),
    sin(t * r.w + 6.28 * r.y) * mix(0.1, 1.5, r.z)
  );
}

void main() {
  vec3 pos = aPosition * uSpread;
  pos.z *= ${DEPTH.toFixed(1)};
  vec3 wobble = bob(aRandom, uTime);
  vec3 world = uRotation * pos + uOffset + wobble;
  float edge = 1.0;
  if (uDrift == 1 || uDrift == 2) {
    float span = uSpread * 2.0 + 3.0;
    float k = mod(aRandom.w * span + uOffset.y + wobble.y + (uDrift == 1 ? uTravel : -uTravel), span);
    world.y = k - span * 0.5;
    edge = smoothstep(0.0, span * 0.12, k) * (1.0 - smoothstep(span * 0.88, span, k));
  } else if (uDrift == 3) {
    float span = uSpread * ${DEPTH.toFixed(1)} * 2.0 + 3.0;
    float k = mod(aRandom.y * span + uOffset.z + wobble.z + uTravel, span);
    world.z = k - span * 0.5;
    edge = smoothstep(0.0, span * 0.1, k);
  }
  vec3 view = world - vec3(0.0, 0.0, uCamera);
  float dist = length(view);
  float ahead = -view.z;
  if (ahead < ${NEAR.toFixed(2)} || ahead > ${FAR.toFixed(1)}) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
  edge *= smoothstep(1.0, 4.0, ahead);
  vec2 ndc = vec2(view.x * ${FOCAL.toFixed(6)} / uAspect, view.y * ${FOCAL.toFixed(6)}) / ahead;
  vec2 screen = (ndc * 0.5 + 0.5) * uView;

  vec2 shift = vec2(0.0);
  float flash = 0.0;
  if (uEffect != 0 && uPointer.z > 0.001) {
    vec2 delta = screen - uPointer.xy;
    float reach = length(delta);
    float falloff = exp(-dot(delta, delta) / (uPointer.w * uPointer.w));
    vec2 away = reach > 0.001 ? delta / reach : vec2(0.0);
    shift += (uEffect == 1 ? away * uPointer.w * 0.5 : -delta * 0.6) * falloff * uStrength * uPointer.z;
  }
  for (int i = 0; i < ${MAX_BURSTS}; i++) {
    if (i >= uBurstCount) break;
    vec4 burst = uBursts[i];
    vec2 delta = screen - burst.xy;
    float reach = length(delta);
    float wave = exp(-pow((reach - burst.z * ${BURST_SPEED.toFixed(1)}) / ${BURST_WIDTH.toFixed(1)}, 2.0));
    vec2 away = reach > 0.001 ? delta / reach : vec2(0.0);
    float fade = (1.0 - burst.z) * (1.0 - burst.z) * burst.w;
    shift += away * wave * fade * 56.0 * smoothstep(0.0, 30.0, reach);
    flash += wave * fade;
  }
  screen += shift;

  float diameter = (uRandomness <= 0.0 ? uSize : uSize * (1.0 + uRandomness * (aRandom.x - 0.5)) / dist) * (1.0 + min(flash, 1.0) * 0.6);
  float device = diameter * uRatio;
  float radius = max(diameter, 1.0 / uRatio) * 0.5;
  float coverage = min(1.0, device * device);
  float blur = uBlur * max(uFocus - dist, 0.0) / max(dist, 1.0);
  float halo = uGlow > 0.0 ? radius * 2.5 + 2.0 : 0.0;
  float extent = radius * (uShape == 3 ? 1.6 : 1.0) + blur + halo + 1.5;

  float twinkle = 1.0 - uTwinkle * 0.6 * (0.5 + 0.5 * sin(uTime * (6.0 + aRandom.y * 14.0) + aRandom.w * 40.0));
  float far = 1.0 - smoothstep(${(FAR * 0.9).toFixed(1)}, ${FAR.toFixed(1)}, ahead);
  float focus = radius / (radius + blur);
  float reveal = clamp(uReveal * 1.6 - aRandom.z * 0.6, 0.0, 1.0);

  vLocal = aCorner * extent;
  vRadius = radius;
  vBlur = blur;
  vHalo = halo;
  vSeed = aRandom.y;
  vAlpha = min(1.0, coverage * twinkle * (1.0 + flash * 1.4)) * far * edge * max(focus, 0.35) * reveal * reveal;
  vColor = aColor;
  gl_Position = vec4((screen + aCorner * extent) / uView * 2.0 - 1.0, 0.0, 1.0);
}`;

const PARTICLE_FRAGMENT = `#version 300 es
precision highp float;
precision highp int;
uniform int uShape;
uniform float uGlow;
uniform float uRatio;
uniform float uTime;
uniform float uSoft;
uniform float uShimmer;
uniform float uOpacity;
in vec2 vLocal;
in float vRadius;
in float vBlur;
in float vAlpha;
in float vHalo;
in float vSeed;
in vec3 vColor;
out vec4 outColor;

float ray(vec2 q, float aa) {
  float width = 0.14 * max(0.0, 1.0 - q.x);
  return (1.0 - smoothstep(width - aa, width + aa, q.y)) * step(q.x, 1.0);
}

void main() {
  float soft = vBlur + 0.7 / uRatio + vRadius * uSoft;
  float d = length(vLocal);
  float shape;
  if (uShape == 1) {
    float box = max(abs(vLocal.x), abs(vLocal.y));
    shape = 1.0 - smoothstep(vRadius * 0.86 - soft, vRadius * 0.86 + soft, box);
  } else if (uShape == 2) {
    float edge = max(vRadius * 0.22, 0.6 / uRatio);
    shape = 1.0 - smoothstep(edge - soft, edge + soft, abs(d - vRadius * 0.8));
  } else if (uShape == 3) {
    float reach = vRadius * 1.6;
    vec2 q = abs(vLocal) / max(reach, 0.0001);
    float aa = soft / max(reach, 0.0001);
    shape = max(max(ray(q, aa), ray(q.yx, aa)), 1.0 - smoothstep(vRadius * 0.32 - soft, vRadius * 0.32 + soft, d));
  } else {
    shape = 1.0 - smoothstep(vRadius - soft, vRadius + soft, d);
  }
  float halo = vHalo > 0.0 ? exp(-d / (vHalo * 0.35)) * uGlow * 0.4 : 0.0;
  float alpha = clamp(shape + halo * (1.0 - shape), 0.0, 1.0) * vAlpha * uOpacity * (1.0 - uSoft);
  if (alpha < 0.002) discard;
  vec2 uv = vLocal / max(vRadius * 2.0, 0.0001) + 0.5;
  vec3 color = clamp(vColor + uShimmer * 0.2 * sin(uv.yxx + uTime + vSeed * 6.28), 0.0, 1.0);
  outColor = vec4(color * alpha, alpha);
}`;

const LINE_VERTEX = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aCorner;
layout(location = 1) in vec4 aEnds;
layout(location = 2) in vec4 aTint;
uniform vec2 uView;
uniform float uRatio;
uniform float uWidth;
out float vAcross;
out float vHalf;
out vec4 vTint;

void main() {
  vec2 a = aEnds.xy;
  vec2 b = aEnds.zw;
  vec2 along = b - a;
  float span = max(length(along), 0.0001);
  vec2 normal = vec2(-along.y, along.x) / span;
  float reach = uWidth * 0.5 + 1.0 / uRatio;
  vec2 point = mix(a, b, aCorner.x * 0.5 + 0.5) + normal * aCorner.y * reach;
  vAcross = aCorner.y * reach;
  vHalf = uWidth * 0.5;
  vTint = aTint;
  gl_Position = vec4(point / uView * 2.0 - 1.0, 0.0, 1.0);
}`;

const LINE_FRAGMENT = `#version 300 es
precision highp float;
uniform float uRatio;
uniform float uOpacity;
in float vAcross;
in float vHalf;
in vec4 vTint;
out vec4 outColor;

void main() {
  float edge = 0.6 / uRatio;
  float cover = 1.0 - smoothstep(vHalf - edge, vHalf + edge, abs(vAcross));
  float alpha = cover * vTint.a * uOpacity;
  outColor = vec4(vTint.rgb * alpha, alpha);
}`;

/** GLSL ES 3.00 → 1.00（WebGL1）：in/out → attribute/varying，outColor → gl_FragColor */
function toGLSL100(src, vertex) {
  let s = src.replace(/^#version 300 es\n/, "");
  if (vertex) {
    s = s.replace(/layout\(location = \d+\) in /g, "attribute ");
    s = s.replace(/^out /gm, "varying ");
  } else {
    s = s.replace(/^in /gm, "varying ");
    s = s.replace(/^out vec4 outColor;\n/m, "");
    s = s.replace(/\boutColor\b/g, "gl_FragColor");
  }
  return s;
}

const PARTICLE_ATTRIBS = ["aCorner", "aPosition", "aRandom", "aColor"];
const LINE_ATTRIBS = ["aCorner", "aEnds", "aTint"];

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
  gl.deleteShader(shader);
  return null;
}

function link(gl, webgl2, vs, fs, attribs) {
  const vertex = compile(gl, gl.VERTEX_SHADER, webgl2 ? vs : toGLSL100(vs, true));
  const fragment = compile(gl, gl.FRAGMENT_SHADER, webgl2 ? fs : toGLSL100(fs, false));
  const program = gl.createProgram();
  if (!vertex || !fragment || !program) return null;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  // WebGL1 没有 layout(location)：链接前按同样的序号绑定
  attribs.forEach((name, i) => gl.bindAttribLocation(program, i, name));
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }
  const uniforms = {};
  const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < count; i++) {
    const info = gl.getActiveUniform(program, i);
    if (info) uniforms[info.name.replace("[0]", "")] = gl.getUniformLocation(program, info.name);
  }
  return { program, uniforms };
}

function seeded(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const easeOut = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
const wrap = (v, span) => ((v % span) + span) % span;

/** 浅底上把颜色压到固定低亮度（上游 lightMode 的 ink） */
function ink(rgb) {
  const linear = rgb.map((v) => Math.pow(v, 2.2));
  const tone = 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  const depth = Math.min(1, 0.06 / Math.max(tone, 0.0001));
  return linear.map((v) => Math.pow(v * depth, 1 / 2.2));
}

function defaults() {
  const o = {};
  for (const p of meta.params) o[p.key] = p.default;
  return o;
}

/** 面板参数 → 渲染设置（上游 Settings 的同名换算） */
function toSettings(p, light) {
  return {
    count: clamp(Math.round(p.particleCount), 1, MAX_COUNT),
    spread: Math.max(0.1, p.particleSpread),
    speed: p.speed,
    mouse: p.moveParticlesOnHover,
    hoverFactor: Math.max(0, p.particleHoverFactor),
    soft: p.alphaParticles,
    size: Math.max(0, p.particleBaseSize),
    randomness: Math.max(0, p.sizeRandomness),
    camera: Math.max(1, p.cameraDistance),
    rotate: !p.disableRotation,
    dpr: p.pixelRatio > 0 ? p.pixelRatio : 0,
    shape: SHAPES[p.shape] ?? 0,
    glow: Math.max(0, p.glow),
    twinkle: clamp(p.twinkle, 0, 1),
    depthOfField: Math.max(0, p.depthOfField),
    connections: p.connections,
    connectionDistance: Math.max(10, p.connectionDistance),
    hoverEffect: EFFECTS[p.hoverEffect] ?? 0,
    hoverRadius: Math.max(20, p.hoverRadius),
    clickBurst: p.clickBurst,
    drift: DRIFTS[p.drift] ?? 0,
    driftSpeed: p.driftSpeed,
    variation: Math.max(0, Math.round(p.variation)),
    intro: p.intro,
    opacity: clamp(p.opacity, 0, 1),
    lightMode: p.lightMode === "on" || (p.lightMode === "auto" && light),
    paused: p.paused,
    fps: clamp(p.fps || 30, 1, 120)
  };
}

export function mount(container, params = {}, ctx = {}) {
  const p = { ...defaults(), ...params };
  const mm = (q) => window.matchMedia(q).matches;
  const reduce = () => (ctx.reducedMotion ? ctx.reducedMotion() : mm("(prefers-reduced-motion: reduce)"));
  const fine = ctx.finePointer ? ctx.finePointer() : mm("(pointer: fine)");
  const readColor = ctx.color ?? (() => [255, 255, 255, 1]);

  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none;";
  container.appendChild(canvas);

  const attrs = { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false };
  let gl = canvas.getContext("webgl2", attrs);
  const webgl2 = !!gl;
  let inst = null;
  if (!gl) {
    gl = canvas.getContext("webgl", attrs);
    inst = gl?.getExtension("ANGLE_instanced_arrays") ?? null;
  }
  const dots = gl && (webgl2 || inst) ? link(gl, webgl2, PARTICLE_VERTEX, PARTICLE_FRAGMENT, PARTICLE_ATTRIBS) : null;
  const lines = dots ? link(gl, webgl2, LINE_VERTEX, LINE_FRAGMENT, LINE_ATTRIBS) : null;
  if (!gl || !dots || !lines) {
    // 没有可用的 WebGL：不画，静默退化为纯底色
    canvas.remove();
    return { update() {}, destroy() {} };
  }

  const divisor = (loc, n) => (webgl2 ? gl.vertexAttribDivisor(loc, n) : inst.vertexAttribDivisorANGLE(loc, n));
  const drawInstanced = (count) =>
    webgl2 ? gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count) : inst.drawArraysInstancedANGLE(gl.TRIANGLE_STRIP, 0, 4, count);

  const corners = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, corners);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const positionBuffer = gl.createBuffer();
  const randomBuffer = gl.createBuffer();
  const colorBuffer = gl.createBuffer();
  const lineBuffer = gl.createBuffer();
  const lineData = new Float32Array(MAX_LINES * 8);
  gl.bindBuffer(gl.ARRAY_BUFFER, lineBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, lineData.byteLength, gl.DYNAMIC_DRAW);

  // 不用 VAO（WebGL1 没有）：每次绘制前把属性指针摆好
  function attrib(buffer, loc, size, div, stride = 0, offset = 0) {
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, offset);
    divisor(loc, div);
  }
  function bindDots() {
    attrib(corners, 0, 2, 0);
    attrib(positionBuffer, 1, 3, 1);
    attrib(randomBuffer, 2, 4, 1);
    attrib(colorBuffer, 3, 3, 1);
  }
  function bindLines() {
    attrib(corners, 0, 2, 0);
    attrib(lineBuffer, 1, 4, 1, 32, 0);
    attrib(lineBuffer, 2, 4, 1, 32, 16);
    divisor(3, 0);
    gl.disableVertexAttribArray(3);
  }

  let isLight = false;
  let swatches = [];
  const readColors = () => {
    const bg = readColor("--bg");
    const lum = (0.2126 * bg[0] + 0.7152 * bg[1] + 0.0722 * bg[2]) / 255;
    isLight = bg[3] > 0 && lum > 0.5;
    swatches = [p.colorA, p.colorB].map((t) => readColor(t).slice(0, 3).map((v) => v / 255));
  };
  readColors();
  let s = toSettings(p, isLight);

  const view = { width: 1, height: 1, ratio: 1 };
  const pointer = { x: 0, y: 0, sx: 0, sy: 0, nx: 0, ny: 0, inside: false, active: 0 };
  const state = { clock: 0, spin: 0, travel: 0, offsetX: 0, offsetY: 0, reveal: s.intro && !reduce() ? 0 : 1 };
  const bursts = [];
  const packedBursts = new Float32Array(MAX_BURSTS * 4);
  const cloud = { key: "", count: 0, positions: new Float32Array(0), randoms: new Float32Array(0), colors: new Float32Array(0) };
  const screen = { x: new Float32Array(0), y: new Float32Array(0), ahead: new Float32Array(0), alpha: new Float32Array(0) };
  let raf = 0;
  let last = 0;
  let lastDraw = 0;
  let visible = true;
  let destroyed = false;

  function rebuild() {
    const key = `${s.count}|${s.variation}|${swatches.map((c) => c.join(",")).join(";")}|${s.lightMode ? 1 : 0}`;
    if (key === cloud.key) return;
    cloud.key = key;
    const next = seeded(s.variation * 7919 + 1);
    const total = s.count;
    const positions = new Float32Array(total * 3);
    const randoms = new Float32Array(total * 4);
    const tints = new Float32Array(total * 3);
    const sw = swatches.map((c) => (s.lightMode ? ink(c) : c));
    for (let i = 0; i < total; i++) {
      let x;
      let y;
      let z;
      let len;
      do {
        x = next() * 2 - 1;
        y = next() * 2 - 1;
        z = next() * 2 - 1;
        len = x * x + y * y + z * z;
      } while (len > 1 || len === 0);
      const r = Math.cbrt(next());
      positions.set([x * r, y * r, z * r], i * 3);
      randoms.set([next(), next(), next(), next()], i * 4);
      tints.set(sw[Math.floor(next() * sw.length)], i * 3);
    }
    cloud.count = total;
    cloud.positions = positions;
    cloud.randoms = randoms;
    cloud.colors = tints;
    const linked = Math.min(total, MAX_LINKED);
    screen.x = new Float32Array(linked);
    screen.y = new Float32Array(linked);
    screen.ahead = new Float32Array(linked);
    screen.alpha = new Float32Array(linked);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, randomBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, randoms, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, tints, gl.STATIC_DRAW);
  }

  function rotation() {
    const elapsed = state.clock * 1000;
    const x = s.rotate ? Math.sin(elapsed * 0.0002) * 0.1 : 0;
    const y = s.rotate ? Math.cos(elapsed * 0.0005) * 0.15 : 0;
    const z = s.rotate ? state.spin : 0;
    const [sx, cx, sy, cy, sz, cz] = [Math.sin(x), Math.cos(x), Math.sin(y), Math.cos(y), Math.sin(z), Math.cos(z)];
    return [
      cy * cz + sy * sx * sz,
      cx * sz,
      -sy * cz + cy * sx * sz,
      -cy * sz + sy * sx * cz,
      cx * cz,
      sy * sz + cy * sx * cz,
      sy * cx,
      -sx,
      cy * cx
    ];
  }

  const offset = () => [state.offsetX, state.offsetY, -(1 - easeOut(state.reveal)) * 70];

  // CPU 侧投影（只为连线），与顶点着色器同一套数学
  function project(matrix) {
    const total = Math.min(cloud.count, MAX_LINKED);
    const [ox, oy, oz] = offset();
    const aspect = view.width / view.height;
    const time = state.clock;
    const radius = s.hoverRadius;
    const active = s.hoverEffect !== 0 ? pointer.active : 0;
    const spanY = s.spread * 2 + 3;
    const spanZ = s.spread * DEPTH * 2 + 3;
    for (let i = 0; i < total; i++) {
      const px = cloud.positions[i * 3] * s.spread;
      const py = cloud.positions[i * 3 + 1] * s.spread;
      const pz = cloud.positions[i * 3 + 2] * s.spread * DEPTH;
      const r0 = cloud.randoms[i * 4];
      const r1 = cloud.randoms[i * 4 + 1];
      const r2 = cloud.randoms[i * 4 + 2];
      const r3 = cloud.randoms[i * 4 + 3];
      const bobX = Math.sin(time * r2 + 6.28 * r3) * (0.1 + 1.4 * r0);
      const bobY = Math.sin(time * r1 + 6.28 * r0) * (0.1 + 1.4 * r3);
      const bobZ = Math.sin(time * r3 + 6.28 * r1) * (0.1 + 1.4 * r2);
      const wx = matrix[0] * px + matrix[3] * py + matrix[6] * pz + ox + bobX;
      let wy = matrix[1] * px + matrix[4] * py + matrix[7] * pz + oy + bobY;
      let wz = matrix[2] * px + matrix[5] * py + matrix[8] * pz + oz + bobZ;
      let edge = 1;
      if (s.drift === 1 || s.drift === 2) {
        const k = wrap(r3 * spanY + oy + bobY + (s.drift === 1 ? state.travel : -state.travel), spanY);
        wy = k - spanY / 2;
        const low = clamp(k / (spanY * 0.12), 0, 1);
        const high = clamp((spanY - k) / (spanY * 0.12), 0, 1);
        edge = low * low * (3 - 2 * low) * high * high * (3 - 2 * high);
      } else if (s.drift === 3) {
        const k = wrap(r1 * spanZ + oz + bobZ + state.travel, spanZ);
        wz = k - spanZ / 2;
        const fresh = clamp(k / (spanZ * 0.1), 0, 1);
        edge = fresh * fresh * (3 - 2 * fresh);
      }
      const ahead = s.camera - wz;
      if (ahead < NEAR || ahead > FAR) {
        screen.alpha[i] = 0;
        continue;
      }
      const close = clamp((ahead - 1) / 3, 0, 1);
      edge *= close * close * (3 - 2 * close);
      let sx = ((wx * FOCAL) / aspect / ahead) * 0.5 * view.width + view.width / 2;
      let sy = ((wy * FOCAL) / ahead) * 0.5 * view.height + view.height / 2;
      let dx = 0;
      let dy = 0;
      if (active > 0.001) {
        const ex = sx - pointer.sx;
        const ey = sy - pointer.sy;
        const reach = Math.hypot(ex, ey);
        const falloff = Math.exp(-(ex * ex + ey * ey) / (radius * radius)) * s.hoverFactor * active;
        if (s.hoverEffect === 1 && reach > 0.001) {
          dx += (ex / reach) * radius * 0.5 * falloff;
          dy += (ey / reach) * radius * 0.5 * falloff;
        } else if (s.hoverEffect === 2) {
          dx -= ex * 0.6 * falloff;
          dy -= ey * 0.6 * falloff;
        }
      }
      for (const burst of bursts) {
        const progress = burst.age / BURST_SECONDS;
        const ex = sx - burst.x;
        const ey = sy - burst.y;
        const reach = Math.hypot(ex, ey);
        if (reach < 0.001) continue;
        const wave = Math.exp(-Math.pow((reach - progress * BURST_SPEED) / BURST_WIDTH, 2));
        const ramp = clamp(reach / 30, 0, 1);
        const push = wave * (1 - progress) * (1 - progress) * 56 * ramp * ramp * (3 - 2 * ramp);
        dx += (ex / reach) * push;
        dy += (ey / reach) * push;
      }
      sx += dx;
      sy += dy;
      const far = clamp((FAR - ahead) / (FAR - FAR * 0.9), 0, 1);
      const reveal = clamp(state.reveal * 1.6 - r2 * 0.6, 0, 1);
      screen.x[i] = sx;
      screen.y[i] = sy;
      screen.ahead[i] = ahead;
      screen.alpha[i] = far * far * (3 - 2 * far) * edge * reveal * reveal;
    }
    return total;
  }

  function buildLines(matrix) {
    const total = project(matrix);
    const reach = s.connectionDistance;
    const columns = Math.max(1, Math.ceil(view.width / reach) + 2);
    const buckets = new Map();
    for (let i = 0; i < total; i++) {
      if (screen.alpha[i] < 0.02) continue;
      const key = (Math.floor(screen.y[i] / reach) + 1) * columns + Math.floor(screen.x[i] / reach) + 1;
      const bucket = buckets.get(key);
      if (bucket) bucket.push(i);
      else buckets.set(key, [i]);
    }
    let lineCount = 0;
    const limit = reach * reach;
    for (const [key, members] of buckets) {
      for (const off of [0, 1, columns - 1, columns, columns + 1]) {
        const others = off === 0 ? members : buckets.get(key + off);
        if (!others) continue;
        for (let a = 0; a < members.length; a++) {
          const i = members[a];
          for (let b = off === 0 ? a + 1 : 0; b < others.length; b++) {
            const j = others[b];
            const dx = screen.x[i] - screen.x[j];
            const dy = screen.y[i] - screen.y[j];
            const gap = dx * dx + dy * dy;
            if (gap > limit) continue;
            const layer = clamp(1 - Math.abs(screen.ahead[i] - screen.ahead[j]) / 18, 0, 1);
            if (layer <= 0) continue;
            if (lineCount >= MAX_LINES) return lineCount;
            const fade = 1 - Math.sqrt(gap) / reach;
            const base = lineCount * 8;
            lineData[base] = screen.x[i];
            lineData[base + 1] = screen.y[i];
            lineData[base + 2] = screen.x[j];
            lineData[base + 3] = screen.y[j];
            lineData[base + 4] = (cloud.colors[i * 3] + cloud.colors[j * 3]) / 2;
            lineData[base + 5] = (cloud.colors[i * 3 + 1] + cloud.colors[j * 3 + 1]) / 2;
            lineData[base + 6] = (cloud.colors[i * 3 + 2] + cloud.colors[j * 3 + 2]) / 2;
            lineData[base + 7] = fade * fade * layer * 0.7 * Math.min(screen.alpha[i], screen.alpha[j]);
            lineCount++;
          }
        }
      }
    }
    return lineCount;
  }

  function render() {
    if (gl.isContextLost()) return;
    rebuild();
    const matrix = rotation();
    const [ox, oy, oz] = offset();
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    if (s.connections) {
      const lineCount = buildLines(matrix);
      if (lineCount) {
        gl.useProgram(lines.program);
        bindLines();
        gl.bindBuffer(gl.ARRAY_BUFFER, lineBuffer);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, lineData.subarray(0, lineCount * 8));
        gl.uniform2f(lines.uniforms.uView, view.width, view.height);
        gl.uniform1f(lines.uniforms.uRatio, view.ratio);
        gl.uniform1f(lines.uniforms.uWidth, 1);
        gl.uniform1f(lines.uniforms.uOpacity, s.opacity);
        drawInstanced(lineCount);
      }
    }

    const u = dots.uniforms;
    let burstCount = 0;
    packedBursts.fill(0);
    for (let i = bursts.length - 1; i >= 0 && burstCount < MAX_BURSTS; i--) {
      packedBursts.set([bursts[i].x, bursts[i].y, bursts[i].age / BURST_SECONDS, 1], burstCount * 4);
      burstCount++;
    }
    gl.useProgram(dots.program);
    bindDots();
    gl.uniformMatrix3fv(u.uRotation, false, matrix);
    gl.uniform3f(u.uOffset, ox, oy, oz);
    gl.uniform1f(u.uSpread, s.spread);
    gl.uniform1f(u.uTime, state.clock);
    gl.uniform1f(u.uCamera, s.camera);
    gl.uniform1f(u.uAspect, view.width / view.height);
    gl.uniform2f(u.uView, view.width, view.height);
    gl.uniform1f(u.uRatio, view.ratio);
    gl.uniform1f(u.uSize, s.size);
    gl.uniform1f(u.uRandomness, s.randomness);
    gl.uniform1f(u.uBlur, s.depthOfField * 14);
    gl.uniform1f(u.uFocus, s.camera + 14);
    gl.uniform1f(u.uGlow, s.lightMode ? s.glow * 0.3 : s.glow);
    gl.uniform1f(u.uTwinkle, s.twinkle);
    gl.uniform1i(u.uShape, s.shape);
    gl.uniform1i(u.uDrift, s.drift);
    gl.uniform1f(u.uTravel, state.travel);
    gl.uniform4f(u.uPointer, pointer.sx, pointer.sy, pointer.active, s.hoverRadius);
    gl.uniform1i(u.uEffect, s.hoverEffect);
    gl.uniform1f(u.uStrength, s.hoverFactor);
    gl.uniform4fv(u.uBursts, packedBursts);
    gl.uniform1i(u.uBurstCount, burstCount);
    gl.uniform1f(u.uReveal, state.reveal);
    gl.uniform1f(u.uSoft, s.soft ? 0.2 : 0);
    gl.uniform1f(u.uShimmer, s.lightMode ? 0 : 1);
    gl.uniform1f(u.uOpacity, s.opacity);
    drawInstanced(cloud.count);
  }

  /** 静态：暂停 / 减少动效 / 隐藏时不跑循环，只按需重画一帧 */
  const animating = () => !s.paused && !reduce();

  function frame(now) {
    raf = 0;
    if (destroyed || !visible || document.hidden) return;
    if (!animating()) {
      state.reveal = 1;
      render();
      last = 0;
      return;
    }
    // fps 上限
    if (lastDraw && now - lastDraw < 1000 / s.fps - 1) {
      raf = requestAnimationFrame(frame);
      return;
    }
    lastDraw = now;
    const dt = last ? clamp((now - last) / 1000, 0.0005, 0.05) : 1 / 60;
    last = now;
    const pace = dt * s.speed;
    state.clock += pace;
    if (s.rotate) state.spin += pace * 0.6;
    state.travel += dt * s.driftSpeed * (s.drift === 3 ? 6 : 0.9);

    const engaged = s.mouse && pointer.inside;
    const follow = 1 - Math.exp(-dt / 0.35);
    const parallax = engaged && s.hoverEffect === 0 ? s.hoverFactor : 0;
    state.offsetX += (-pointer.nx * parallax - state.offsetX) * follow;
    state.offsetY += (-pointer.ny * parallax - state.offsetY) * follow;
    pointer.sx += (pointer.x - pointer.sx) * (1 - Math.exp(-dt / 0.06));
    pointer.sy += (pointer.y - pointer.sy) * (1 - Math.exp(-dt / 0.06));
    pointer.active += ((engaged ? 1 : 0) - pointer.active) * (1 - Math.exp(-dt / 0.2));

    for (let i = bursts.length - 1; i >= 0; i--) {
      bursts[i].age += dt;
      if (bursts[i].age >= BURST_SECONDS) bursts.splice(i, 1);
    }

    if (!s.intro) state.reveal = 1;
    else if (state.reveal < 1) state.reveal = Math.min(1, state.reveal + dt / INTRO_SECONDS);

    render();
    raf = requestAnimationFrame(frame);
  }

  function wake() {
    if (!raf && !destroyed && visible && !document.hidden) raf = requestAnimationFrame(frame);
  }

  function resize() {
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    const ratio = Math.min(s.dpr || window.devicePixelRatio || 1, 2);
    view.width = width;
    view.height = height;
    canvas.width = Math.max(1, Math.round(width * ratio));
    canvas.height = Math.max(1, Math.round(height * ratio));
    view.ratio = canvas.width / width;
    render();
    wake();
  }

  function locate(e) {
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const wasInside = pointer.inside;
    pointer.inside = x >= 0 && y >= 0 && x <= rect.width && y <= rect.height;
    pointer.x = x;
    pointer.y = rect.height - y;
    pointer.nx = (x / Math.max(1, rect.width)) * 2 - 1;
    pointer.ny = -((y / Math.max(1, rect.height)) * 2 - 1);
    if (pointer.inside && !wasInside) {
      pointer.sx = pointer.x;
      pointer.sy = pointer.y;
    }
  }
  const onMove = (e) => {
    locate(e);
    if (animating()) wake();
  };
  const onDown = (e) => {
    locate(e);
    if (!pointer.inside || !s.clickBurst || !animating()) return;
    bursts.push({ x: pointer.x, y: pointer.y, age: 0 });
    if (bursts.length > MAX_BURSTS) bursts.shift();
    wake();
  };
  const onLeave = () => {
    pointer.inside = false;
  };
  const onVisibility = () => {
    last = 0;
    wake();
  };

  const ro = new ResizeObserver(resize);
  ro.observe(container);
  const io = new IntersectionObserver((entries) => {
    visible = entries.some((en) => en.isIntersecting);
    if (visible) {
      last = 0;
      wake();
    }
  });
  io.observe(container);
  const interactive = fine;
  if (interactive) {
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
  }
  document.addEventListener("visibilitychange", onVisibility);
  const offColors = ctx.onColorsChange
    ? ctx.onColorsChange(() => {
        readColors();
        s = toSettings(p, isLight);
        if (!raf) render();
      })
    : () => {};
  const onLost = (e) => e.preventDefault();
  canvas.addEventListener("webglcontextlost", onLost);
  resize();

  return {
    update(next) {
      const prevDpr = s.dpr;
      Object.assign(p, next);
      readColors();
      s = toSettings(p, isLight);
      if (s.dpr !== prevDpr) {
        resize();
        return;
      }
      if (!raf) render();
      wake();
    },
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      offColors();
      if (interactive) {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerdown", onDown);
        document.documentElement.removeEventListener("pointerleave", onLeave);
      }
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("webglcontextlost", onLost);
      gl.deleteProgram(dots.program);
      gl.deleteProgram(lines.program);
      [corners, positionBuffer, randomBuffer, colorBuffer, lineBuffer].forEach((b) => gl.deleteBuffer(b));
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      canvas.remove();
    }
  };
}
