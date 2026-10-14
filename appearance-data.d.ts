import type { Scheme } from "./scheme";

export type { Scheme };

/** 真实主题 id（v0.19.0 起可插拔，登记见 themes/index.js） */
export type ThemeId = "nebula" | "cursor-grid" | "gradient-waves" | "side-rays" | "pixel-blast" | "particles";
/** 主题选择（v0.21.0）：真实主题或 "random"（缺省，按时间段轮换）。未知 id 回退 "random" */
export type ThemeChoice = ThemeId | "random";
/** 配色 id。"default" 对应 tokens.css 的 :root 基础块；v0.21.0 移除 "aurora"（存着它的回退 default） */
export type PaletteId = "default";
/** 鼠标效果（v0.19.0）。"default" = 系统指针；"target" = Target Cursor（只在 pointer: fine 下生效） */
export type CursorId = "default" | "target";

export interface Appearance {
  /** v0.21.0 起可为 "random"（缺省） */
  theme: ThemeChoice;
  palette: PaletteId;
  scheme: Scheme;
  /** v0.19.0。normalizeAppearance / getAppearance 的返回值总带它；旧代码自己拼的三元组可以不带 */
  cursor?: CursorId;
}

/** 归一化后的外观：四项都在 */
export type NormalizedAppearance = Required<Appearance>;

export interface ThemeDef {
  readonly id: ThemeChoice;
  /** v0.21.0：「随机」选项为 true（THEMES 第一项），真实主题没有这个字段 */
  readonly random?: true;
}

export interface PaletteDef {
  readonly id: PaletteId;
  /** 来源主题（v0.19.0 起配色对所有主题通用，只作标注） */
  readonly theme: ThemeId;
  /** 该配色 --bg 的 light-dark() 两套值（与 tokens.css 一致，由 scripts/check-tokens.mjs 保证） */
  readonly bg: { readonly dark: string; readonly light: string };
}

/** 存储键名（cookie / localStorage 共用） */
export interface AppearanceCookieNames {
  theme: string;
  palette: string;
  scheme: string;
  /** v0.19.0 */
  cursor: string;
  /** v0.21.0：主题「显式选择」标记键（值 "1"）；缺省 `${theme}_set` */
  themeSet: string;
}

/** v0.21.0 起第一项为 { id: "random", random: true }，其余为真实主题 */
export const THEMES: readonly ThemeDef[];
/** v0.21.0："random" */
export const RANDOM_THEME: "random";
/** v0.21.0：真实主题 id（与注册表同序） */
export const REAL_THEME_IDS: readonly ThemeId[];
/** v0.21.0：无从抽取时的回退主题 "nebula" */
export const FALLBACK_THEME: "nebula";
/**
 * v0.21.0 迁移规则：存储值 + 显式标记 → 主题选择。有标记按存储值；
 * 没标记时 nebula / 缺省 / 非法 → "random"，其余真实主题与 random 保持
 */
export function resolveThemeChoice(stored: string | null | undefined, explicit?: boolean | string | number | null): ThemeChoice;
/** v0.21.0：是否真实主题 id */
export function isRealTheme(id: unknown): id is ThemeId;
/** v0.21.0：从真实主题里均匀抽一个（排除 exclude；全排除返回 nebula） */
export function pickRandomTheme(exclude?: readonly string[], rand?: () => number): ThemeId;
export const PALETTES: readonly PaletteDef[];
/** 面板展示顺序：auto / dark / light */
export const SCHEMES: readonly Scheme[];
/** v0.19.0：["default", "target"] */
export const CURSORS: readonly CursorId[];
export const DEFAULT_APPEARANCE: Readonly<NormalizedAppearance>;
/** 缺省键名 { theme: "theme", palette: "palette", scheme: "scheme", cursor: "cursor", themeSet: "theme_set" } */
export const APPEARANCE_COOKIES: Readonly<AppearanceCookieNames>;

/** 按前缀生成各项存储键：appearanceCookieNames("fl_") → { theme: "fl_theme", …, cursor: "fl_cursor", themeSet: "fl_theme_set" } */
export function appearanceCookieNames(prefix?: string): AppearanceCookieNames;

/** 任意输入 → 合法外观（非法 / 缺省回退到 DEFAULT_APPEARANCE；未知主题回退 random，未知配色回退 default）。不做迁移 */
export function normalizeAppearance(raw?: {
  theme?: string | null;
  palette?: string | null;
  scheme?: string | null;
  cursor?: string | null;
} | null): NormalizedAppearance;

/** palette × scheme → 浏览器 chrome 底色；auto 返回 { dark, light } */
export function themeColorFor(palette: string, scheme: "dark" | "light"): string;
export function themeColorFor(palette: string, scheme: "auto"): { dark: string; light: string };
export function themeColorFor(palette: string, scheme: string): string | { dark: string; light: string };

/** 服务端从 cookie 读外观（SSR 首屏不闪的唯一正确读法）；只给三项键名的旧写法照旧可用。v0.21.0 起 theme 按 resolveThemeChoice 迁移 */
export function readAppearanceFromCookies(
  get: (name: string) => string | undefined | null,
  cookies?: Partial<AppearanceCookieNames>
): NormalizedAppearance;

/**
 * 要写到 <html> 上的属性；palette 为 default 时不写 data-palette，cursor 为 default 时不写 data-cursor。
 * v0.21.0：theme 为 random 时不写 data-theme、写 data-theme-mode="random"（客户端抽定后补 data-theme）
 */
export function appearanceAttrs(a: Partial<Appearance> | null | undefined): {
  "data-theme"?: string;
  "data-theme-mode"?: "random";
  "data-palette"?: string;
  "data-scheme": string;
  "data-cursor"?: string;
};
