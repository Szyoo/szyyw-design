/* ============================================================
   @szyyw/design · themes/gradient-waves.js
   背景主题「渐变波浪」：光线步进的起伏波面，远处雾化到地平线色，
   鼠标视差（仅精确指针）、胶片颗粒。原生 WebGL（WebGL2 优先，降级 WebGL1），零依赖。

   出处：React Bits GradientWaves（David Haz），MIT + Commons Clause。
   移植改动：ogl → 原生 WebGL；三个颜色改为 CSS token（--th-gradient-waves-*）；
   token 的 alpha 作为强度系数（浅色模式更淡）；fps / DPR 上限；指针在 window 上监听。
   ============================================================ */

import { FULLSCREEN_VERT, createProgram, createFullscreenTriangle, mountGLTheme, tokenOptions, PERF_PARAMS } from "./_gl.js";

const COLOR_TOKENS = [
  ["--th-gradient-waves-horizon", "主题 · 地平线", "テーマ · 地平線", "Theme · horizon"],
  ["--th-gradient-waves-wave", "主题 · 波面", "テーマ · 波面", "Theme · wave"],
  ["--th-gradient-waves-crest", "主题 · 浪尖", "テーマ · 波頭", "Theme · crest"]
];

export const meta = {
  id: "gradient-waves",
  labels: { zh: "渐变波浪", ja: "グラデーションウェーブ", en: "Gradient Waves" },
  params: [
    { key: "horizonColor", type: "token", default: "--th-gradient-waves-horizon", options: tokenOptions(COLOR_TOKENS),
      labels: { zh: "地平线颜色", ja: "地平線の色", en: "Horizon color" } },
    { key: "waveColor", type: "token", default: "--th-gradient-waves-wave", options: tokenOptions(COLOR_TOKENS),
      labels: { zh: "波面颜色", ja: "波面の色", en: "Wave color" } },
    { key: "crestColor", type: "token", default: "--th-gradient-waves-crest", options: tokenOptions(COLOR_TOKENS),
      labels: { zh: "浪尖颜色", ja: "波頭の色", en: "Crest color" } },
    { key: "speed", type: "range", min: 0, max: 2, step: 0.05, default: 0.4,
      labels: { zh: "速度", ja: "速度", en: "Speed" } },
    { key: "amplitude", type: "range", min: 0, max: 6, step: 0.1, default: 2.5,
      labels: { zh: "振幅", ja: "振幅", en: "Amplitude" } },
    { key: "waveScale", type: "range", min: 0.1, max: 2, step: 0.05, default: 0.6,
      labels: { zh: "波纹尺度", ja: "波のスケール", en: "Wave scale" } },
    { key: "waveRatio", type: "range", min: 0.1, max: 3, step: 0.05, default: 0.9,
      labels: { zh: "纵横比", ja: "縦横比", en: "Wave ratio" } },
    { key: "swell", type: "range", min: 0, max: 80, step: 1, default: 35,
      labels: { zh: "涌浪", ja: "うねり", en: "Swell" } },
    { key: "turbulence", type: "range", min: 0, max: 60, step: 1, default: 20,
      labels: { zh: "湍流", ja: "乱流", en: "Turbulence" } },
    { key: "tilt", type: "range", min: 0, max: 2, step: 0.01, default: 1.11,
      labels: { zh: "视角倾斜", ja: "傾き", en: "Tilt" } },
    { key: "zoom", type: "range", min: 0.3, max: 3, step: 0.05, default: 1,
      labels: { zh: "缩放", ja: "ズーム", en: "Zoom" } },
    { key: "height", type: "range", min: 0, max: 15, step: 0.1, default: 5.5,
      labels: { zh: "水面高度", ja: "水面の高さ", en: "Height" } },
    { key: "fogDepth", type: "range", min: 1, max: 50, step: 1, default: 15,
      labels: { zh: "雾深", ja: "霧の深さ", en: "Fog depth" } },
    { key: "detail", type: "select", default: "medium",
      options: [
        { value: "low", labels: { zh: "低", ja: "低", en: "Low" } },
        { value: "medium", labels: { zh: "中", ja: "中", en: "Medium" } },
        { value: "high", labels: { zh: "高", ja: "高", en: "High" } }
      ],
      labels: { zh: "细节", ja: "ディテール", en: "Detail" } },
    { key: "brightness", type: "range", min: 0.2, max: 2, step: 0.05, default: 1,
      labels: { zh: "亮度", ja: "明るさ", en: "Brightness" } },
    { key: "opacity", type: "range", min: 0, max: 1, step: 0.05, default: 1,
      labels: { zh: "不透明度", ja: "不透明度", en: "Opacity" } },
    { key: "mouseInteraction", type: "toggle", default: true,
      labels: { zh: "鼠标视差", ja: "マウス視差", en: "Mouse interaction" } },
    { key: "parallaxStrength", type: "range", min: 0, max: 2, step: 0.05, default: 0.5,
      labels: { zh: "视差强度", ja: "視差の強さ", en: "Parallax strength" } },
    { key: "grain", type: "toggle", default: true,
      labels: { zh: "颗粒", ja: "グレイン", en: "Grain" } },
    { key: "grainIntensity", type: "range", min: 0, max: 0.3, step: 0.01, default: 0.05,
      labels: { zh: "颗粒强度", ja: "グレインの強さ", en: "Grain intensity" } },
    ...PERF_PARAMS
  ]
};

const DETAIL_STEPS = { low: 40, medium: 70, high: 110 };

const FRAG = `
uniform vec2 iResolution;
uniform float iTime;
uniform float uSpeed;
uniform float uAmplitude;
uniform float uWaveScale;
uniform float uWaveRatio;
uniform float uSwell;
uniform float uTurbulence;
uniform float uTilt;
uniform float uZoom;
uniform float uHeight;
uniform float uFogDepth;
uniform float uSteps;
uniform float uBrightness;
uniform float uOpacity;
uniform float uGrain;
uniform float uGrainIntensity;
uniform vec2 uMouse;
uniform float uParallax;
uniform float uEnableMouse;
uniform vec4 uHorizonColor;
uniform vec4 uWaveColor;
uniform vec4 uCrestColor;

const float MAX_DIST = 20000.0;

float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float plasma(vec3 r, vec2 freq, vec4 tc) {
  float mx = r.x + tc.x;
  mx += uSwell * sin((r.y + mx) / 20.0 + tc.y);
  float my = r.y - tc.z;
  my += uTurbulence * cos(r.x / 23.0 + tc.w);
  return r.z - (sin(mx * freq.x) * uAmplitude + sin(my * freq.y) * uAmplitude + uHeight);
}

float raymarch(vec3 pos, vec3 dir, vec2 freq, vec4 tc) {
  float dist = 0.0;
  for (int i = 0; i < 128; i++) {
    if (float(i) >= uSteps) break;
    float dscene = plasma(pos + dist * dir, freq, tc);
    if (abs(dscene) < 0.1) break;
    dist += 0.9 * dscene;
    if (!(abs(dist) < MAX_DIST)) return MAX_DIST;
  }
  return dist;
}

void main() {
  float T = iTime * uSpeed;
  vec2 freq = vec2(uWaveScale / 7.0, (uWaveScale * uWaveRatio) / 3.0);
  vec4 tc = vec4(T / 0.130, T / 0.810, T / 0.200, T / 0.710);
  float c, s;
  float vfov = (3.14159 / 2.3) / max(uZoom, 0.05);
  vec3 cam = vec3(0.0, 0.0, 30.0);
  vec2 uv = (gl_FragCoord.xy / iResolution.xy) - 0.5;
  uv.x *= iResolution.x / iResolution.y;
  uv.y *= -1.0;

  vec3 dir = vec3(0.0, 0.0, -1.0);
  float ulen = length(uv);
  float xrot = vfov * ulen;
  c = cos(xrot); s = sin(xrot);
  dir = mat3(1.0, 0.0, 0.0, 0.0, c, -s, 0.0, s, c) * dir;
  vec2 nuv = ulen > 1e-5 ? uv / ulen : vec2(1.0, 0.0);
  c = nuv.x; s = nuv.y;
  dir = mat3(c, -s, 0.0, s, c, 0.0, 0.0, 0.0, 1.0) * dir;
  c = cos(uTilt); s = sin(uTilt);
  dir = mat3(c, 0.0, s, 0.0, 1.0, 0.0, -s, 0.0, c) * dir;

  if (uEnableMouse > 0.5) {
    float yaw = (uMouse.x - 0.5) * uParallax * 0.4;
    float pitch = (uMouse.y - 0.5) * uParallax * 0.4;
    c = cos(yaw); s = sin(yaw);
    dir = mat3(c, 0.0, s, 0.0, 1.0, 0.0, -s, 0.0, c) * dir;
    c = cos(pitch); s = sin(pitch);
    dir = mat3(1.0, 0.0, 0.0, 0.0, c, -s, 0.0, s, c) * dir;
  }

  float dist = raymarch(cam, dir, freq, tc);
  vec3 pos = cam + dist * dir;

  float t = clamp(uFogDepth / max(dist, 0.001), 0.0, 1.0);
  // token 颜色带 alpha：rgb 照上游混色，alpha 作强度系数一起混
  vec4 body = mix(uWaveColor, uCrestColor, clamp(pos.z * 0.08 + 0.5, 0.0, 1.0));
  vec4 col4 = mix(uHorizonColor, body, t);
  vec3 col = clamp(col4.rgb * uBrightness, 0.0, 1.0);

  float alpha = t * uOpacity * col4.a;
  if (uGrain > 0.5) {
    float g = hash21(gl_FragCoord.xy + mod(iTime, 64.0) * 11.0);
    alpha += (g - 0.5) * uGrainIntensity;
  }
  alpha = clamp(alpha, 0.0, 1.0);
  gl_FragColor = vec4(col * alpha, alpha);
}
`;

export function mount(container, params, ctx) {
  return mountGLTheme(meta, container, params, ctx, (env) => {
    const { p, colors } = env;
    let prog = null;
    let tri = null;
    const target = [0.5, 0.5];
    const cur = [0.5, 0.5];
    let mouseActive = false;

    function onMove(e) {
      const r = env.surface.canvas.getBoundingClientRect();
      target[0] = (e.clientX - r.left) / Math.max(1, r.width);
      target[1] = 1 - (e.clientY - r.top) / Math.max(1, r.height);
    }
    function onOut(e) {
      if (e.relatedTarget) return;
      target[0] = 0.5;
      target[1] = 0.5;
    }
    if (env.interactive) {
      window.addEventListener("pointermove", onMove, { passive: true });
      document.addEventListener("mouseout", onOut);
      mouseActive = true;
    }

    return {
      init() {
        const gl = env.gl;
        prog = createProgram(gl, env.isGL2, FULLSCREEN_VERT, FRAG);
        tri = createFullscreenTriangle(gl);
        gl.disable(gl.BLEND);
        gl.disable(gl.DEPTH_TEST);
      },
      resize() {},
      render(time, dt) {
        const gl = env.gl;
        const s = env.surface;
        const tx = p.mouseInteraction ? target[0] : 0.5;
        const ty = p.mouseInteraction ? target[1] : 0.5;
        // 上游每帧 0.05 的缓动是按 60fps 写的；降帧时按时间折算，跟手速度不变
        const k = 1 - Math.pow(0.95, dt * 60);
        cur[0] += k * (tx - cur[0]);
        cur[1] += k * (ty - cur[1]);

        gl.viewport(0, 0, s.width, s.height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        prog.use();
        const u = (n) => prog.u(n);
        gl.uniform2f(u("iResolution"), s.width, s.height);
        gl.uniform1f(u("iTime"), time);
        gl.uniform1f(u("uSpeed"), p.speed);
        gl.uniform1f(u("uAmplitude"), p.amplitude);
        gl.uniform1f(u("uWaveScale"), p.waveScale);
        gl.uniform1f(u("uWaveRatio"), p.waveRatio);
        gl.uniform1f(u("uSwell"), p.swell);
        gl.uniform1f(u("uTurbulence"), p.turbulence);
        gl.uniform1f(u("uTilt"), p.tilt);
        gl.uniform1f(u("uZoom"), p.zoom);
        gl.uniform1f(u("uHeight"), p.height);
        gl.uniform1f(u("uFogDepth"), p.fogDepth);
        gl.uniform1f(u("uSteps"), DETAIL_STEPS[p.detail] ?? 70);
        gl.uniform1f(u("uBrightness"), p.brightness);
        gl.uniform1f(u("uOpacity"), p.opacity);
        gl.uniform1f(u("uGrain"), p.grain ? 1 : 0);
        gl.uniform1f(u("uGrainIntensity"), p.grainIntensity);
        gl.uniform2f(u("uMouse"), cur[0], cur[1]);
        gl.uniform1f(u("uParallax"), p.parallaxStrength);
        gl.uniform1f(u("uEnableMouse"), p.mouseInteraction && mouseActive ? 1 : 0);
        gl.uniform4fv(u("uHorizonColor"), colors.horizonColor);
        gl.uniform4fv(u("uWaveColor"), colors.waveColor);
        gl.uniform4fv(u("uCrestColor"), colors.crestColor);
        tri.draw();
      },
      update() {},
      dispose() {
        prog?.dispose();
        tri?.dispose();
        prog = tri = null;
      },
      destroy() {
        if (mouseActive) {
          window.removeEventListener("pointermove", onMove);
          document.removeEventListener("mouseout", onOut);
        }
      }
    };
  });
}
