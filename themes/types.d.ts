/* 背景主题模块的公共类型（v0.19.0）。每个 themes/<id>.js 导出 meta + mount，形状见下。 */

export type ThemeLocale = "zh" | "ja" | "en";
export type ThemeLabels = Partial<Record<ThemeLocale, string>> & { zh: string };

interface ParamBase {
  key: string;
  labels: ThemeLabels;
  /** 控件下方的说明行 */
  hints?: ThemeLabels;
  /** 只在另一参数等于某值时显示（如 nebula 的 bulgeStrength 只在 bulgeOnly 开时显示） */
  visibleWhen?: { key: string; equals: unknown } | { key: string; notEquals: unknown };
}

export interface RangeParam extends ParamBase {
  type: "range";
  min: number;
  max: number;
  step: number;
  default: number;
}

export interface ToggleParam extends ParamBase {
  type: "toggle";
  default: boolean;
}

export interface SelectParam extends ParamBase {
  type: "select";
  default: string;
  options: { value: string; labels: ThemeLabels }[];
}

/** 从哪个 CSS token 取色（值是 token 名，如 "--accent"）；颜色永远来自 token，不暴露自由取色 */
export interface TokenParam extends ParamBase {
  type: "token";
  default: string;
  options: { value: string; labels: ThemeLabels }[];
}

/**
 * 直接改写一个颜色 token（写成 <html> 行内 token，切走主题时撤掉）。
 * 只给沿用旧「背景参数」取色的 nebula 用（兼容 szyyw:dotfield 里存过的颜色）；新主题用 token 类型。
 * default 恒为 null = 跟随主题 / 配色 / 明暗。
 */
export interface ColorParam extends ParamBase {
  type: "color";
  token: string;
  /** 是否带透明度滑杆 */
  alpha?: boolean;
  default: null;
}

export type ThemeParam = RangeParam | ToggleParam | SelectParam | TokenParam | ColorParam;

export interface ThemeMeta {
  /** 与 html[data-theme] 同值 */
  id: string;
  labels: ThemeLabels;
  params: ThemeParam[];
}

export type ThemeParams = Record<string, number | boolean | string | null>;

export interface ThemeContext {
  /** 当前是否偏好减少动效（每次调用实时读） */
  reducedMotion(): boolean;
  /** 当前是否精确指针（pointer: fine）；指针交互只在 true 时启用 */
  finePointer(): boolean;
  /**
   * 读解析后的 CSS 颜色 token（light-dark / color-mix 已求值）→ [r, g, b, a]，
   * r/g/b 为 0–255，a 为 0–1；取不到返回 [0, 0, 0, 0]
   */
  color(token: string): [number, number, number, number];
  /** 主题 / 配色 / 明暗 / 行内 token 变化时回调（同一帧合并一次），返回退订函数 */
  onColorsChange(cb: () => void): () => void;
  /** 用户动过的参数（其余是缺省值）。nebula 用它保持「没调过的跟主题旋钮走」 */
  overrides: ThemeParams;
}

export interface ThemeUpdateInfo {
  /** 本次变化的键 */
  changed: string[];
  /** 当前用户动过的参数 */
  overrides: ThemeParams;
}

export interface ThemeInstance {
  /** 参数变化：能热更新就热更新，必要时内部重建 */
  update(params: ThemeParams, info?: ThemeUpdateInfo): void;
  /** 可选：「恢复缺省」时调用（不实现则以缺省值调 update） */
  reset?(params: ThemeParams): void;
  /** 移除 canvas / 监听 / rAF，恢复容器 */
  destroy(): void;
}

export interface ThemeModule {
  meta: ThemeMeta;
  mount(container: HTMLElement, params: ThemeParams, ctx: ThemeContext): ThemeInstance;
}
