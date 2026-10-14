export interface BranchedMenuItem {
  label: string;
  value: string;
  /** 内置图标名（ICONS 的键）、SVG 标记字符串（内部 path 标记或完整 <svg>），或 Node */
  icon?: string | Node;
}

export interface BranchedMenuSection {
  label: string;
  /** 没有 items 时，分组本身是一个单行叶子，选中值取 value（缺省 label） */
  value?: string;
  icon?: string | Node;
  items?: BranchedMenuItem[];
}

export interface BranchedMenuOptions {
  sections?: BranchedMenuSection[];
  /** 初始选中值（上游 defaultActive）；缺省 = 初始展开的第一个分组的第一项 */
  value?: string;
  /** 用户点选时回调（程序化 set 不触发） */
  onSelect?: (value: string, item: BranchedMenuItem | BranchedMenuSection) => void;
  /** 分组展开 / 收起时回调 */
  onToggle?: (index: number, open: boolean) => void;
  /** 初始展开的分组下标（数字或数组；-1 = 都不展开）；缺省 0 */
  defaultOpen?: number | number[];
  /** 文字色 / 强调色 / 线色：CSS 颜色或 token 引用（如 "var(--accent2)"）；缺省取 token */
  color?: string | null;
  accentColor?: string | null;
  lineColor?: string | null;
  /** 缺省 240 */
  width?: number;
  /** 缺省 36 */
  rowHeight?: number;
  /** 子项缩进（也是支线区宽度）；缺省 40 */
  indent?: number;
  /** 主干线离左缘；缺省 14 */
  trunk?: number;
  /** 支线圆角半径；缺省 10 */
  radius?: number;
  /** 缺省 1.5 */
  lineWidth?: number;
  /** 缺省 14 */
  fontSize?: number;
  /** 描线动画 ms；缺省 400 */
  drawDuration?: number;
  /** 折叠动画 ms；缺省 300 */
  foldDuration?: number;
  className?: string;
}

export interface BranchedMenuHandle {
  /** 程序化选中并展开所在分组；不触发 onSelect */
  set(value: string): void;
  /** 展开 / 收起第 index 个分组；省略 open 则翻转 */
  toggle(index: number, open?: boolean): void;
  /** 移除 DOM；重复调用无害 */
  destroy(): void;
}

/** 内置图标（Hugeicons 免费集，MIT）：install / rocket / settings / paint / pointer / font / layers / bell */
export const ICONS: Record<string, string>;
export const DEFAULTS: Required<Pick<BranchedMenuOptions, "defaultOpen" | "width" | "rowHeight" | "indent" | "trunk" | "radius" | "lineWidth" | "fontSize" | "drawDuration" | "foldDuration" | "className">> & BranchedMenuOptions;

/** v0.19.0：Branched Menu（备用组件；出处 React Bits，MIT + Commons Clause） */
export function mountBranchedMenu(container: Element, options?: BranchedMenuOptions): BranchedMenuHandle;
