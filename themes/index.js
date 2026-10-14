/* ============================================================
   @szyyw/design · themes/index.js
   背景主题注册表（v0.19.0）：id → 名字 + 动态加载器。零 DOM，服务端 import 无副作用。

   只有当前主题会被加载（import() 按需取 themes/<id>.js）；nebula 由 theme-background.js
   静态引入（缺省主题，首帧不等网络）。新增主题 = 写 themes/<id>.js（接口见 types.d.ts）
   + 在下面登记一行 + 在 appearance-data.js 的 THEMES 加 id（scripts/check-tokens.mjs 断言两边一致）。
   这里的 labels 只用于主题尚未加载时的列表显示，应与模块 meta.labels 一致。
   ============================================================ */

const entry = (id, labels, load) => Object.freeze({ id, labels: Object.freeze(labels), load });

export const THEME_REGISTRY = Object.freeze([
  entry("nebula", { zh: "星云", ja: "ネビュラ", en: "Nebula" }, () => import("./nebula.js")),
  entry("cursor-grid", { zh: "光标网格", ja: "カーソルグリッド", en: "Cursor Grid" }, () => import("./cursor-grid.js")),
  entry("gradient-waves", { zh: "渐变波浪", ja: "グラデーションウェーブ", en: "Gradient Waves" }, () =>
    import("./gradient-waves.js")
  ),
  entry("side-rays", { zh: "侧光", ja: "サイドレイ", en: "Side Rays" }, () => import("./side-rays.js")),
  entry("pixel-blast", { zh: "像素爆破", ja: "ピクセルブラスト", en: "Pixel Blast" }, () => import("./pixel-blast.js")),
  entry("particles", { zh: "粒子", ja: "パーティクル", en: "Particles" }, () => import("./particles.js"))
]);

/** 按 id 取注册项；没有返回 null */
export function themeEntry(id) {
  return THEME_REGISTRY.find((t) => t.id === id) ?? null;
}

const cache = new Map();

/**
 * 加载主题模块（同一 id 只加载一次；失败不缓存，下次可重试）。
 * 未登记的 id、或模块缺 meta / mount 时 reject。
 */
export function loadTheme(id) {
  const hit = cache.get(id);
  if (hit) return hit;
  const e = themeEntry(id);
  if (!e) return Promise.reject(new Error(`unknown theme: ${id}`));
  const p = e.load().then((mod) => {
    if (!mod || !mod.meta || typeof mod.mount !== "function") throw new Error(`theme ${id}: missing meta / mount`);
    return mod;
  });
  cache.set(id, p);
  p.catch(() => cache.delete(id));
  return p;
}

/** "ja-JP" → 对应文案；缺的语言按 zh → en → 回退值 */
export function pickLabel(labels, locale, fallback = "") {
  if (!labels || typeof labels !== "object") return fallback;
  const base = String(locale || "zh").toLowerCase().split(/[-_]/)[0];
  return labels[base] ?? labels.zh ?? labels.en ?? fallback;
}
