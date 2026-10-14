/* ============================================================
   @szyyw/design · themes/side-rays.js
   背景主题「侧光」：从画面一角斜射进来的两束体积光，缓慢摆动。
   原生 WebGL（WebGL2 优先，降级 WebGL1），零依赖。

   出处：React Bits SideRays（David Haz），MIT + Commons Clause。
   移植改动：ogl → 原生 WebGL；两束光的颜色改为 CSS token（--th-side-rays-1/2），
   token 的 alpha 作强度系数（浅色模式更淡）；输出改为预乘 alpha（与上游非预乘画布合成结果一致）；
   fps / DPR 上限；参数热更新不重建上下文（上游每次改参数都重建）。
   ============================================================ */

import { FULLSCREEN_VERT, createProgram, createFullscreenTriangle, mountGLTheme, tokenOptions, PERF_PARAMS } from "./_gl.js";

const COLOR_TOKENS = [
  ["--th-side-rays-1", "主题 · 主光", "テーマ · 主光", "Theme · ray 1"],
  ["--th-side-rays-2", "主题 · 副光", "テーマ · 副光", "Theme · ray 2"]
];

const ORIGINS = {
  "top-right": [0, 0],
  "top-left": [1, 0],
  "bottom-right": [0, 1],
  "bottom-left": [1, 1]
};

export const meta = {
  id: "side-rays",
  labels: { zh: "侧光", ja: "サイドレイ", en: "Side Rays" },
  params: [
    { key: "speed", type: "range", min: 0, max: 10, step: 0.1, default: 2.5,
      labels: { zh: "速度", ja: "速度", en: "Speed" } },
    { key: "rayColor1", type: "token", default: "--th-side-rays-1", options: tokenOptions(COLOR_TOKENS),
      labels: { zh: "光束颜色 1", ja: "光線の色 1", en: "Ray color 1" } },
    { key: "rayColor2", type: "token", default: "--th-side-rays-2", options: tokenOptions(COLOR_TOKENS),
      labels: { zh: "光束颜色 2", ja: "光線の色 2", en: "Ray color 2" } },
    { key: "intensity", type: "range", min: 0, max: 5, step: 0.1, default: 2,
      labels: { zh: "强度", ja: "強さ", en: "Intensity" } },
    { key: "spread", type: "range", min: 0, max: 5, step: 0.1, default: 2,
      labels: { zh: "张角", ja: "広がり", en: "Spread" } },
    { key: "origin", type: "select", default: "top-right",
      options: [
        { value: "top-right", labels: { zh: "右上", ja: "右上", en: "Top right" } },
        { value: "top-left", labels: { zh: "左上", ja: "左上", en: "Top left" } },
        { value: "bottom-right", labels: { zh: "右下", ja: "右下", en: "Bottom right" } },
        { value: "bottom-left", labels: { zh: "左下", ja: "左下", en: "Bottom left" } }
      ],
      labels: { zh: "光源位置", ja: "光源の位置", en: "Origin" } },
    { key: "tilt", type: "range", min: -90, max: 90, step: 1, default: 0,
      labels: { zh: "倾斜（度）", ja: "傾き（度）", en: "Tilt (deg)" } },
    { key: "saturation", type: "range", min: 0, max: 3, step: 0.05, default: 1.5,
      labels: { zh: "饱和度", ja: "彩度", en: "Saturation" } },
    { key: "blend", type: "range", min: 0, max: 1, step: 0.01, default: 0.75,
      labels: { zh: "两束混合", ja: "2 色の配分", en: "Blend" } },
    { key: "falloff", type: "range", min: 0.2, max: 4, step: 0.05, default: 1.6,
      labels: { zh: "衰减", ja: "減衰", en: "Falloff" } },
    { key: "opacity", type: "range", min: 0, max: 1, step: 0.05, default: 1,
      labels: { zh: "不透明度", ja: "不透明度", en: "Opacity" } },
    ...PERF_PARAMS
  ]
};

const FRAG = `
uniform float iTime;
uniform vec2 iResolution;
uniform float iSpeed;
uniform vec4 iRayColor1;
uniform vec4 iRayColor2;
uniform float iIntensity;
uniform float iSpread;
uniform float iFlipX;
uniform float iFlipY;
uniform float iTilt;
uniform float iSaturation;
uniform float iBlend;
uniform float iFalloff;
uniform float iOpacity;

float rayStrength(vec2 raySource, vec2 rayRefDirection, vec2 coord, float seedA, float seedB, float speed) {
  vec2 sourceToCoord = coord - raySource;
  float cosAngle = dot(normalize(sourceToCoord), rayRefDirection);
  return clamp(
    (0.45 + 0.15 * sin(cosAngle * seedA + iTime * speed)) +
    (0.3 + 0.2 * cos(-cosAngle * seedB + iTime * speed)),
    0.0, 1.0) *
    clamp((iResolution.x - length(sourceToCoord)) / iResolution.x, 0.5, 1.0);
}

void main() {
  vec2 fragCoord = gl_FragCoord.xy;
  if (iFlipX > 0.5) fragCoord.x = iResolution.x - fragCoord.x;
  if (iFlipY > 0.5) fragCoord.y = iResolution.y - fragCoord.y;

  vec2 coord = vec2(fragCoord.x, iResolution.y - fragCoord.y);
  vec2 rayPos = vec2(iResolution.x * 1.1, -0.5 * iResolution.y);

  float tiltRad = iTilt * 3.14159265 / 180.0;
  float cs = cos(tiltRad);
  float sn = sin(tiltRad);
  vec2 rel = coord - rayPos;
  vec2 tiltedCoord = vec2(rel.x * cs - rel.y * sn, rel.x * sn + rel.y * cs) + rayPos;

  float halfSpread = iSpread * 0.275;
  vec2 rayRefDir1 = normalize(vec2(cos(0.785398 + halfSpread), sin(0.785398 + halfSpread)));
  vec2 rayRefDir2 = normalize(vec2(cos(0.785398 - halfSpread), sin(0.785398 - halfSpread)));

  // token alpha 作强度系数
  vec4 rays1 = vec4(iRayColor1.rgb * iRayColor1.a, 1.0) * rayStrength(rayPos, rayRefDir1, tiltedCoord, 36.2214, 21.11349, iSpeed);
  vec4 rays2 = vec4(iRayColor2.rgb * iRayColor2.a, 1.0) * rayStrength(rayPos, rayRefDir2, tiltedCoord, 22.3991, 18.0234, iSpeed * 0.2);

  vec4 color = rays1 * (1.0 - iBlend) * 0.9 + rays2 * iBlend * 0.9;

  float distanceToLight = length(fragCoord.xy - vec2(rayPos.x, iResolution.y - rayPos.y)) / iResolution.y;
  float brightness = iIntensity * 0.4 / pow(max(distanceToLight, 0.001), iFalloff);
  color.rgb *= brightness;

  float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
  color.rgb = mix(vec3(gray), color.rgb, iSaturation);

  // 上游画布是非预乘 alpha：合成结果 = clamp(rgb) * a + 底 * (1 - a)；这里直接输出预乘形式
  float a = clamp(max(color.r, max(color.g, color.b)) * iOpacity, 0.0, 1.0);
  gl_FragColor = vec4(clamp(color.rgb, 0.0, 1.0) * a, a);
}
`;

export function mount(container, params, ctx) {
  return mountGLTheme(meta, container, params, ctx, (env) => {
    const { p, colors } = env;
    let prog = null;
    let tri = null;
    return {
      init() {
        const gl = env.gl;
        prog = createProgram(gl, env.isGL2, FULLSCREEN_VERT, FRAG);
        tri = createFullscreenTriangle(gl);
        gl.disable(gl.BLEND);
      },
      render(time) {
        const gl = env.gl;
        const s = env.surface;
        const [fx, fy] = ORIGINS[p.origin] ?? ORIGINS["top-right"];
        gl.viewport(0, 0, s.width, s.height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        prog.use();
        const u = (n) => prog.u(n);
        gl.uniform1f(u("iTime"), time);
        gl.uniform2f(u("iResolution"), s.width, s.height);
        gl.uniform1f(u("iSpeed"), p.speed);
        gl.uniform4fv(u("iRayColor1"), colors.rayColor1);
        gl.uniform4fv(u("iRayColor2"), colors.rayColor2);
        gl.uniform1f(u("iIntensity"), p.intensity);
        gl.uniform1f(u("iSpread"), p.spread);
        gl.uniform1f(u("iFlipX"), fx);
        gl.uniform1f(u("iFlipY"), fy);
        gl.uniform1f(u("iTilt"), p.tilt);
        gl.uniform1f(u("iSaturation"), p.saturation);
        gl.uniform1f(u("iBlend"), p.blend);
        gl.uniform1f(u("iFalloff"), p.falloff);
        gl.uniform1f(u("iOpacity"), p.opacity);
        tri.draw();
      },
      update() {},
      dispose() {
        prog?.dispose();
        tri?.dispose();
        prog = tri = null;
      },
      destroy() {}
    };
  });
}
