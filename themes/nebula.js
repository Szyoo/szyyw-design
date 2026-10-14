/* ============================================================
   @szyyw/design · themes/nebula.js
   缺省主题「星云」：DotField 点阵背景（dotfield.js）的主题适配器（v0.19.0）。

   参数表 = 旧「背景参数」面板的全部参数（键名不变），存储沿用 szyyw:dotfield，
   旧 API（mountDotField / mountDotFieldSettings / restoreDotFieldSettings）照旧可用。
   颜色三项是 type "color"：由主题框架写成 <html> 行内 token（--df-from / --df-to / --df-glow），
   DotField 的 observer 接住换色——与旧面板同一套语义。

   「没调过的跟主题旋钮走」：挂载时只把用户动过的键（ctx.overrides）交给 DotField，
   未动过的 sparkle / waveAmplitude 继续跟 --df-sparkle / --df-wave；恢复缺省时重挂，把控制权交还主题。
   ============================================================ */

import { mountDotField, DEFAULTS } from "../dotfield.js";

const L = (zh, ja, en) => ({ zh, ja, en });

export const meta = {
  id: "nebula",
  labels: L("星云", "ネビュラ", "Nebula"),
  params: [
    {
      key: "bulgeOnly",
      type: "toggle",
      default: DEFAULTS.bulgeOnly,
      labels: L("凹陷模式", "へこみモード", "Dent mode"),
      hints: L(
        "开=鼠标压出凹陷；关=点被推开回弹",
        "オン＝カーソルでへこむ／オフ＝ドットが押しのけられて戻る",
        "On = the cursor dents the field; off = dots are pushed away and spring back"
      )
    },
    { key: "sparkle", type: "toggle", default: DEFAULTS.sparkle, labels: L("随机闪烁", "ランダムにきらめく", "Random sparkle") },
    { key: "glow", type: "toggle", default: DEFAULTS.glow, labels: L("鼠标光晕", "カーソルの光", "Cursor glow") },
    { key: "dotRadius", type: "range", min: 0.5, max: 4, step: 0.1, default: DEFAULTS.dotRadius, labels: L("点大小", "ドットの大きさ", "Dot size") },
    { key: "dotSpacing", type: "range", min: 6, max: 40, step: 1, default: DEFAULTS.dotSpacing, labels: L("点间距", "ドットの間隔", "Dot spacing") },
    {
      key: "cursorRadius",
      type: "range",
      min: 100,
      max: 800,
      step: 10,
      default: DEFAULTS.cursorRadius,
      labels: L("鼠标影响半径", "カーソルの影響範囲", "Cursor radius")
    },
    {
      key: "cursorForce",
      type: "range",
      min: 0.02,
      max: 0.3,
      step: 0.01,
      default: DEFAULTS.cursorForce,
      labels: L("扰动力度", "揺らぎの強さ", "Push strength"),
      visibleWhen: { key: "bulgeOnly", equals: false }
    },
    {
      key: "bulgeStrength",
      type: "range",
      min: 10,
      max: 120,
      step: 1,
      default: DEFAULTS.bulgeStrength,
      labels: L("凹陷强度", "へこみの強さ", "Dent depth"),
      visibleWhen: { key: "bulgeOnly", equals: true }
    },
    {
      key: "glowRadius",
      type: "range",
      min: 60,
      max: 400,
      step: 10,
      default: DEFAULTS.glowRadius,
      labels: L("鼠标光晕半径", "カーソルの光の範囲", "Cursor glow radius"),
      visibleWhen: { key: "glow", equals: true }
    },
    {
      key: "waveAmplitude",
      type: "range",
      min: 0,
      max: 8,
      step: 0.5,
      default: DEFAULTS.waveAmplitude,
      labels: L("波浪幅度", "波の振幅", "Wave amplitude")
    },
    { key: "fps", type: "range", min: 15, max: 60, step: 5, default: DEFAULTS.fps, labels: L("帧率上限", "フレームレート上限", "Frame-rate cap") },
    {
      key: "gradientFrom",
      type: "color",
      token: "--df-from",
      alpha: true,
      default: null,
      labels: L("点阵渐变 A", "ドットのグラデーション A", "Dot gradient A")
    },
    {
      key: "gradientTo",
      type: "color",
      token: "--df-to",
      alpha: true,
      default: null,
      labels: L("点阵渐变 B", "ドットのグラデーション B", "Dot gradient B")
    },
    { key: "glowColor", type: "color", token: "--df-glow", alpha: false, default: null, labels: L("光晕颜色", "光の色", "Glow color") }
  ]
};

const BEHAVIOR = Object.keys(DEFAULTS);

function pickBehavior(obj, keys = BEHAVIOR) {
  const out = {};
  for (const k of keys) if (BEHAVIOR.includes(k) && obj && obj[k] !== undefined && obj[k] !== null) out[k] = obj[k];
  return out;
}

/**
 * 主题接口：挂 DotField 到容器。返回的 field 是底层 DotFieldHandle（旧代码要直接调 setOptions 时用）。
 */
export function mount(container, params = {}, ctx = {}) {
  // 只交出用户动过的键；没有 ctx（单独使用）时按传入的 params 全部生效
  const initial = () => pickBehavior(ctx.overrides ?? params);
  let field = mountDotField(container, initial());

  return {
    get field() {
      return field;
    },
    update(next, info) {
      const changed = info?.changed ?? BEHAVIOR;
      if (info?.overrides) ctx.overrides = info.overrides;
      // glow 决定是否建光晕层，只能在挂载时定：变了就重挂
      if (changed.includes("glow") && next.glow !== field.getOptions().glow) {
        field.destroy();
        field = mountDotField(container, initial());
        return;
      }
      field.setOptions(pickBehavior(next, changed));
    },
    reset() {
      // 重挂而不是 resetOptions：基线回到包缺省，主题旋钮重新接管 sparkle / 波浪
      ctx.overrides = {};
      field.destroy();
      field = mountDotField(container, {});
    },
    destroy() {
      field.destroy();
    }
  };
}
