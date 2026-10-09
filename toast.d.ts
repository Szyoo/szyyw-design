export type ToastTone = "ok" | "err" | "warn" | "info";

export interface ToastHandle {
  /** 这条 toast 的元素（.toast.<tone>） */
  el: HTMLElement;
  /** 立刻关闭（重复调用无害） */
  close(): void;
}

/**
 * v0.13.0：弹一条操作反馈 toast（视口底部居中堆叠，最多 4 条；点一下关闭）。
 * 区域 .toast-region 第一次调用时挂到 body（aria-live="polite"；err 单条 role="alert"）。
 */
export function toast(
  message: string | Node,
  options?: {
    /** 缺省 "info" */
    tone?: ToastTone;
    /** 毫秒，缺省 3000；0 = 不自动消失 */
    timeout?: number;
  }
): ToastHandle;

/** 关掉所有 toast */
export function clearToasts(): void;
