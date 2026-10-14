/* themes/_gl.js 的类型（WebGL 背景主题共用的内部工具；主题模块接口的类型也放这里供三个主题引用） */

export type Labels = { zh: string; ja: string; en: string };

export type ThemeParamDef =
  | { key: string; type: "range"; min: number; max: number; step: number; default: number; labels: Labels }
  | { key: string; type: "toggle"; default: boolean; labels: Labels }
  | { key: string; type: "select"; default: string; options: { value: string; labels: Labels }[]; labels: Labels }
  /** 颜色参数：值是 CSS 自定义属性名（如 "--accent"），颜色随主题 / 配色 / 明暗即时变化 */
  | { key: string; type: "token"; default: string; options: { value: string; labels: Labels }[]; labels: Labels };

export interface ThemeMeta {
  id: string;
  labels: Labels;
  params: ThemeParamDef[];
}

export interface ThemeContext {
  reducedMotion(): boolean;
  /** 解析后的 token 颜色：[r, g, b, a]，r/g/b 0–255、a 0–1 */
  color(token: string): [number, number, number, number] | number[];
  /** 主题 / 配色 / 明暗变化时回调；返回取消订阅 */
  onColorsChange(cb: () => void): () => void;
}

export interface ThemeHandle {
  /** 参数热更新（只传变化的键也可以）；antialias 等需要重建上下文的键内部自动重建 */
  update(params: Record<string, unknown>): void;
  /** 移除 canvas / 监听 / rAF，恢复 container */
  destroy(): void;
  /** 是否真的跑在 WebGL 上；false = 不可用，container 已留纯色底（var(--bg)），由框架决定回退 */
  readonly webgl: boolean;
}

/** 单独挂载 / 手测时的缺省 ctx（读 CSS token、监听 <html> 属性与系统明暗） */
export function defaultThemeContext(): ThemeContext;
/** token → [r,g,b,a]，全部归一到 0–1 */
export function tokenColor(ctx: ThemeContext, name: string): [number, number, number, number];
/** 每个 WebGL 主题都带的性能参数：fps（缺省 30）、maxDpr（缺省 1.5） */
export const PERF_PARAMS: ThemeParamDef[];
export function tokenOptions(own: [string, string, string, string][]): { value: string; labels: Labels }[];
export function withDefaults(meta: ThemeMeta, params?: Record<string, unknown>): Record<string, unknown>;
export function fallbackHandle(container: HTMLElement): ThemeHandle;
export function finePointer(): boolean;
