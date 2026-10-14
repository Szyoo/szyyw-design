export type ToastTone = "ok" | "err" | "warn" | "info";
export type ToastCloseReason = "timeout" | "swipe" | "action" | "close" | "escape" | "click" | "programmatic";

export interface ToastHandle {
  /** 这条 toast 的元素（.toast.<tone>） */
  el: HTMLElement;
  /** 立刻关闭（重复调用无害） */
  close(): void;
}

export interface ToastAction {
  label: string;
  /** 点击时先执行，再关闭 toast */
  onClick?: (event: MouseEvent) => void;
}

export interface ToastOptions {
  /** 缺省 "info" */
  tone?: ToastTone;
  /** 毫秒，缺省 3000；0 = 不自动消失（没有引线） */
  timeout?: number;
  /** v0.19.0：加粗标题行；设了之后 message 变成下方的说明行 */
  title?: string | Node;
  /** v0.19.0：卡片右侧操作按钮 */
  action?: ToastAction;
  /** v0.19.0：自定义图标（Node 或 SVG 标记字符串）；false = 不要图标；缺省按 tone 取内置图标 */
  icon?: Node | string | false;
  /** v0.19.0：显示关闭按钮；缺省 false */
  closeButton?: boolean;
  /** v0.19.0：悬停时暂停引线；缺省 true */
  pauseOnHover?: boolean;
  /** v0.19.0：关闭时回调（附原因） */
  onClose?: (reason: ToastCloseReason) => void;
}

/**
 * 弹一条操作反馈 toast（视口底部居中堆叠，最多 4 条；点一下 / 下滑 / Esc 关闭；细引线表示剩余时间）。
 * v0.19.0 起外观与交互取自 React Bits「Swipe Toast」（MIT + Commons Clause），调用方式不变。
 * 区域 .toast-region 第一次调用时挂到 body（aria-live="polite"；err 单条 role="alert"）。
 */
export function toast(message: string | Node, options?: ToastOptions): ToastHandle;

/** 关掉所有 toast */
export function clearToasts(): void;
