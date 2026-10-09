/** 内置工具的位次，留出间隔给项目自己的按钮（locale 为 v0.13.0 新增） */
export const CORNER_ORDER: { scheme: number; locale: number; settings: number };

/** 取得（必要时创建）右上角工具位容器 */
export function cornerRail(): HTMLElement;

/** 把按钮放进右上角工具位（order 小的在左边），返回卸载函数 */
export function mountCornerTool(el: HTMLElement, options?: { order?: number }): () => void;

/**
 * 立刻重新实测并发布工具位尺寸与弹层锚点
 * （--corner-rail-h、--corner-rail-w、--corner-panel-top、--corner-panel-right）。
 * claimCornerPanel 已经会调它；自己做的浮层不走 claim 时才需要手动调
 */
export function syncCornerRail(): void;

/**
 * 工具位弹层（.corner-panel）的互斥：打开前调用，先关掉当前开着的别的面板，并把弹层锚点量准；
 * 返回 release，本面板关闭时调用。
 */
export function claimCornerPanel(close: () => void): () => void;

/**
 * 角标值：null / undefined / false / 0 / "" → 隐藏；true → 小圆点；
 * 数字 → 计数（> 99 显示 "99+"）；字符串原样显示
 */
export type CornerBadgeValue = number | boolean | string | null | undefined;

export interface CornerButtonHandle {
  /** 按钮本体（.corner-tool；给了 href 时是 <a>） */
  el: HTMLButtonElement | HTMLAnchorElement;
  /** 改角标；计数同时并进 aria-label（「通知 (3)」） */
  setBadge(value: CornerBadgeValue): void;
  /** 卸下按钮（最后一枚卸下时工具位容器一并移除） */
  destroy(): void;
}

/**
 * v0.13.0：造一枚工具位按钮（.corner-tool + .corner-badge）并挂进右上角工具位。
 * 项目自己的全局按钮用它，不要再照 .corner-tool 抄样式、自己拼角标。
 */
export function createCornerButton(options: {
  /** SVG / 文本字符串（按 HTML 插入，只传写死的图标）或现成节点 */
  icon: string | Node;
  /** 无障碍名：aria-label + title */
  label: string;
  /** 工具位位次，缺省 50 */
  order?: number;
  onClick?: (event: MouseEvent) => void;
  /** 给了就渲染成链接 <a class="corner-tool"> */
  href?: string;
  /** 初始角标 */
  badge?: CornerBadgeValue;
  /** 额外的类 */
  className?: string;
}): CornerButtonHandle;
