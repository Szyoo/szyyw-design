export type LatticeStatus = "working" | "done" | "error";
export type LatticePatternName = "arrow" | "dots" | "orbit" | "ripple" | "snake" | "spiral" | "sweep" | "spin" | "rain" | "pulse";
export interface LatticePattern {
  /** 各格点亮的先后单位（行优先，grid×grid 个），null = 空洞 */
  cells: (number | null)[];
  /** 一个循环长度（单位数），缺省 = 最大单位 + 4.2 */
  loop?: number;
  /** 单位放大，缺省 1 */
  scale?: number;
  /** 点亮占比，缺省 0.62 */
  lit?: 0.25 | 0.35 | 0.45 | 0.62;
}

export interface LatticeLoaderOptions {
  /** 三种状态的文字，缺省 "Thinking" / "Done in" / "Failed after" */
  label?: string;
  doneLabel?: string;
  errorLabel?: string;
  /** 缺省 "working"（别名 "running" 同） */
  status?: LatticeStatus;
  /** 命名图案或自定义图案；缺省 "orbit"。命名图案没有当前 grid 的版本时回落到该 grid 的缺省图案 */
  pattern?: LatticePatternName | LatticePattern;
  grid?: 3 | 4;
  shape?: "square" | "round";
  /** CSS 颜色或 token 名（"--accent"）；缺省 currentColor / --ok / --err */
  color?: string;
  doneColor?: string;
  errorColor?: string;
  /** px，缺省 6 / 2 / 14 */
  cellSize?: number;
  gap?: number;
  fontSize?: number;
  /** 波浪每步 ms，缺省 90 */
  step?: number;
  /** 缺省 0.15 */
  idleOpacity?: number;
  glow?: boolean;
  glowColor?: string;
  /** 缺省 true */
  showTimer?: boolean;
  /** 秒；给了就由外部控制秒表，不自走 */
  elapsed?: number;
}

export interface LatticeLoaderHandle {
  /** 合并更新选项；切到 done / error 时秒表定格，切回 working 从 0 重新计时 */
  set(partial: LatticeLoaderOptions): void;
  /** 清空生成的内容并还原元素 */
  destroy(): void;
}

/** v0.19.0：方格波浪加载器 + 实时秒表（移植自 React Bits Lattice Loader）。el 通常是 <span>。 */
export function mountLatticeLoader(el: HTMLElement, options?: LatticeLoaderOptions): LatticeLoaderHandle;
