export interface LocaleToggleHandle {
  /** 工具位按钮（.corner-tool.locale-toggle） */
  el: HTMLButtonElement;
  /** 当前选中的语言 */
  readonly current: string;
  /** 外部换了语言时同步显示（不触发 onChange）；不在 locales 里的值忽略 */
  set(locale: string): void;
  open(): void;
  close(): void;
  destroy(): void;
}

/**
 * v0.13.0：语言切换。工具位按钮显示当前语言短名（中 / 日 / EN），点开 .glass.corner-panel 列表，
 * claimCornerPanel 互斥、Esc / 点外面关闭。选中另一种语言时调 onChange（文案怎么换归应用）。
 */
export function mountLocaleToggle(options: {
  /** 可选语言代码，按此顺序列出，如 ["zh", "ja", "en"] */
  locales: string[];
  /** 当前语言；缺省 locales[0] */
  current?: string;
  /** 用户选了另一种语言时调用 */
  onChange?: (locale: string) => void;
  /** 工具位位次，缺省 15（明暗 10 与外观 20 之间） */
  order?: number;
  /**
   * 覆盖文案：title（「语言」/「言語」/「Language」，跟当前语言走）、
   * names（列表里的语言名，缺省各用自己的写法）、short（按钮短名，缺省 中 / 日 / EN；未登记的代码显示大写代码）
   */
  labels?: { title?: string; names?: Record<string, string>; short?: Record<string, string> };
}): LocaleToggleHandle;
