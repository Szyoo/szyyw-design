import type { AppearanceHandle, AppearancePanelLabels, AppearanceChange, AppearanceKey, ThemeParamsOptions, CursorEffectOptions, RandomEvery } from "./appearance";
import type { AppSwitcherHandle, SwitcherText } from "./switcher";
import type { AccountMenuHandle, PortalLoginMessage } from "./account";
import type { AccountLabels } from "./chrome-text";
import type { LocaleToggleHandle } from "./locale-toggle";
import type { TechTextHandle, TechTextOptions } from "./techtext";

export interface ChromeHandle {
  appearance: AppearanceHandle;
  /** portal 为 null / false 或 switcher: false 时为 null */
  switcher: AppSwitcherHandle | null;
  /** portal 为 null / false 或 account: false 时为 null */
  account: AccountMenuHandle | null;
  /** 没给 localeToggle.locales 时为 null */
  localeToggle: LocaleToggleHandle | null;
  /** techText 选项增强出的、当前仍在文档里的字标（没开时为空数组）；之后插入 / 移除的标题会自动增减（v0.18.0）；destroy() 一并销毁 */
  techText: TechTextHandle[];
  /** 当前语言 */
  readonly locale: string;
  /** 同步所有子件的文案（外观 / 🌗 / 切换器 / 账户菜单 / 语言按钮）；背景画布不重建 */
  setLocale(locale: string): void;
  destroy(): void;
}

/**
 * v0.13.0 一站式工具位（新项目首选）：mountAppearance +（SSO 站点）mountAppSwitcher + mountAccountMenu
 * +（给了 localeToggle.locales）mountLocaleToggle，同一个 locale。
 * 用户在语言按钮里选了新语言：先 handle.setLocale(新语言)，再调 localeToggle.onChange（应用换自己的文案 / 存偏好）。
 */
export function mountChrome(options?: {
  /** 背景容器（通常 .bg-layer）；不给就没有背景、主题行与主题参数段 */
  background?: HTMLElement | null;
  /** 外观存储键前缀："fl_" → fl_theme / fl_palette / fl_scheme / fl_cursor（服务端用 appearanceCookieNames 读同一组） */
  cookiePrefix?: string;
  /** 外观持久化；SSR 项目用 cookie（缺省） */
  persist?: "cookie" | "localStorage" | "none";
  /** "zh" | "ja" | "en"，缺省 "zh" */
  locale?: string;
  /** 门户地址，缺省 https://szyyw.xyz；null / false = 非 SSO 应用，不挂切换器与账户菜单 */
  portal?: string | null | false;
  /** 透传给 mountAppearance 的其余选项 */
  appearance?: {
    spot?: boolean;
    labels?: AppearancePanelLabels;
    onChange?: (appearance: AppearanceChange, changed: AppearanceKey[]) => void | Promise<unknown>;
    /** 主题参数段与版本行（v0.19.0 起对所有主题生效） */
    dotField?: ThemeParamsOptions;
    /** v0.19.0：鼠标效果的加载器与选项 */
    cursorEffect?: CursorEffectOptions | null;
    /** v0.21.0：随机主题轮换周期（"day" 缺省 / "week" / 毫秒数） */
    randomEvery?: RandomEvery;
  };
  /** 透传给 mountAppSwitcher；false = 不挂 */
  switcher?: false | { endpoint?: string; order?: number; current?: string; cacheMs?: number; labels?: Partial<SwitcherText> };
  /** 透传给 mountAccountMenu；false = 不挂 */
  account?: false | { order?: number; onChange?: (data: PortalLoginMessage) => void; labels?: AccountLabels };
  /** 给了 locales 才挂语言切换 */
  localeToggle?: {
    locales: string[];
    /** 选中新语言后调用（此时工具位各部件已换好文案） */
    onChange?: (locale: string) => void;
    order?: number;
    labels?: { title?: string; names?: Record<string, string>; short?: Record<string, string> };
  } | null;
  /**
   * 标题的 TechText 字标。v0.18.0 起缺省开启，选择器 ".app-title, .wordmark"；
   * 会跟进 mountChrome 之后才插入的匹配元素（MutationObserver），元素移出文档时销毁其 handle。
   * false = 不开；true = 缺省选择器；字符串 = 选择器；对象 = { selector?, ...TechTextOptions }
   */
  techText?: boolean | string | (TechTextOptions & { selector?: string });
}): ChromeHandle;
