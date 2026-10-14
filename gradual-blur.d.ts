export type GradualBlurPosition = "top" | "bottom" | "both" | "left" | "right";
export type GradualBlurCurve = "linear" | "bezier" | "ease-in" | "ease-out" | "ease-in-out";
export type GradualBlurPreset =
  | "top" | "bottom" | "left" | "right"
  | "subtle" | "intense" | "smooth" | "sharp"
  | "header" | "footer" | "sidebar" | "page-header" | "page-footer";

export interface GradualBlurOptions {
  /** 缺省 "bottom"；"both" = 上 + 下各一条 */
  position?: GradualBlurPosition;
  /** 模糊强度系数；缺省 2 */
  strength?: number;
  /** 带高（竖向）/ 横向时的带宽默认值，CSS 长度；缺省 "6rem" */
  height?: string;
  /** 横向带宽（缺省取 height） */
  width?: string;
  /** 叠层数；缺省 5 */
  divCount?: number;
  /** 指数递增的模糊半径；缺省 false */
  exponential?: boolean;
  /** 缺省 1000（页面级自动 +100） */
  zIndex?: number;
  /** false（缺省）| true（强度 / 透明度变化走过渡）| "scroll"（目标进入视口时淡入，仅元素目标） */
  animated?: boolean | "scroll";
  /** 缺省 "0.3s" */
  duration?: string;
  /** 缺省 "ease-out" */
  easing?: string;
  /** 每层透明度；缺省 1 */
  opacity?: number;
  /** 缺省 "linear" */
  curve?: GradualBlurCurve;
  /** 按窗口宽度换 height / width：≤480 mobile、≤768 tablet、≤1024 desktop */
  responsive?: boolean;
  mobileHeight?: string;
  tabletHeight?: string;
  desktopHeight?: string;
  mobileWidth?: string;
  tabletWidth?: string;
  desktopWidth?: string;
  /** 预设；显式参数覆盖预设（预设里的 target 字段被忽略，目标由 mountGradualBlur 的第一个参数决定） */
  preset?: GradualBlurPreset;
  /** 悬停时强度倍数；设了之后模糊带接管指针事件 */
  hoverIntensity?: number;
  /** animated: "scroll" 淡入完成时回调 */
  onAnimationComplete?: () => void;
  className?: string;
  /** 额外行内样式，合并到每条模糊带 */
  style?: Partial<CSSStyleDeclaration> | Record<string, string>;
  /**
   * 新增：离开该边缘多少 px 后模糊带才完全显现（已在顶端 / 底端就不叠那一条，往里滚渐渐浮现）。
   * 缺省 64；0 = 常驻。内容没溢出时不显示。
   */
  edgeFade?: number;
}

export interface GradualBlurHandle {
  /** 合并新参数并重建 / 重新定位 */
  update(options?: GradualBlurOptions): void;
  /** 移除模糊带与全部监听；重复调用无害 */
  destroy(): void;
}

export const DEFAULTS: Required<Pick<GradualBlurOptions, "position" | "strength" | "height" | "divCount" | "exponential" | "zIndex" | "animated" | "duration" | "easing" | "opacity" | "curve" | "responsive" | "className" | "edgeFade">> & GradualBlurOptions;
export const PRESETS: Record<GradualBlurPreset, Partial<GradualBlurOptions>>;
export const CURVE_FUNCTIONS: Record<GradualBlurCurve, (p: number) => number>;

/**
 * v0.19.0：Gradual Blur（出处 React Bits，MIT + Commons Clause）。
 * target：滚动容器（元素或选择器；模糊带作为兄弟节点贴着容器可视区边缘）；
 * window / document / document.body / "page" = 页面级（固定在视口边缘）。
 */
export function mountGradualBlur(
  target: Element | Window | Document | string,
  options?: GradualBlurOptions
): GradualBlurHandle;

/**
 * 声明式：root（缺省 document）内每个 [data-gradual-blur="top|bottom|both|left|right"] 元素挂一个；
 * 其余参数用 data-gradual-blur-<短横线参数名>，如 data-gradual-blur-div-count="8"。
 */
export function enhanceGradualBlur(root?: ParentNode): { destroy(): void };
