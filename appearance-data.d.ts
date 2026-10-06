import type { Scheme } from "./scheme";

export type { Scheme };

/** 主题 id。目前唯一 "nebula" */
export type ThemeId = "nebula";
/** 配色 id。"default" 对应 tokens.css 的 :root 基础块 */
export type PaletteId = "default" | "aurora";

export interface Appearance {
  theme: ThemeId;
  palette: PaletteId;
  scheme: Scheme;
}

export interface ThemeDef {
  readonly id: ThemeId;
}

export interface PaletteDef {
  readonly id: PaletteId;
  readonly theme: ThemeId;
  /** 该配色 --bg 的 light-dark() 两套值（与 tokens.css 一致，由 scripts/check-tokens.mjs 保证） */
  readonly bg: { readonly dark: string; readonly light: string };
}

/** 存储键名（cookie / localStorage 共用） */
export interface AppearanceCookieNames {
  theme: string;
  palette: string;
  scheme: string;
}

export const THEMES: readonly ThemeDef[];
export const PALETTES: readonly PaletteDef[];
/** 面板展示顺序：auto / dark / light */
export const SCHEMES: readonly Scheme[];
export const DEFAULT_APPEARANCE: Readonly<Appearance>;
/** 缺省键名 { theme: "theme", palette: "palette", scheme: "scheme" } */
export const APPEARANCE_COOKIES: Readonly<AppearanceCookieNames>;

/** 任意输入 → 合法三元组（非法 / 缺省回退到 DEFAULT_APPEARANCE） */
export function normalizeAppearance(raw?: {
  theme?: string | null;
  palette?: string | null;
  scheme?: string | null;
} | null): Appearance;

/** palette × scheme → 浏览器 chrome 底色；auto 返回 { dark, light } */
export function themeColorFor(palette: string, scheme: "dark" | "light"): string;
export function themeColorFor(palette: string, scheme: "auto"): { dark: string; light: string };
export function themeColorFor(palette: string, scheme: string): string | { dark: string; light: string };

/** 服务端从 cookie 读外观（SSR 首屏不闪的唯一正确读法） */
export function readAppearanceFromCookies(
  get: (name: string) => string | undefined | null,
  cookies?: Partial<AppearanceCookieNames>
): Appearance;

/** 要写到 <html> 上的属性；palette 为 default 时不写 data-palette */
export function appearanceAttrs(a: Partial<Appearance> | null | undefined): {
  "data-theme": string;
  "data-palette"?: string;
  "data-scheme": string;
};
