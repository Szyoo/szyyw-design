export interface TechTextOptions {
  /** "letter"（缺省，官方）只揭示光标 / 扫描点下那个字母 | "area" 光标圆形区域揭示虚线 | "off" 不揭示（仍可拖） */
  reveal?: "area" | "letter" | "off";
  lineStyle?: "dashed" | "solid";
  /** 选框周边闪烁小方块数量，0 关；缺省 15（官方） */
  specks?: number;
  /** 光标所在字母的选框（含四角与 specks）；缺省 true */
  selection?: boolean;
  /** 选框上方的尺寸 / 位移标注；缺省 true（字号 < minLabelFont 时不画） */
  labels?: boolean;
  /** 字号小于它时不画标注；缺省 18 */
  minLabelFont?: number;
  /** 字母可拖离基线、松手弹簧回位（鼠标与触屏）；缺省 true */
  draggable?: boolean;
  /** "loop"（缺省，官方）无指针时扫描点一直往复、选框逐字跳 | true = 挂载后扫一遍就停 | false */
  sweep?: boolean | "loop";
  speed?: number;
  /** 仅 reveal "area"：揭示半径 px；null（缺省）= 约 2.1 × font-size */
  reach?: number | null;
  /** 仅 reveal "area"：揭示边缘柔和度 0–1；缺省 0.7 */
  softness?: number;
  /** 以下 null（缺省）= 按字号缩放 */
  dashLength?: number | null;
  dashGap?: number | null;
  strokeWidth?: number | null;
  labelSize?: number | null;
  /** 颜色：token 名（"--accent"）、CSS 颜色，或 "auto"（= 元素自己的渐变字 / 文字色） */
  fill?: string;
  stroke?: string;
  /** 选框 / specks 色；缺省 "--accent" */
  accent?: string;
  /** 标注文字色；缺省 "accent"（= accent 色 × 0.62，官方） */
  labelColor?: string;
}

export interface TechTextHandle {
  /** 重新读颜色并重新量 DOM（文字 / 尺寸 / 主题 / 字体变化已自动处理，一般不需要） */
  refresh(): void;
  /** 移除画布、还原元素样式与事件 */
  destroy(): void;
}

export const DEFAULTS: Required<TechTextOptions>;

/**
 * 把已有元素（通常 .app-title）渐进增强为 TechText 字标：
 * 文字、字体、位置都取自元素本身，启用前后布局零位移；原文字留在无障碍树里（只把字形填充设为透明）。
 * 同一元素重复调用返回同一个 handle。
 */
export function mountTechText(el: Element, options?: TechTextOptions): TechTextHandle;

/** 批量增强：选择器（缺省 ".app-title"）、单个元素或元素列表 */
export function enhanceTechText(
  selectorOrRoot?: string | Element | Iterable<Element> | ArrayLike<Element>,
  options?: TechTextOptions
): TechTextHandle[];

/** 当前在跑动画的实例数（所有实例共用一个 rAF；调试 / 测试用） */
export function runningCount(): number;
