export type SortDirection = "ascending" | "descending";

export interface SortState {
  /** 列序号（th.cellIndex） */
  index: number;
  direction: SortDirection;
  th: HTMLTableCellElement;
}

export interface SortTableOptions {
  /** 是否由本模块重排 tbody 的行，缺省 true；React / Vue 管理的行、服务端排序时传 false，只用 onSort */
  sort?: boolean;
  /** 未排序的列第一次点按的方向，缺省 "ascending" */
  firstDirection?: SortDirection;
  /** 用户点按或调用 sortBy 后调用 */
  onSort?: (state: SortState) => void;
}

export interface SortTableHandle {
  /** 当前排序（初始化时读表头已有的 ascending / descending，没有为 null） */
  readonly state: SortState | null;
  /** 按某列排序（同点按，会触发 onSort） */
  sortBy(index: number, direction?: SortDirection): void;
  /** 撤监听（不还原行顺序与 aria-sort），重复调用无害 */
  destroy(): void;
}

/**
 * v0.30.0：可排序表头（`th[aria-sort] > button.th-sort`）。点按在升 / 降序间切换并同步各列 aria-sort；
 * 缺省按单元格的 data-sort 或文字重排 tbody（数字感知、空值垫底、稳定）。同一表格重复调用返回同一个 handle。
 */
export function enhanceSortTable(table: HTMLTableElement, options?: SortTableOptions): SortTableHandle;
