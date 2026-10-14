import type { DotFieldHandle } from "./dotfield";
import type { DotFieldSettings, UpdateConfig } from "./settings";
import type { Appearance, NormalizedAppearance, PaletteId, ThemeId, ThemeChoice, CursorId, Scheme } from "./appearance-data";
import type { DotFieldControlLabels } from "./appearance-text";
import type { ThemeBackgroundHandle } from "./theme-background";
import type { ThemeParams } from "./themes/types";

export type { Appearance, NormalizedAppearance, PaletteId, ThemeId, ThemeChoice, CursorId, Scheme };

/** 随机主题的轮换周期（v0.21.0）："day"（缺省，本地 0 点换日）/ "week"（本地周一换周）/ 毫秒数 */
export type RandomEvery = "day" | "week" | number;

/** getAppearance 的返回值（v0.21.0）：theme 是选择（可为 "random"），resolvedTheme 是实际挂着的主题 */
export type CurrentAppearance = NormalizedAppearance & { resolvedTheme: ThemeId | null };

/** onChange 的 changed 项；"themeParams"（v0.19.0）= 当前主题参数被改动（去抖 600ms） */
export type AppearanceKey = keyof Appearance | "themeParams";

/** onChange 收到的外观对象：四项外观 +（有背景时）当前主题动过的参数（v0.19.0） */
export type AppearanceChange = CurrentAppearance & { themeParams?: ThemeParams };

export interface AppearanceConfig {
  /** 主题 / 配色 / 鼠标效果的持久化方式（明暗走 configureScheme）。SSR 项目用 cookie；缺省 cookie */
  persist?: "cookie" | "localStorage" | "none";
  /** 存储键名；缺省 { theme: "theme", palette: "palette", cursor: "cursor" }；themeSet（v0.21.0）缺省 `${theme}_set` */
  storageKeys?: { theme?: string; palette?: string; cursor?: string; themeSet?: string };
  cookieDays?: number;
  /** v0.21.0：随机主题轮换周期，缺省 "day"。抽中的主题存在 localStorage 的 `${theme}_random` */
  randomEvery?: RandomEvery;
}

/** dotField 选项包：主题参数段（v0.19.0 起对所有主题生效）与版本行 */
export interface ThemeParamsOptions {
  persist?: "localStorage" | "none";
  /** nebula 的存储键，缺省 "szyyw:dotfield" */
  storageKey?: string;
  /** v0.19.0：其余主题的存储键前缀，缺省 "szyyw:theme-params:" */
  storagePrefix?: string;
  /**
   * 传了才显示「保存」按钮。values = 当前主题动过的参数（nebula 时与旧版相同）；
   * info（v0.19.0）= { theme, params: values, all: 各主题动过的参数 }
   */
  onSave?: (
    values: DotFieldSettings & ThemeParams,
    info: { theme: ThemeId | null; params: ThemeParams; all: Partial<Record<ThemeId, ThemeParams>> }
  ) => void | Promise<void>;
  /** 没有 onSave 时的页脚说明；true = 内置文案（v0.14.0，「仅保存在本浏览器」，随 locale） */
  note?: string | true;
  update?: false | UpdateConfig;
}

export interface CursorEffectOptions {
  /** 加载 Target Cursor 模块；缺省 () => import("./target-cursor.js") */
  load?: () => Promise<{ mountTargetCursor(options?: Record<string, unknown>): { destroy(): void } }>;
  /** 原样传给 mountTargetCursor(options) */
  options?: Record<string, unknown>;
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
  | "theme" | "palette" | "scheme" | "background" | "localOnly"
  | "themeParams" | "cursor" | "unavailable" | "loading" | "themeFailed" | "cursorFailed" | "noParams"
  | "randomNow";

export type AppearancePanelLabels = Partial<Record<PanelTextKey, string>> & {
  /** 每个主题的名字（主题 > 1 个时才显示主题行；缺省显示 id） */
  themes?: Partial<Record<ThemeId | (string & {}), string>>;
  /** 每个配色的名字（v0.12.0 起按 locale 内置，这里只覆盖） */
  palettes?: Partial<Record<PaletteId | (string & {}), string>>;
  /** 明暗名（按 locale 内置，这里只覆盖） */
  schemes?: Partial<Record<Scheme, string>>;
  /** 鼠标效果名（v0.19.0，按 locale 内置，这里只覆盖） */
  cursors?: Partial<Record<CursorId, string>>;
  /** 主题参数控件名覆盖：键 = 参数 key（说明行用 `${key}Hint`）；缺省用主题 meta 里的多语言名 */
  controls?: DotFieldControlLabels & Record<string, string>;
  /** 弹层标题（等同 title 参数） */
  title?: string;
};

/** 读 <html> 当前外观（SSR 渲染的属性是真相）；v0.21.0 多 resolvedTheme */
export function getAppearance(): CurrentAppearance;

/**
 * v0.21.0：随机模式下把 failedId 排除并重抽（全失败回退 nebula），写进 data-theme；不在随机模式返回 null。
 * 外观弹层挂着时自动处理；只用 mountThemeBackground 时可在 status === "failed" 事件里调
 */
export function rerollRandomTheme(failedId?: string | null): ThemeId | null;

/** v0.21.0：上次抽取时间 at 到 now 是否已进入新的时间段 */
export function randomPeriodExpired(at: number, now?: number, every?: RandomEvery): boolean;

/**
 * 改外观：主题 / 配色写 <html> 并按 configureAppearance 持久化，明暗转交 setScheme；
 * 重算 theme-color；有变化才广播一次 "szyyw:appearancechange"。persist: false 只改界面不落盘
 */
export function setAppearance(patch: Partial<Appearance>, options?: { persist?: boolean }): CurrentAppearance;

/** 订阅外观变化（含 🌗 改明暗，changed = ["scheme"]），返回解绑函数 */
export function onAppearanceChange(handler: (appearance: CurrentAppearance, changed: (keyof Appearance)[]) => void): () => void;

/**
 * 配置主题 / 配色持久化并对齐初始状态（与 configureScheme 同构）。
 * <html> 已有合法属性的项不覆盖（SSR / 内联脚本）；没有的从存储恢复。返回当前外观
 */
export function configureAppearance(options?: AppearanceConfig): CurrentAppearance;

/** 鼠标效果的加载器与选项（v0.19.0）；改完立即按当前 data-cursor 生效 */
export function configureCursorEffect(options?: CursorEffectOptions): void;

/** 鼠标效果状态："off" | "loading" | "active" | "failed"（v0.19.0） */
export function getCursorEffectStatus(): "off" | "loading" | "active" | "failed";

/** 让 data-cursor 生效（外观弹层挂载时自动调；只靠 SSR 属性、不挂弹层时手动调）。返回释放函数（v0.19.0） */
export function mountCursorEffect(): () => void;

/**
 * 统一「外观」弹层：调色板按钮进右上角工具位（缺省 order 20）。
 * 面板：（给了 background）主题 → 配色 → 明暗 →（pointer: fine）鼠标效果 →（给了 background / field）折叠「主题参数」
 * →（dotField.update !== false）版本行。与 mountDotFieldSettings 二选一（同一枚按钮、同一个 order、同一份存储）。
 */
export function mountAppearancePanel(options?: {
  /** v0.19.0：mountThemeBackground() 的句柄；给了才有主题行，主题参数段跟随当前主题 */
  background?: ThemeBackgroundHandle | null;
  /** 旧写法：DotField 句柄（只有 nebula 的参数段、没有主题行）。与 background 二选一 */
  field?: DotFieldHandle | null;
  /** v0.19.0：鼠标效果行（只在 pointer: fine 下显示）；false = 不显示。缺省 true */
  cursor?: boolean;
  /** 弹层标题，缺省按 locale（「外观」/「外観」/「Appearance」） */
  title?: string;
  /** v0.12.0：内置文案语言 "zh" | "ja" | "en"，缺省 "zh"；labels 逐键覆盖 */
  locale?: string;
  /** 越大越靠右；缺省 20（明暗切换是 10） */
  order?: number;
  /** 任何来源的外观变化（面板 / 🌗 / setAppearance）都会调；应用在这里存账号级偏好，抛错不打断界面 */
  onChange?: (appearance: AppearanceChange, changed: AppearanceKey[]) => void | Promise<unknown>;
  /** 背景参数段与版本行（与 mountDotFieldSettings 同名同义） */
  dotField?: ThemeParamsOptions;
  labels?: AppearancePanelLabels;
}): AppearancePanelHandle;

/** 打开最近一次 mountAppearancePanel 挂出的面板；没挂过返回 false（no-op） */
export function openAppearancePanel(): boolean;

export interface AppearanceHandle {
  /** v0.19.0：主题背景句柄；没给 background 时为 null */
  background: ThemeBackgroundHandle | null;
  /** 兼容旧代码：当前主题是 nebula 时为底层 DotField 句柄，其余主题 / 没背景时为 null */
  readonly field: DotFieldHandle | null;
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
  /** 背景容器（通常是 .bg-layer）；不给就没有背景、主题行与主题参数段 */
  background?: HTMLElement | null;
  /** v0.19.0：鼠标效果的加载器与选项（同 configureCursorEffect） */
  cursorEffect?: CursorEffectOptions | null;
  /** 顺带挂 .spot 光斑跟踪；缺省 true（只在给了 background 时） */
  spot?: boolean;
  /** 主题 / 配色 / 明暗的持久化；SSR 项目用 cookie（缺省） */
  persist?: "cookie" | "localStorage" | "none";
  /** 存储键前缀："fl_" → fl_theme / fl_palette / fl_scheme / fl_cursor / fl_theme_set（+ localStorage fl_theme_random）；缺省无前缀 */
  cookiePrefix?: string;
  /** v0.21.0：随机主题轮换周期，缺省 "day" */
  randomEvery?: RandomEvery;
  /** "zh" | "ja" | "en"，缺省 "zh" */
  locale?: string;
  labels?: AppearancePanelLabels;
  /** 任何来源的外观变化都会调；应用在这里存账号级偏好 */
  onChange?: (appearance: AppearanceChange, changed: AppearanceKey[]) => void | Promise<unknown>;
  /** 背景参数段与版本行（同 mountAppearancePanel） */
  dotField?: ThemeParamsOptions;
}): AppearanceHandle;
