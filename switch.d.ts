export interface EnhanceSwitchOptions {
  /** 拖动拉伸强度 0–100，缺省 36；reduced-motion 下无拉伸 */
  stretch?: number;
  /** 悬停时滑块膨胀倍数，缺省 1.035（--sw-hover） */
  hoverScale?: number;
  /** 滑动速度 0–100，缺省 50（--sw-dur；越大越快） */
  speed?: number;
  /** 颜色渐变时长 ms，缺省 200（--sw-fade） */
  colorDuration?: number;
  /** 几何 px（--sw-w / --sw-h / --sw-r）；缺省 40 × 22 */
  width?: number;
  height?: number;
  radius?: number;
}

/**
 * v0.19.0：给 input.switch 加指针拖动 + 按速度拉伸 + 松手挤压回弹（移植自 React Bits Squish Switch）。
 * 点击 / 键盘 / label / 表单 / change 事件语义与原生 checkbox 完全一致。
 * 元素上的 data-stretch / data-hover-scale / data-speed / data-color-duration / data-width / data-height / data-radius 优先于 options。
 * @returns 解除本次挂上的所有开关
 */
export function enhanceSwitches(root?: ParentNode | Element | null, options?: EnhanceSwitchOptions): () => void;
