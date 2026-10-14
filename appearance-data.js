/* ============================================================
   @szyyw/design · appearance-data.js
   外观三层（主题 → 配色 → 明暗）+ 鼠标效果的选项表与纯函数——单一事实来源。

   零 DOM、零 import：服务端（Node / Next server component）可直接 import，
   用来在 SSR 时读 cookie、铺 <html> 属性、算 theme-color，首屏不闪。

   tokens.css 是 CSS，JS 没法 import 它；所以「有哪些配色、每个配色 --bg 的
   light / dark 两套值」在这里再声明一次，由 scripts/check-tokens.mjs 断言两边一致。
   改 tokens.css 的配色块必须同步改这里并跑 `node scripts/check-tokens.mjs`。
   ============================================================ */

const freeze = (o) => Object.freeze(o);

/**
 * 主题：背景效果（v0.19.0 起可插拔，见 themes/index.js 的注册表）。id 与 html[data-theme] 同值。
 * 这里只列 id（服务端零 DOM 读法用）；名字、参数表、加载器在 themes/index.js 与各 themes/<id>.js。
 * 两边一致由 scripts/check-tokens.mjs 断言。未知 id 一律回退 nebula。
 */
export const THEMES = freeze([
  freeze({ id: "nebula" }),
  freeze({ id: "cursor-grid" }),
  freeze({ id: "gradient-waves" }),
  freeze({ id: "side-rays" }),
  freeze({ id: "pixel-blast" }),
  freeze({ id: "particles" })
]);

/**
 * 配色：色彩变体。id 为 "default" 的是基础块（tokens.css 的 :root），
 * 其余对应 :root[data-palette="<id>"]。bg 即该配色 --bg 的 light-dark() 两套值。
 * v0.19.0 起配色在所有主题下通用（tokens.css 的配色块不依赖 data-theme）；theme 字段只标注来源。
 */
export const PALETTES = freeze([
  freeze({ id: "default", theme: "nebula", bg: freeze({ dark: "#0b1020", light: "#eef1f8" }) }),
  freeze({ id: "aurora", theme: "nebula", bg: freeze({ dark: "#081412", light: "#edf6f2" }) })
]);

/** 明暗（面板展示顺序）。🌗 按钮的循环顺序另见 scheme.js（auto → light → dark） */
export const SCHEMES = freeze(["auto", "dark", "light"]);

/**
 * 鼠标效果（v0.19.0）：html[data-cursor]。"default" = 系统指针（不写属性）；
 * "target" = Target Cursor（target-cursor.js，只在 pointer: fine 下生效）。
 */
export const CURSORS = freeze(["default", "target"]);

export const DEFAULT_APPEARANCE = freeze({ theme: "nebula", palette: "default", scheme: "dark", cursor: "default" });

/** 缺省的存储键名（cookie / localStorage 共用）；应用一般会换成带前缀的，如 fl_theme */
export const APPEARANCE_COOKIES = freeze({ theme: "theme", palette: "palette", scheme: "scheme", cursor: "cursor" });

const pick = (v) => (typeof v === "string" ? v.trim() : "");

/**
 * 任意输入 → 合法外观（theme / palette / scheme / cursor）。非法 / 缺省的项回退到 DEFAULT_APPEARANCE。
 * 未知主题（含尚未发布到当前版本的主题）回退 nebula；配色与主题无关，任意主题都可配任意配色。
 */
export function normalizeAppearance(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  const themeIn = pick(src.theme);
  const theme = THEMES.some((t) => t.id === themeIn) ? themeIn : DEFAULT_APPEARANCE.theme;
  const paletteIn = pick(src.palette);
  const palette = PALETTES.some((p) => p.id === paletteIn) ? paletteIn : DEFAULT_APPEARANCE.palette;
  const schemeIn = pick(src.scheme);
  const scheme = SCHEMES.includes(schemeIn) ? schemeIn : DEFAULT_APPEARANCE.scheme;
  const cursorIn = pick(src.cursor);
  const cursor = CURSORS.includes(cursorIn) ? cursorIn : DEFAULT_APPEARANCE.cursor;
  return { theme, palette, scheme, cursor };
}

/**
 * 浏览器 chrome 着色（<meta name="theme-color"> / Next generateViewport）：配色 × 明暗 → 底色。
 * dark / light 返回单色；auto 返回 { dark, light }，由调用方配 media 查询各出一条。
 */
export function themeColorFor(palette, scheme) {
  const p = PALETTES.find((x) => x.id === palette) ?? PALETTES.find((x) => x.id === DEFAULT_APPEARANCE.palette);
  const s = SCHEMES.includes(scheme) ? scheme : DEFAULT_APPEARANCE.scheme;
  if (s === "auto") return { dark: p.bg.dark, light: p.bg.light };
  return p.bg[s];
}

function decode(v) {
  if (typeof v !== "string") return undefined;
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}

/**
 * 服务端从 cookie 读外观（SSR 首屏不闪的唯一正确读法）。
 *
 *   readAppearanceFromCookies((n) => jar.get(n)?.value, { theme: "fl_theme", palette: "fl_palette", scheme: "fl_scheme" })
 *
 * @param get      按 cookie 名取值；取不到返回 undefined / null
 * @param cookies  各项 cookie 名，缺的项用 APPEARANCE_COOKIES 的缺省名
 *                 （只给三项的旧写法照旧可用：cursor 用缺省名 "cursor"；建议用 appearanceCookieNames(prefix) 生成整套）
 */
export function readAppearanceFromCookies(get, cookies = APPEARANCE_COOKIES) {
  const names = { ...APPEARANCE_COOKIES, ...(cookies || {}) };
  const read = (key) => (typeof get === "function" ? decode(get(names[key]) ?? undefined) : undefined);
  return normalizeAppearance({
    theme: read("theme"),
    palette: read("palette"),
    scheme: read("scheme"),
    cursor: read("cursor")
  });
}

/**
 * 要写到 <html> 上的属性。palette 为 "default" 时不写 data-palette（对齐 tokens.css 的缺省块）；
 * cursor 为 "default" 时不写 data-cursor。
 *
 *   <html lang="zh" {...appearanceAttrs(a)}>
 */
export function appearanceAttrs(a) {
  const n = normalizeAppearance(a);
  const attrs = { "data-theme": n.theme };
  if (n.palette !== "default") attrs["data-palette"] = n.palette;
  attrs["data-scheme"] = n.scheme;
  if (n.cursor !== "default") attrs["data-cursor"] = n.cursor;
  return attrs;
}

/**
 * 按前缀生成各项存储键：appearanceCookieNames("fl_") →
 * { theme: "fl_theme", palette: "fl_palette", scheme: "fl_scheme", cursor: "fl_cursor" }。
 * 服务端 readAppearanceFromCookies 与客户端 mountAppearance({ cookiePrefix }) 用同一个前缀就不会对不上。
 */
export function appearanceCookieNames(prefix = "") {
  return {
    theme: `${prefix}${APPEARANCE_COOKIES.theme}`,
    palette: `${prefix}${APPEARANCE_COOKIES.palette}`,
    scheme: `${prefix}${APPEARANCE_COOKIES.scheme}`,
    cursor: `${prefix}${APPEARANCE_COOKIES.cursor}`
  };
}
