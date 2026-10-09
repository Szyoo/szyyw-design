export type ChromeLocale = "zh" | "ja" | "en";

/** 应用切换器文案 */
export interface SwitcherText {
  open: string; portal: string; loading: string; empty: string; unauth: string; error: string;
}

/** 账户菜单文案 */
export interface AccountText {
  login: string;
  settings: string;
  logout: string;
  /** 含占位 {status}：有 HTTP 状态码时换成 statusFmt，否则为空串 */
  logoutFailed: string;
  /** 含占位 {code}，如 "（{code}）" / " ({code})" */
  statusFmt: string;
  /** 角色显示名；表里没有的角色原样显示 */
  roles: Record<string, string>;
}

/** mountAccountMenu 的 labels：任意键可缺，roles 逐个合并 */
export type AccountLabels = Partial<Omit<AccountText, "roles">> & { roles?: Record<string, string> };

/** 语言切换文案；names / short 按语言代码索引，未登记的代码回退为代码本身 */
export interface LocaleToggleText {
  /** 按钮提示前缀与列表的无障碍名（「语言」/「言語」/「Language」） */
  title: string;
  /** 列表里的语言名（各用自己的写法：中文 / 日本語 / English） */
  names: Record<string, string>;
  /** 按钮上的短名（中 / 日 / EN） */
  short: Record<string, string>;
}

export interface ChromeText {
  switcher: SwitcherText;
  account: AccountText;
  locale: LocaleToggleText;
}

export interface ChromeTextOverrides {
  switcher?: Partial<SwitcherText>;
  account?: AccountLabels;
  locale?: Partial<Omit<LocaleToggleText, "names" | "short">> & { names?: Record<string, string>; short?: Record<string, string> };
}

export const CHROME_LOCALES: readonly ChromeLocale[];
/** 内置文案表（只读参考；改词用各 mount 函数的 labels） */
export const CHROME_TEXT: Readonly<Record<ChromeLocale, ChromeText>>;

/** "ja-JP" → "ja"；不认识的回退 "zh" */
export function chromeLocale(locale?: string | null): ChromeLocale;

/** 某语言的全套外壳文案（缺键按中文补齐），再逐段叠 overrides。零 DOM */
export function chromeText(locale?: string | null, overrides?: ChromeTextOverrides): ChromeText;

/** 角色显示名：表里有就用，未知角色原样返回 */
export function roleLabel(role: string | null | undefined, roles: Record<string, string>): string;
