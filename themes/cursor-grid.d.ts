import type { ThemeMeta, ThemeParams, ThemeContext, ThemeInstance } from "./types";

/** 背景主题 cursor-grid（v0.19.0）。参数表见 meta.params；颜色参数是 token 名 */
export const meta: ThemeMeta & { id: "cursor-grid" };

export function mount(container: HTMLElement, params?: ThemeParams, ctx?: Partial<ThemeContext>): ThemeInstance;
