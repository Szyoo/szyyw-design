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

/** 「随机」主题选项的 id（v0.21.0）：存储里保存它本身，每次打开从真实主题里均匀抽一个挂上 */
export const RANDOM_THEME = "random";

/**
 * 主题选项（v0.21.0 起第一项是 "random"，带 random: true；它不是真实主题，注册表里没有）。
 * 其余项是背景效果（v0.19.0 起可插拔，见 themes/index.js 的注册表），id 与 html[data-theme] 同值。
 * 这里只列 id（服务端零 DOM 读法用）；名字、参数表、加载器在 themes/index.js 与各 themes/<id>.js。
 * 真实主题与注册表一致由 scripts/check-tokens.mjs 断言。未知 id 一律回退缺省（random）。
 *
 * html 上的表示：选中 random 时 data-theme = 本次实际抽到的主题 id，另加 data-theme-mode="random"；
 * 显式选了某个主题时只有 data-theme，没有 data-theme-mode。
 */
export const THEMES = freeze([
  freeze({ id: RANDOM_THEME, random: true }),
  freeze({ id: "nebula" }),
  freeze({ id: "cursor-grid" }),
  freeze({ id: "gradient-waves" }),
  freeze({ id: "side-rays" }),
  freeze({ id: "pixel-blast" }),
  freeze({ id: "particles" })
]);

/** 真实主题 id（不含 random），与 themes/index.js 注册表同序 */
export const REAL_THEME_IDS = freeze(THEMES.filter((t) => !t.random).map((t) => t.id));

/** 真实主题都加载失败 / 无从抽取时的回退主题 */
export const FALLBACK_THEME = "nebula";

/**
 * 配色：色彩变体。id 为 "default" 的是基础块（tokens.css 的 :root），
 * 其余对应 :root[data-palette="<id>"]。bg 即该配色 --bg 的 light-dark() 两套值。
 * v0.19.0 起配色在所有主题下通用（tokens.css 的配色块不依赖 data-theme）；theme 字段只标注来源。
 * v0.21.0 移除 "aurora"（极光翠青）：存着它的用户 normalize 回 "default"。只剩一种配色时外观弹层不显示配色栏。
 */
export const PALETTES = freeze([
  freeze({ id: "default", theme: "nebula", bg: freeze({ dark: "#0b1020", light: "#eef1f8" }) })
]);

/** 明暗（面板展示顺序）。🌗 按钮的循环顺序另见 scheme.js（auto → light → dark） */
export const SCHEMES = freeze(["auto", "dark", "light"]);

/**
 * 鼠标效果（v0.19.0）：html[data-cursor]。"default" = 系统指针（不写属性）；
 * "target" = Target Cursor（target-cursor.js，只在 pointer: fine 下生效）。
 */
export const CURSORS = freeze(["default", "target"]);

/** v0.21.0 起缺省主题为 "random" */
export const DEFAULT_APPEARANCE = freeze({ theme: RANDOM_THEME, palette: "default", scheme: "dark", cursor: "default" });

/**
 * 缺省的存储键名（cookie / localStorage 共用）；应用一般会换成带前缀的，如 fl_theme。
 * themeSet（v0.21.0）：「主题是用户显式选的」标记键，值 "1"。没给时按 `${theme}_set` 推出（fl_theme → fl_theme_set）。
 */
export const APPEARANCE_COOKIES = freeze({
  theme: "theme",
  palette: "palette",
  scheme: "scheme",
  cursor: "cursor",
  themeSet: "theme_set"
});

const pick = (v) => (typeof v === "string" ? v.trim() : "");

/**
 * 任意输入 → 合法外观（theme / palette / scheme / cursor）。非法 / 缺省的项回退到 DEFAULT_APPEARANCE。
 * theme 可以是 "random" 或任一真实主题；未知主题（含尚未发布到当前版本的主题）回退缺省 "random"（v0.21.0 前是 nebula）。
 * 配色与主题无关；已移除的配色（如 v0.21.0 的 aurora）回退 "default"。
 * 注意：这里不做「旧缺省 nebula → random」迁移（它需要显式选择标记），迁移见 resolveThemeChoice。
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
 * 存储里的主题值 + 「显式选择」标记 → 实际的主题选择（v0.21.0 的一次性迁移规则）。
 * - 有标记（"1" / true）：按存储值（normalize；非法回退 random）
 * - 没标记：值为 nebula / 缺省 / 非法 → "random"（v0.19.0 之前 nebula 是唯一主题，存着它只说明是缺省）；
 *   值是其他真实主题或 random → 保持（那是 v0.19.0 里用户自己点的）
 * 服务端 readAppearanceFromCookies 与客户端 configureAppearance 用的都是这一条；应用存账号级偏好时同理。
 */
export function resolveThemeChoice(stored, explicit = false) {
  const v = pick(stored);
  const known = THEMES.some((t) => t.id === v);
  const marked = explicit === true || explicit === "1" || explicit === 1;
  if (marked) return known ? v : DEFAULT_APPEARANCE.theme;
  if (!known || v === FALLBACK_THEME) return RANDOM_THEME;
  return v;
}

/** 是否为某个真实主题 id（不含 random） */
export function isRealTheme(id) {
  return REAL_THEME_IDS.includes(id);
}

/**
 * 从真实主题里均匀抽一个（v0.21.0）。exclude = 不参与抽取的 id（加载失败过的等）；
 * 全被排除时返回 FALLBACK_THEME。rand 可注入（测试用），缺省 Math.random。
 */
export function pickRandomTheme(exclude = [], rand = Math.random) {
  const pool = REAL_THEME_IDS.filter((id) => !exclude.includes(id));
  if (!pool.length) return FALLBACK_THEME;
  return pool[Math.min(pool.length - 1, Math.floor(rand() * pool.length))];
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
 *                 themeSet 没给时按 `${theme}_set` 推出（v0.21.0）
 *
 * v0.21.0：theme 经 resolveThemeChoice 迁移——没有显式标记且存的是 nebula / 缺省 / 非法时为 "random"。
 */
export function readAppearanceFromCookies(get, cookies = APPEARANCE_COOKIES) {
  const names = { ...APPEARANCE_COOKIES, ...(cookies || {}) };
  if (!cookies || !cookies.themeSet) names.themeSet = `${names.theme}_set`;
  const read = (key) => (typeof get === "function" ? decode(get(names[key]) ?? undefined) : undefined);
  return normalizeAppearance({
    theme: resolveThemeChoice(read("theme"), read("themeSet")),
    palette: read("palette"),
    scheme: read("scheme"),
    cursor: read("cursor")
  });
}

/**
 * 要写到 <html> 上的属性。palette 为 "default" 时不写 data-palette（对齐 tokens.css 的缺省块）；
 * cursor 为 "default" 时不写 data-cursor。
 * v0.21.0：theme 为 "random" 时服务端不知道客户端会抽到哪个，**不写 data-theme**，只写 data-theme-mode="random"；
 * 背景由客户端 configureAppearance 抽定后挂上（配色 / 明暗与主题无关，首屏照常铺，不闪错色）。
 *
 *   <html lang="zh" {...appearanceAttrs(a)} suppressHydrationWarning>
 */
export function appearanceAttrs(a) {
  const n = normalizeAppearance(a);
  const attrs = n.theme === RANDOM_THEME ? { "data-theme-mode": RANDOM_THEME } : { "data-theme": n.theme };
  if (n.palette !== "default") attrs["data-palette"] = n.palette;
  attrs["data-scheme"] = n.scheme;
  if (n.cursor !== "default") attrs["data-cursor"] = n.cursor;
  return attrs;
}

/**
 * 按前缀生成各项存储键：appearanceCookieNames("fl_") →
 * { theme: "fl_theme", palette: "fl_palette", scheme: "fl_scheme", cursor: "fl_cursor", themeSet: "fl_theme_set" }。
 * 服务端 readAppearanceFromCookies 与客户端 mountAppearance({ cookiePrefix }) 用同一个前缀就不会对不上。
 */
export function appearanceCookieNames(prefix = "") {
  return {
    theme: `${prefix}${APPEARANCE_COOKIES.theme}`,
    palette: `${prefix}${APPEARANCE_COOKIES.palette}`,
    scheme: `${prefix}${APPEARANCE_COOKIES.scheme}`,
    cursor: `${prefix}${APPEARANCE_COOKIES.cursor}`,
    themeSet: `${prefix}${APPEARANCE_COOKIES.themeSet}`
  };
}
