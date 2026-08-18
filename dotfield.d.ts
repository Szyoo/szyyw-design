export interface DotFieldOptions {
  dotRadius?: number;
  dotSpacing?: number;
  cursorRadius?: number;
  cursorForce?: number;
  /** false=点被推开回弹（常驻斥力）；true=鼠标压出凹陷（随移动涨落） */
  bulgeOnly?: boolean;
  bulgeStrength?: number;
  waveAmplitude?: number;
  sparkle?: boolean;
  glow?: boolean;
  glowRadius?: number;
  fps?: number;
}

export type DotFieldProps = Required<DotFieldOptions>;

export interface DotFieldHandle {
  /** 重新从 CSS 变量取色（主题切换已自动处理，一般不需要手动调） */
  refreshColors(): void;
  /** 改参数并立即生效；颜色不走这里——改 --df-* token 即可 */
  setOptions(patch: DotFieldOptions): DotFieldProps;
  /** 回到挂载时的参数，并把主题旋钮的控制权交还给主题 */
  resetOptions(): DotFieldProps;
  getOptions(): DotFieldProps;
  destroy(): void;
}

export const DEFAULTS: DotFieldProps;

/**
 * 读取解析后的颜色 token。
 * 不能直读自定义属性：它不做条件求值，只会拿到未展开的 light-dark(...) 字面量。
 * 取不到返回 null。
 */
export function resolveTokenColor(name: string): string | null;

/** 挂载点阵背景到容器（容器需铺满视口，如 .bg-layer） */
export function mountDotField(container: HTMLElement, options?: DotFieldOptions): DotFieldHandle;

/** .spot 光斑跟踪：把指针位置写进元素的 --mx/--my。返回解绑函数 */
export function attachSpot(root?: Document | HTMLElement): () => void;
