import type { ThemeLabels, ThemeModule } from "./types";
import type { ThemeId } from "../appearance-data";

export type {
  ThemeLocale, ThemeLabels, ThemeParam, RangeParam, ToggleParam, SelectParam, TokenParam, ColorParam,
  ThemeMeta, ThemeParams, ThemeContext, ThemeUpdateInfo, ThemeInstance, ThemeModule
} from "./types";

export interface ThemeEntry {
  readonly id: ThemeId;
  /** 未加载时列表显示用（与模块 meta.labels 一致） */
  readonly labels: Readonly<ThemeLabels>;
  readonly load: () => Promise<ThemeModule>;
}

/** 已登记的全部主题（顺序即外观弹层里的顺序） */
export const THEME_REGISTRY: readonly ThemeEntry[];

/** 按 id 取注册项；没有返回 null */
export function themeEntry(id: string): ThemeEntry | null;

/** 加载主题模块（同一 id 只加载一次；失败不缓存）。未登记 / 模块不合规时 reject */
export function loadTheme(id: string): Promise<ThemeModule>;

/** 多语言文案取一条："ja-JP" → ja；缺的语言按 zh → en → fallback */
export function pickLabel(labels: Partial<Record<string, string>> | null | undefined, locale?: string | null, fallback?: string): string;
