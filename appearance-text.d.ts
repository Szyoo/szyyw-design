export type AppearanceLocale = "zh" | "ja" | "en";

/** 背景参数控件名；键是 DotField 参数名，开关的说明行用 `${key}Hint` */
export type DotFieldControlLabels = Partial<Record<
  | "dotRadius" | "dotSpacing" | "cursorRadius" | "cursorForce" | "bulgeStrength" | "glowRadius" | "waveAmplitude"
  | "bulgeOnly" | "bulgeOnlyHint" | "sparkle" | "gradientFrom" | "gradientTo" | "glowColor",
  string
>>;

export interface AppearanceText {
  title: string;
  open: string;
  close: string; reset: string; save: string; saving: string; saved: string; error: string;
  version: string; check: string; checking: string; upToDate: string; updateAvailable: string; viewChanges: string;
  copyCommand: string; copied: string; updateNow: string; updating: string; updated: string; updateFailed: string; checkFailed: string;
  theme: string; palette: string; scheme: string; background: string;
  themes: Record<string, string>;
  palettes: Record<string, string>;
  schemes: Record<"auto" | "dark" | "light", string>;
  controls: Required<DotFieldControlLabels>;
}

export const APPEARANCE_LOCALES: readonly AppearanceLocale[];
/** 内置文案表（只读参考；改词用各 mount 函数的 labels） */
export const APPEARANCE_TEXT: Readonly<Record<AppearanceLocale, AppearanceText>>;

/** 某语言的全套文案（"ja-JP" 也认；不认识回退中文；缺键按中文补齐），再叠 overrides */
export function appearanceText(locale?: string | null, overrides?: Partial<AppearanceText> | Record<string, unknown>): AppearanceText;
