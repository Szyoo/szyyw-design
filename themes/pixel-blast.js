/* ============================================================
   @szyyw/design · themes/pixel-blast.js
   背景主题「像素爆破」：分形噪声 + Bayer 抖动出的像素图案（方 / 圆 / 三角 / 菱形），
   点击泛起涟漪，可选「液态」拖尾扭曲与胶片噪点。
   原生 WebGL（WebGL2 优先，降级 WebGL1），零依赖。

   出处：React Bits PixelBlast（David Haz），MIT + Commons Clause。
   移植改动：three + postprocessing → 原生 WebGL。主图案一遍直接画到画布；
   开了液态（liquid）或噪点（noiseAmount > 0）时先画进帧缓冲，再用第二遍全屏着色器
   做 UV 扭曲 / 叠噪点（对应上游 EffectComposer 的 RenderPass + EffectPass）。
   颜色改为 CSS token（--th-pixel-blast-color），token 的 alpha 作强度系数；
   不透明模式（transparent 关）的底色取 --bg（上游是黑）；指针在 window 上监听、只对精确指针开启；
   时间按速度积分（上游改速度时相位会跳）；拖尾按真实时间老化（上游按帧数，降帧会变慢）。
   ============================================================ */

import {
  FULLSCREEN_VERT,
  createProgram,
  createFullscreenTriangle,
  createRenderTarget,
  mountGLTheme,
  tokenOptions,
  tokenColor,
  PERF_PARAMS
} from "./_gl.js";

const COLOR_TOKENS = [["--th-pixel-blast-color", "主题 · 像素", "テーマ · ピクセル", "Theme · pixels"]];

const SHAPES = { square: 0, circle: 1, triangle: 2, diamond: 3 };
const MAX_CLICKS = 10;

export const meta = {
  id: "pixel-blast",
  labels: { zh: "像素爆破", ja: "ピクセルブラスト", en: "Pixel Blast" },
  params: [
    { key: "variant", type: "select", default: "square",
      options: [
        { value: "square", labels: { zh: "方形", ja: "四角", en: "Square" } },
        { value: "circle", labels: { zh: "圆形", ja: "円", en: "Circle" } },
        { value: "triangle", labels: { zh: "三角", ja: "三角", en: "Triangle" } },
        { value: "diamond", labels: { zh: "菱形", ja: "ひし形", en: "Diamond" } }
      ],
      labels: { zh: "像素形状", ja: "ピクセル形状", en: "Variant" } },
    { key: "pixelSize", type: "range", min: 1, max: 12, step: 1, default: 3,
      labels: { zh: "像素大小", ja: "ピクセルサイズ", en: "Pixel size" } },
    { key: "color", type: "token", default: "--th-pixel-blast-color", options: tokenOptions(COLOR_TOKENS),
      labels: { zh: "颜色", ja: "色", en: "Color" } },
    { key: "antialias", type: "toggle", default: true,
      labels: { zh: "抗锯齿", ja: "アンチエイリアス", en: "Antialias" } },
    { key: "patternScale", type: "range", min: 0.5, max: 8, step: 0.1, default: 2,
      labels: { zh: "图案尺度", ja: "パターンの大きさ", en: "Pattern scale" } },
    { key: "patternDensity", type: "range", min: 0, max: 2, step: 0.05, default: 1,
      labels: { zh: "图案密度", ja: "パターン密度", en: "Pattern density" } },
    { key: "pixelSizeJitter", type: "range", min: 0, max: 1, step: 0.05, default: 0,
      labels: { zh: "像素大小抖动", ja: "サイズのゆらぎ", en: "Pixel size jitter" } },
    { key: "enableRipples", type: "toggle", default: true,
      labels: { zh: "点击涟漪", ja: "クリック波紋", en: "Ripples" } },
    { key: "rippleIntensityScale", type: "range", min: 0, max: 3, step: 0.1, default: 1,
      labels: { zh: "涟漪强度", ja: "波紋の強さ", en: "Ripple intensity" } },
    { key: "rippleThickness", type: "range", min: 0.01, max: 0.5, step: 0.01, default: 0.1,
      labels: { zh: "涟漪宽度", ja: "波紋の太さ", en: "Ripple thickness" } },
    { key: "rippleSpeed", type: "range", min: 0.05, max: 1.5, step: 0.05, default: 0.3,
      labels: { zh: "涟漪速度", ja: "波紋の速さ", en: "Ripple speed" } },
    { key: "liquid", type: "toggle", default: false,
      labels: { zh: "液态拖尾", ja: "リキッド", en: "Liquid" } },
    { key: "liquidStrength", type: "range", min: 0, max: 0.5, step: 0.01, default: 0.1,
      labels: { zh: "液态强度", ja: "リキッドの強さ", en: "Liquid strength" } },
    { key: "liquidRadius", type: "range", min: 0.2, max: 3, step: 0.1, default: 1,
      labels: { zh: "液态半径", ja: "リキッド半径", en: "Liquid radius" } },
    { key: "liquidWobbleSpeed", type: "range", min: 0, max: 10, step: 0.1, default: 4.5,
      labels: { zh: "液态晃动速度", ja: "リキッドの揺れ", en: "Liquid wobble speed" } },
    { key: "speed", type: "range", min: 0, max: 3, step: 0.05, default: 0.5,
      labels: { zh: "速度", ja: "速度", en: "Speed" } },
    { key: "edgeFade", type: "range", min: 0, max: 1, step: 0.05, default: 0.5,
      labels: { zh: "边缘淡出", ja: "端のフェード", en: "Edge fade" } },
    { key: "noiseAmount", type: "range", min: 0, max: 0.5, step: 0.01, default: 0,
      labels: { zh: "噪点", ja: "ノイズ", en: "Noise" } },
    { key: "transparent", type: "toggle", default: true,
      labels: { zh: "透明底", ja: "透明背景", en: "Transparent" } },
    { key: "autoPauseOffscreen", type: "toggle", default: true,
      labels: { zh: "离开视口时暂停", ja: "画面外で一時停止", en: "Pause offscreen" } },
    ...PERF_PARAMS
  ]
};

const SCENE_FRAG = `
#define MAX_CLICKS ${MAX_CLICKS}
uniform vec4  uColor;
uniform vec4  uBackground;
uniform vec2  uResolution;
uniform float uTime;
uniform float uPixelSize;
uniform float uScale;
uniform float uDensity;
uniform float uPixelJitter;
uniform int   uEnableRipples;
uniform float uRippleSpeed;
uniform float uRippleThickness;
uniform float uRippleIntensity;
uniform float uEdgeFade;
uniform int   uShapeType;
uniform vec2  uClickPos[MAX_CLICKS];
uniform float uClickTimes[MAX_CLICKS];

float Bayer2(vec2 a) {
  a = floor(a);
  return fract(a.x / 2. + a.y * a.y * .75);
}
#define Bayer4(a) (Bayer2(.5*(a))*0.25 + Bayer2(a))
#define Bayer8(a) (Bayer4(.5*(a))*0.25 + Bayer2(a))

#define FBM_OCTAVES     5
#define FBM_LACUNARITY  1.25
#define FBM_GAIN        1.0

float hash11(float n){ return fract(sin(n)*43758.5453); }

float vnoise(vec3 p){
  vec3 ip = floor(p);
  vec3 fp = fract(p);
  float n000 = hash11(dot(ip + vec3(0.0,0.0,0.0), vec3(1.0,57.0,113.0)));
  float n100 = hash11(dot(ip + vec3(1.0,0.0,0.0), vec3(1.0,57.0,113.0)));
  float n010 = hash11(dot(ip + vec3(0.0,1.0,0.0), vec3(1.0,57.0,113.0)));
  float n110 = hash11(dot(ip + vec3(1.0,1.0,0.0), vec3(1.0,57.0,113.0)));
  float n001 = hash11(dot(ip + vec3(0.0,0.0,1.0), vec3(1.0,57.0,113.0)));
  float n101 = hash11(dot(ip + vec3(1.0,0.0,1.0), vec3(1.0,57.0,113.0)));
  float n011 = hash11(dot(ip + vec3(0.0,1.0,1.0), vec3(1.0,57.0,113.0)));
  float n111 = hash11(dot(ip + vec3(1.0,1.0,1.0), vec3(1.0,57.0,113.0)));
  vec3 w = fp*fp*fp*(fp*(fp*6.0-15.0)+10.0);
  float x00 = mix(n000, n100, w.x);
  float x10 = mix(n010, n110, w.x);
  float x01 = mix(n001, n101, w.x);
  float x11 = mix(n011, n111, w.x);
  float y0  = mix(x00, x10, w.y);
  float y1  = mix(x01, x11, w.y);
  return mix(y0, y1, w.z) * 2.0 - 1.0;
}

float fbm2(vec2 uv, float t){
  vec3 p = vec3(uv * uScale, t);
  float amp = 1.0;
  float freq = 1.0;
  float sum = 1.0;
  for (int i = 0; i < FBM_OCTAVES; ++i){
    sum  += amp * vnoise(p * freq);
    freq *= FBM_LACUNARITY;
    amp  *= FBM_GAIN;
  }
  return sum * 0.5 + 0.5;
}

float maskCircle(vec2 p, float cov){
  float r = sqrt(cov) * .25;
  float d = length(p - 0.5) - r;
  float aa = 0.5 * fwidth(d);
  return cov * (1.0 - smoothstep(-aa, aa, d * 2.0));
}

float maskTriangle(vec2 p, vec2 id, float cov){
  bool flip = mod(id.x + id.y, 2.0) > 0.5;
  if (flip) p.x = 1.0 - p.x;
  float r = sqrt(cov);
  float d  = p.y - r*(1.0 - p.x);
  float aa = fwidth(d);
  return cov * clamp(0.5 - d/aa, 0.0, 1.0);
}

float maskDiamond(vec2 p, float cov){
  float r = sqrt(cov) * 0.564;
  return step(abs(p.x - 0.49) + abs(p.y - 0.49), r);
}

void main(){
  float pixelSize = uPixelSize;
  vec2 fragCoord = gl_FragCoord.xy - uResolution * .5;
  float aspectRatio = uResolution.x / uResolution.y;

  vec2 pixelId = floor(fragCoord / pixelSize);
  vec2 pixelUV = fract(fragCoord / pixelSize);

  float cellPixelSize = 8.0 * pixelSize;
  vec2 cellId = floor(fragCoord / cellPixelSize);
  vec2 cellCoord = cellId * cellPixelSize;
  vec2 uv = cellCoord / uResolution * vec2(aspectRatio, 1.0);

  float base = fbm2(uv, uTime * 0.05);
  base = base * 0.5 - 0.65;

  float feed = base + (uDensity - 0.5) * 0.3;

  float speed     = uRippleSpeed;
  float thickness = uRippleThickness;
  const float dampT     = 1.0;
  const float dampR     = 10.0;

  if (uEnableRipples == 1) {
    for (int i = 0; i < MAX_CLICKS; ++i){
      vec2 pos = uClickPos[i];
      if (pos.x < 0.0) continue;
      vec2 cuv = (((pos - uResolution * .5 - cellPixelSize * .5) / (uResolution))) * vec2(aspectRatio, 1.0);
      float t = max(uTime - uClickTimes[i], 0.0);
      float r = distance(uv, cuv);
      float waveR = speed * t;
      float ring  = exp(-pow((r - waveR) / thickness, 2.0));
      float atten = exp(-dampT * t) * exp(-dampR * r);
      feed = max(feed, ring * atten * uRippleIntensity);
    }
  }

  float bayer = Bayer8(fragCoord / uPixelSize) - 0.5;
  float bw = step(0.5, feed + bayer);

  float h = fract(sin(dot(floor(fragCoord / uPixelSize), vec2(127.1, 311.7))) * 43758.5453);
  float jitterScale = 1.0 + (h - 0.5) * uPixelJitter;
  float coverage = bw * jitterScale;
  float M;
  if      (uShapeType == 1) M = maskCircle (pixelUV, coverage);
  else if (uShapeType == 2) M = maskTriangle(pixelUV, pixelId, coverage);
  else if (uShapeType == 3) M = maskDiamond(pixelUV, coverage);
  else                      M = coverage;

  if (uEdgeFade > 0.0) {
    vec2 norm = gl_FragCoord.xy / uResolution;
    float edge = min(min(norm.x, norm.y), min(1.0 - norm.x, 1.0 - norm.y));
    float fade = smoothstep(0.0, uEdgeFade, edge);
    M *= fade;
  }

  // 上游：sRGB 色 → 线性（THREE.Color）→ 着色器里再转回 sRGB，净效果就是原色；这里直接用 token 色。
  // token alpha 作强度系数；输出预乘 alpha，叠在 uBackground（透明模式为 0）上
  float a = clamp(M * uColor.a, 0.0, 1.0);
  gl_FragColor = vec4(uColor.rgb * a, a) + uBackground * (1.0 - a);
}
`;

// 第二遍：对应上游 LiquidEffect（mainUv 扭曲）+ NoiseEffect（叠灰度噪点）
const POST_FRAG = `
varying vec2 vUv;
uniform sampler2D uInput;
uniform sampler2D uTouch;
uniform float uLiquid;
uniform float uStrength;
uniform float uTime;
uniform float uFreq;
uniform float uNoise;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }

void main(){
  vec2 uv = vUv;
  if (uLiquid > 0.5) {
    vec4 tex = texture2D(uTouch, uv);
    float vx = tex.r * 2.0 - 1.0;
    float vy = tex.g * 2.0 - 1.0;
    float intensity = tex.b;
    float wave = 0.5 + 0.5 * sin(uTime * uFreq + intensity * 6.2831853);
    float amt = uStrength * intensity * wave;
    uv += vec2(vx, vy) * amt;
  }
  vec4 color = texture2D(uInput, uv);
  if (uNoise > 0.0) {
    float n = hash(floor(vUv * vec2(1920.0, 1080.0)) + floor(uTime * 60.0));
    color.rgb += vec3((n - 0.5) * uNoise);
  }
  gl_FragColor = color;
}
`;

/** 液态拖尾：64×64 的 2D 画布，速度方向写进 r/g、强度写进 b（同上游 createTouchTexture） */
function createTouchTrail() {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const c2d = canvas.getContext("2d");
  const trail = [];
  let last = null;
  const maxAge = 64;
  let radius = 0.1 * size;
  const speed = 1 / maxAge;
  let dirty = true;

  const clear = () => {
    c2d.fillStyle = "black";
    c2d.fillRect(0, 0, size, size);
  };
  clear();

  const easeOutSine = (t) => Math.sin((t * Math.PI) / 2);
  const easeOutQuad = (t) => -t * (t - 2);

  function drawPoint(pt) {
    const x = pt.x * size;
    const y = (1 - pt.y) * size;
    let intensity;
    if (pt.age < maxAge * 0.3) intensity = easeOutSine(pt.age / (maxAge * 0.3));
    else intensity = easeOutQuad(1 - (pt.age - maxAge * 0.3) / (maxAge * 0.7)) || 0;
    intensity *= pt.force;
    const color = `${((pt.vx + 1) / 2) * 255}, ${((pt.vy + 1) / 2) * 255}, ${intensity * 255}`;
    // 实体画到画布外，只让阴影落在目标位置：阴影带模糊，正好是柔边笔刷
    const offset = size * 5;
    c2d.shadowOffsetX = offset;
    c2d.shadowOffsetY = offset;
    c2d.shadowBlur = radius;
    c2d.shadowColor = `rgba(${color},${0.22 * intensity})`;
    c2d.beginPath();
    c2d.fillStyle = "rgba(255,0,0,1)";
    c2d.arc(x - offset, y - offset, radius, 0, Math.PI * 2);
    c2d.fill();
  }

  return {
    canvas,
    get active() {
      return trail.length > 0 || dirty;
    },
    set radiusScale(v) {
      radius = 0.1 * size * v;
    },
    addTouch(nx, ny) {
      let force = 0;
      let vx = 0;
      let vy = 0;
      if (last) {
        const dx = nx - last.x;
        const dy = ny - last.y;
        if (dx === 0 && dy === 0) return;
        const dd = dx * dx + dy * dy;
        const d = Math.sqrt(dd);
        vx = dx / (d || 1);
        vy = dy / (d || 1);
        force = Math.min(dd * 10000, 1);
      }
      last = { x: nx, y: ny };
      trail.push({ x: nx, y: ny, age: 0, force, vx, vy });
    },
    /** frames：按 60fps 折算的帧数（上游每帧老化 1） */
    update(frames) {
      dirty = trail.length > 0;
      clear();
      for (let i = trail.length - 1; i >= 0; i--) {
        const pt = trail[i];
        const f = pt.force * speed * (1 - pt.age / maxAge) * frames;
        pt.x += pt.vx * f;
        pt.y += pt.vy * f;
        pt.age += frames;
        if (pt.age > maxAge) trail.splice(i, 1);
      }
      for (let i = 0; i < trail.length; i++) drawPoint(trail[i]);
    }
  };
}

function randomFloat() {
  if (window.crypto?.getRandomValues) {
    const u32 = new Uint32Array(1);
    window.crypto.getRandomValues(u32);
    return u32[0] / 0xffffffff;
  }
  return Math.random();
}

export function mount(container, params, ctx) {
  return mountGLTheme(
    meta,
    container,
    params,
    ctx,
    (env) => {
      const { p, colors } = env;
      let scene = null;
      let post = null;
      let tri = null;
      let rt = null;
      let touchTex = null;
      let bg = [0, 0, 0, 1];
      const touch = createTouchTrail();
      touch.radiusScale = p.liquidRadius;
      const clickPos = new Float32Array(MAX_CLICKS * 2).fill(-1);
      const clickTimes = new Float32Array(MAX_CLICKS);
      let clickIx = 0;
      let sceneTime = randomFloat() * 1000;

      const readBg = () => {
        bg = tokenColor(env.ctx, "--bg");
      };
      readBg();

      function toPixels(e) {
        const s = env.surface;
        const r = s.canvas.getBoundingClientRect();
        const fx = ((e.clientX - r.left) * s.width) / Math.max(1, r.width);
        const fy = ((r.height - (e.clientY - r.top)) * s.height) / Math.max(1, r.height);
        return { fx, fy, w: s.width, h: s.height };
      }
      function onDown(e) {
        if (!p.enableRipples || !env.surface) return;
        const { fx, fy } = toPixels(e);
        clickPos[clickIx * 2] = fx;
        clickPos[clickIx * 2 + 1] = fy;
        clickTimes[clickIx] = sceneTime;
        clickIx = (clickIx + 1) % MAX_CLICKS;
      }
      function onMove(e) {
        if (!p.liquid || !env.surface) return;
        const { fx, fy, w, h } = toPixels(e);
        touch.addTouch(fx / w, fy / h);
      }
      const interactive = env.interactive;
      if (interactive) {
        window.addEventListener("pointerdown", onDown, { passive: true });
        window.addEventListener("pointermove", onMove, { passive: true });
      }

      const needsPost = () => p.liquid || p.noiseAmount > 0;

      return {
        init() {
          const gl = env.gl;
          scene = createProgram(gl, env.isGL2, FULLSCREEN_VERT, SCENE_FRAG, { derivatives: true });
          post = createProgram(gl, env.isGL2, FULLSCREEN_VERT, POST_FRAG);
          tri = createFullscreenTriangle(gl);
          rt = createRenderTarget(gl);
          touchTex = gl.createTexture();
          gl.bindTexture(gl.TEXTURE_2D, touchTex);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([127, 127, 0, 255]));
          gl.disable(gl.BLEND);
        },
        resize() {},
        pauseOffscreen: () => !!p.autoPauseOffscreen,
        render(_time, dt) {
          const gl = env.gl;
          const s = env.surface;
          sceneTime += dt * p.speed;
          const usePost = needsPost();

          if (usePost) {
            rt.setSize(s.width, s.height);
            gl.bindFramebuffer(gl.FRAMEBUFFER, rt.framebuffer);
          } else {
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
          }
          gl.viewport(0, 0, s.width, s.height);
          gl.clearColor(0, 0, 0, 0);
          gl.clear(gl.COLOR_BUFFER_BIT);

          scene.use();
          const u = (n) => scene.u(n);
          const back = p.transparent ? [0, 0, 0, 0] : [bg[0], bg[1], bg[2], 1];
          gl.uniform4fv(u("uColor"), colors.color);
          gl.uniform4fv(u("uBackground"), back);
          gl.uniform2f(u("uResolution"), s.width, s.height);
          gl.uniform1f(u("uTime"), sceneTime);
          gl.uniform1f(u("uPixelSize"), p.pixelSize * s.dpr);
          gl.uniform1f(u("uScale"), p.patternScale);
          gl.uniform1f(u("uDensity"), p.patternDensity);
          gl.uniform1f(u("uPixelJitter"), p.pixelSizeJitter);
          gl.uniform1i(u("uEnableRipples"), p.enableRipples ? 1 : 0);
          gl.uniform1f(u("uRippleSpeed"), p.rippleSpeed);
          gl.uniform1f(u("uRippleThickness"), p.rippleThickness);
          gl.uniform1f(u("uRippleIntensity"), p.rippleIntensityScale);
          gl.uniform1f(u("uEdgeFade"), p.edgeFade);
          gl.uniform1i(u("uShapeType"), SHAPES[p.variant] ?? 0);
          gl.uniform2fv(u("uClickPos[0]"), clickPos);
          gl.uniform1fv(u("uClickTimes[0]"), clickTimes);
          tri.draw();

          if (!usePost) return;

          // 第二遍：帧缓冲 → 画布
          gl.bindFramebuffer(gl.FRAMEBUFFER, null);
          gl.viewport(0, 0, s.width, s.height);
          post.use();
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, rt.texture);
          gl.uniform1i(post.u("uInput"), 0);
          gl.activeTexture(gl.TEXTURE1);
          gl.bindTexture(gl.TEXTURE_2D, touchTex);
          if (p.liquid && (touch.active || dt === 0)) {
            touch.update(dt * 60);
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, touch.canvas);
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
          }
          gl.uniform1i(post.u("uTouch"), 1);
          gl.uniform1f(post.u("uLiquid"), p.liquid ? 1 : 0);
          gl.uniform1f(post.u("uStrength"), p.liquidStrength);
          gl.uniform1f(post.u("uTime"), sceneTime);
          gl.uniform1f(post.u("uFreq"), p.liquidWobbleSpeed);
          gl.uniform1f(post.u("uNoise"), p.noiseAmount);
          tri.draw();
          gl.activeTexture(gl.TEXTURE0);
        },
        update(changed) {
          if (changed.has("liquidRadius")) touch.radiusScale = p.liquidRadius;
          readBg();
        },
        dispose() {
          const gl = env.gl;
          scene?.dispose();
          post?.dispose();
          tri?.dispose();
          rt?.dispose();
          if (touchTex) gl.deleteTexture(touchTex);
          scene = post = tri = rt = touchTex = null;
        },
        destroy() {
          if (interactive) {
            window.removeEventListener("pointerdown", onDown);
            window.removeEventListener("pointermove", onMove);
          }
        }
      };
    },
    { rebuildKeys: ["antialias"], powerPreference: "high-performance" }
  );
}
