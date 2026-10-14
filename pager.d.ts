export type PagerLocale = "zh" | "ja" | "en";
export type PagerChangeReason = "page" | "size" | "jump" | "key";

export interface PagerLabels {
  total: (n: string) => string;
  range: (a: string, b: string) => string;
  size: (n: number) => string;
  sizeLabel: string;
  first: string;
  prev: string;
  next: string;
  last: string;
  page: (n: number) => string;
  jump: string;
  jumpUnit: string;
  jumpLabel: string;
  nav: string;
  empty: string;
}

export interface PagerOptions {
  /** 总条数（≥0） */
  total: number;
  /** 从 1 开始；缺省 1，越界自动夹到 [1, 末页] */
  page?: number;
  /** 缺省 50 */
  pageSize?: number;
  /** 每页条数下拉的选项；缺省 [20, 50, 100, 200]；[] = 不显示 */
  pageSizes?: number[];
  /** 当前页两侧各显示几个页码，缺省 1 */
  siblings?: number;
  /** 首尾各固定显示几个页码，缺省 1 */
  boundaries?: number;
  /** 跳页输入框，缺省 true（只有 1 页时不显示） */
  jump?: boolean;
  /** 「共 N 条 · 第 a–b 条」，缺省 true */
  summary?: boolean;
  /** 焦点在分页器内时 ← → 翻页，缺省 true */
  keyboard?: boolean;
  /** 缺省 "zh" */
  locale?: PagerLocale;
  labels?: Partial<PagerLabels>;
  /** 只在用户操作时调用；update() 不触发 */
  onChange?: (state: { page: number; pageSize: number; reason: PagerChangeReason }) => void;
}

export interface PagerHandle {
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  /** 改数据后重绘，不触发 onChange */
  update(next: Partial<Pick<PagerOptions, "total" | "page" | "pageSize" | "pageSizes">>): void;
  /** 取数期间禁用全部控件 */
  setBusy(busy: boolean): void;
  destroy(): void;
}

/** 页码序列（数字与 "gap" 省略号）；纯函数 */
export function pageItems(page: number, last: number, siblings?: number, boundaries?: number): Array<number | "gap">;

export function mountPager(el: HTMLElement, options: PagerOptions): PagerHandle;
