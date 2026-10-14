import type { Scheme } from "./scheme";

export type { Scheme };

/** 主题 id（v0.19.0 起可插拔，登记见 themes/index.js）。未知 id 回退 "nebula" */
export type ThemeId = "nebula" | "cursor-grid" | "gradient-waves" | "side-rays" | "pixel-blast" | "particles";
/** 配色 id。"default" 对应 tokens.css 的 :root 基础块；v0.19.0 起任意主题通用 */
export type PaletteId = "default" | "aurora";
/** 鼠标效果（v0.19.0）。"default" = 系统指针；"target" = Target Cursor（只在 pointer: fine 下生效） */
export type CursorId = "default" | "target";

export interface Appearance {
  theme: ThemeId;
  palette: PaletteId;
  scheme: Scheme;
  /** v0.19.0。normalizeAppearance / getAppearance 的返回值总带它；旧代码自己拼的三元组可以不带 */
  cursor?: CursorId;
}

/** 归一化后的外观：四项都在 */
export type NormalizedAppearance = Required<Appearance>;

export interface ThemeDef {
  readonly id: ThemeId;
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
}

export const THEMES: readonly ThemeDef[];
export const PALETTES: readonly PaletteDef[];
/** 面板展示顺序：auto / dark / light */
export const SCHEMES: readonly Scheme[];
/** v0.19.0：["default", "target"] */
export const CURSORS: readonly CursorId[];
export const DEFAULT_APPEARANCE: Readonly<NormalizedAppearance>;
/** 缺省键名 { theme: "theme", palette: "palette", scheme: "scheme", cursor: "cursor" } */
export const APPEARANCE_COOKIES: Readonly<AppearanceCookieNames>;

/** 按前缀生成各项存储键：appearanceCookieNames("fl_") → { theme: "fl_theme", palette: "fl_palette", scheme: "fl_scheme", cursor: "fl_cursor" } */
export function appearanceCookieNames(prefix?: string): AppearanceCookieNames;

/** 任意输入 → 合法外观（非法 / 缺省回退到 DEFAULT_APPEARANCE；未知主题回退 nebula） */
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

/** 服务端从 cookie 读外观（SSR 首屏不闪的唯一正确读法）；只给三项键名的旧写法照旧可用 */
export function readAppearanceFromCookies(
  get: (name: string) => string | undefined | null,
  cookies?: Partial<AppearanceCookieNames>
): NormalizedAppearance;

/** 要写到 <html> 上的属性；palette 为 default 时不写 data-palette，cursor 为 default 时不写 data-cursor */
export function appearanceAttrs(a: Partial<Appearance> | null | undefined): {
  "data-theme": string;
  "data-palette"?: string;
  "data-scheme": string;
  "data-cursor"?: string;
};
