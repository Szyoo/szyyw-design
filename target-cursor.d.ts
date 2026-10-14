export interface TargetCursorOptions {
  /** 吸附目标选择器；缺省 ".cursor-target, a, button, [role=button]" */
  targetSelector?: string;
  /** targetSelector 的别名 */
  selector?: string;
  /** 缺省态颜色：CSS 颜色或 token 引用；缺省 "var(--accent)" */
  cursorColor?: string;
  /** 吸附到目标时渐变到的颜色；缺省 "var(--accent2)"，null = 不变色 */
  cursorColorOnTarget?: string | null;
  /** 自转一圈的秒数；0 = 不转；缺省 2（reduced-motion 下不转） */
  spinDuration?: number;
  /** 吸附弹簧的体感时长（秒），最小 0.05；缺省 0.2 */
  hoverDuration?: number;
  /** 吸附时框轻微跟随指针偏移；缺省 true */
  parallaxOn?: boolean;
  /** 光标在页面内时隐藏系统光标；缺省 true */
  hideDefaultCursor?: boolean;
  /** 自由态取景框边长 px；缺省 36 */
  size?: number;
  /** 角标臂长 px；缺省 12 */
  cornerSize?: number;
  /** 角标线宽 px；缺省 3 */
  thickness?: number;
  /** 吸附时框比目标外扩 px；缺省 6 */
  padding?: number;
  /** 吸附时角标圆角跟随目标；缺省 true */
  matchRadius?: boolean;
  /** 中心圆点直径 px；0 = 不画；缺省 4 */
  dotSize?: number;
  /** CSS mix-blend-mode；缺省 "normal"（上游缺省 "difference"） */
  blendMode?: string;
  /** 目标带 data-cursor-label 时在框上方显示；缺省 true */
  showLabel?: boolean;
  /** 按下时框与圆点收缩；缺省 true */
  clickEffect?: boolean;
  /** 限定在某个元素内生效；缺省 null = 整个页面 */
  container?: HTMLElement | { current: HTMLElement | null } | null;
}

export interface TargetCursorHandle {
  /** 热更新参数（合并到当前设置） */
  update(options: TargetCursorOptions): void;
  /** 卸载：移除 DOM / 监听 / 样式，恢复系统光标；重复调用无害 */
  destroy(): void;
}

export const DEFAULTS: Required<Omit<TargetCursorOptions, "selector">>;

/**
 * v0.19.0：Target Cursor（出处 React Bits，MIT + Commons Clause）。
 * 仅 `(hover: hover) and (pointer: fine)` 生效；SSR 下返回空操作句柄。
 */
export function mountTargetCursor(options?: TargetCursorOptions): TargetCursorHandle;
