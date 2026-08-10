export interface DotFieldOptions {
  dotRadius?: number;
  dotSpacing?: number;
  cursorRadius?: number;
  cursorForce?: number;
  waveAmplitude?: number;
  sparkle?: boolean;
  glow?: boolean;
  glowRadius?: number;
  fps?: number;
}

export interface DotFieldHandle {
  /** 重新从 CSS 变量取色（主题切换已自动处理，一般不需要手动调） */
  refreshColors(): void;
  destroy(): void;
}

/** 挂载点阵背景到容器（容器需铺满视口，如 .bg-layer） */
export function mountDotField(container: HTMLElement, options?: DotFieldOptions): DotFieldHandle;

/** .spot 光斑跟踪：把指针位置写进元素的 --mx/--my。返回解绑函数 */
export function attachSpot(root?: Document | HTMLElement): () => void;
