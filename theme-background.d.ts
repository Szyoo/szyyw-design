import type { ThemeMeta, ThemeParams, ThemeContext } from "./themes/types";
import type { ThemeId } from "./appearance-data";
import type { DotFieldHandle } from "./dotfield";

export type ThemeStatus = "idle" | "loading" | "ready" | "failed";

export type ThemeBackgroundEvent =
  | { type: "theme"; id: ThemeId }
  | { type: "status"; id: ThemeId; status: ThemeStatus }
  | { type: "params"; id: ThemeId; changed: string[]; reset?: boolean };

export interface ThemeStorageOptions {
  /** 参数持久化；缺省 "localStorage"（改完即存，只存动过的键） */
  persist?: "localStorage" | "none";
  /** nebula 的存储键，缺省 "szyyw:dotfield"（与旧背景参数面板 / restoreDotFieldSettings 同一份） */
  storageKey?: string;
  /** 其余主题的存储键前缀，缺省 "szyyw:theme-params:"（键 = 前缀 + 主题 id） */
  storagePrefix?: string;
}

export interface ThemeBackgroundHandle {
  /** 当前挂着的主题（加载中 / 失败时仍是上一个） */
  readonly theme: ThemeId | null;
  /** 最近一次请求的主题 */
  readonly requested: ThemeId | null;
  readonly meta: ThemeMeta | null;
  /** 最近一次切换；resolve 为是否挂上了所请求的主题 */
  readonly ready: Promise<boolean>;
  /** 当前是 nebula 时为底层 DotField 句柄（glow 切换 / 恢复缺省会重挂，请每次现取） */
  readonly field: DotFieldHandle | null;
  /** 能否切换主题（mountAppearancePanel 旧 field 写法的适配器为 false） */
  readonly switchable: boolean;
  status(id: string): ThemeStatus;
  /** 手动切换（缺省会跟随 html[data-theme]，一般用 setAppearance({ theme }) 即可） */
  setTheme(id: string): Promise<boolean>;
  /** 当前主题的完整参数（缺省值已合并；color 类未覆盖时为 null） */
  params(): ThemeParams;
  /** 某主题（缺省当前）被动过的参数 */
  overrides(id?: string): ThemeParams;
  /** 所有存过参数的主题 → 动过的参数 */
  allOverrides(): Partial<Record<ThemeId, ThemeParams>>;
  /** 改当前主题参数：校验 → 持久化 → 热更新。color 类传 null 撤销覆盖 */
  setParams(patch: ThemeParams): ThemeParams;
  /** 当前主题恢复缺省：清存储与行内 token，控制权交还主题 */
  resetParams(): ThemeParams;
  subscribe(fn: (ev: ThemeBackgroundEvent) => void): () => void;
  destroy(): void;
}

/**
 * 在背景容器（通常 .bg-layer）上挂当前主题（v0.19.0）。缺省跟随 html[data-theme]：
 * 切换时销毁旧背景、按需 import 新主题再挂上，不刷新页面；加载失败保留当前背景（首挂失败回退 nebula），不抛错。
 */
export function mountThemeBackground(
  container: HTMLElement,
  options?: ThemeStorageOptions & {
    /** 初始主题；缺省读 html[data-theme]（未知回退 nebula） */
    theme?: string | null;
    /** 跟随 html[data-theme] 变化自动切换；缺省 true */
    follow?: boolean;
  }
): ThemeBackgroundHandle;

/** 给主题模块的 ctx（自己调 themes/<id>.js 的 mount 时用） */
export function createThemeContext(overrides?: ThemeParams): ThemeContext;

/** 浏览器算好的颜色字符串（rgb() / color(srgb …) / #hex / 其它交给 canvas）→ [r, g, b, a]（0–255, 0–1）；失败 null */
export function parseCssColor(text: string | null | undefined): [number, number, number, number] | null;

/** 读解析后的颜色 token → [r, g, b, a]；取不到 [0, 0, 0, 0] */
export function tokenColor(name: string): [number, number, number, number];

/** meta.params → 缺省参数对象 */
export function themeDefaults(meta: ThemeMeta | null | undefined): ThemeParams;

/** 只留 meta 里登记过、取值合法的键（范围夹紧、选项校验） */
export function sanitizeThemeParams(meta: ThemeMeta | null | undefined, raw: unknown): ThemeParams;

/** 读某主题存过的参数（只含动过的键；未校验）。nebula 读 szyyw:dotfield */
export function readThemeParams(id: string, options?: Omit<ThemeStorageOptions, "persist">): ThemeParams;
