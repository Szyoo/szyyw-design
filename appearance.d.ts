import type { DotFieldHandle } from "./dotfield";
import type { DotFieldSettings, UpdateConfig } from "./settings";
import type { Appearance, PaletteId, ThemeId, Scheme } from "./appearance-data";
import type { DotFieldControlLabels } from "./appearance-text";

export type { Appearance, PaletteId, ThemeId, Scheme };

export type AppearanceKey = keyof Appearance;

export interface AppearanceConfig {
  /** 主题 / 配色的持久化方式（明暗走 configureScheme）。SSR 项目用 cookie；缺省 cookie */
  persist?: "cookie" | "localStorage" | "none";
  /** 存储键名；缺省 { theme: "theme", palette: "palette" } */
  storageKeys?: { theme?: string; palette?: string };
  cookieDays?: number;
}

export interface AppearancePanelHandle {
  open(): void;
  close(): void;
  /** 外部改了外观 / 背景参数后让面板跟上 */
  sync(): void;
  /** 手动触发一次强制检查（绕过缓存）；update: false 时是 no-op */
  checkUpdate(): Promise<void> | undefined;
  destroy(): void;
}

type PanelTextKey =
  | "open" | "close" | "reset" | "save" | "saving" | "saved" | "error"
  | "version" | "check" | "checking" | "upToDate" | "updateAvailable" | "viewChanges"
  | "copyCommand" | "copied" | "updateNow" | "updating" | "updated" | "updateFailed" | "checkFailed"
  | "theme" | "palette" | "scheme" | "background";

export type AppearancePanelLabels = Partial<Record<PanelTextKey, string>> & {
  /** 每个主题的名字（主题 > 1 个时才显示主题行；缺省显示 id） */
  themes?: Partial<Record<ThemeId | (string & {}), string>>;
  /** 每个配色的名字（v0.12.0 起按 locale 内置，这里只覆盖） */
  palettes?: Partial<Record<PaletteId | (string & {}), string>>;
  /** 明暗名（按 locale 内置，这里只覆盖） */
  schemes?: Partial<Record<Scheme, string>>;
  /** 背景参数控件名（按 locale 内置，这里只覆盖） */
  controls?: DotFieldControlLabels;
  /** 弹层标题（等同 title 参数） */
  title?: string;
};

/** 读 <html> 当前外观（SSR 渲染的属性是真相） */
export function getAppearance(): Appearance;

/**
 * 改外观：主题 / 配色写 <html> 并按 configureAppearance 持久化，明暗转交 setScheme；
 * 重算 theme-color；有变化才广播一次 "szyyw:appearancechange"。persist: false 只改界面不落盘
 */
export function setAppearance(patch: Partial<Appearance>, options?: { persist?: boolean }): Appearance;

/** 订阅外观变化（含 🌗 改明暗，changed = ["scheme"]），返回解绑函数 */
export function onAppearanceChange(handler: (appearance: Appearance, changed: AppearanceKey[]) => void): () => void;

/**
 * 配置主题 / 配色持久化并对齐初始状态（与 configureScheme 同构）。
 * <html> 已有合法属性的项不覆盖（SSR / 内联脚本）；没有的从存储恢复。返回当前外观
 */
export function configureAppearance(options?: AppearanceConfig): Appearance;

/**
 * 统一「外观」弹层：调色板按钮进右上角工具位（缺省 order 20）。
 * 面板：配色 → 明暗 →（传了 field）折叠「背景参数」→（dotField.update !== false）版本行。
 * 与 mountDotFieldSettings 二选一（同一枚按钮、同一个 order、同一份存储）。
 */
export function mountAppearancePanel(options?: {
  /** 传了才有背景参数段 */
  field?: DotFieldHandle | null;
  /** 弹层标题，缺省按 locale（「外观」/「外観」/「Appearance」） */
  title?: string;
  /** v0.12.0：内置文案语言 "zh" | "ja" | "en"，缺省 "zh"；labels 逐键覆盖 */
  locale?: string;
  /** 越大越靠右；缺省 20（明暗切换是 10） */
  order?: number;
  /** 任何来源的外观变化（面板 / 🌗 / setAppearance）都会调；应用在这里存账号级偏好，抛错不打断界面 */
  onChange?: (appearance: Appearance, changed: AppearanceKey[]) => void | Promise<unknown>;
  /** 背景参数段与版本行（与 mountDotFieldSettings 同名同义） */
  dotField?: {
    persist?: "localStorage" | "none";
    storageKey?: string;
    onSave?: (values: DotFieldSettings) => void | Promise<void>;
    note?: string;
    update?: false | UpdateConfig;
  };
  labels?: AppearancePanelLabels;
}): AppearancePanelHandle;

/** 打开最近一次 mountAppearancePanel 挂出的面板；没挂过返回 false（no-op） */
export function openAppearancePanel(): boolean;

export interface AppearanceHandle {
  /** 给了 background 才有 */
  field: DotFieldHandle | null;
  /** 切语言：只重挂 🌗 按钮与弹层，背景画布不重建 */
  setLocale(locale: string): void;
  open(): void;
  close(): void;
  sync(): void;
  destroy(): void;
}

/**
 * 一站式接外观（v0.12.0）：configureScheme + configureAppearance +（给了 background）mountDotField / attachSpot
 * + mountSchemeToggle + mountAppearancePanel，同一个 locale、同一组存储键。
 * 服务端用同一个前缀：readAppearanceFromCookies(get, appearanceCookieNames(prefix))。
 */
export function mountAppearance(options?: {
  /** 点阵背景容器（通常是 .bg-layer）；不给就没有背景与背景参数段 */
  background?: HTMLElement | null;
  /** 顺带挂 .spot 光斑跟踪；缺省 true（只在给了 background 时） */
  spot?: boolean;
  /** 主题 / 配色 / 明暗的持久化；SSR 项目用 cookie（缺省） */
  persist?: "cookie" | "localStorage" | "none";
  /** 存储键前缀："fl_" → fl_theme / fl_palette / fl_scheme；缺省无前缀 */
  cookiePrefix?: string;
  /** "zh" | "ja" | "en"，缺省 "zh" */
  locale?: string;
  labels?: AppearancePanelLabels;
  /** 任何来源的外观变化都会调；应用在这里存账号级偏好 */
  onChange?: (appearance: Appearance, changed: AppearanceKey[]) => void | Promise<unknown>;
  /** 背景参数段与版本行（同 mountAppearancePanel） */
  dotField?: {
    persist?: "localStorage" | "none";
    storageKey?: string;
    onSave?: (values: DotFieldSettings) => void | Promise<void>;
    note?: string;
    update?: false | UpdateConfig;
  };
}): AppearanceHandle;
