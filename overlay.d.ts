export interface OverlayOptions {
  /** 用户想关闭时调用：点遮罩（按下与松开都在遮罩上）或按 Esc（仅最上层）。真正的移除由调用方负责 */
  onClose?: () => void;
  /** 挂载期间锁 body 滚动（嵌套时引用计数，最后一个销毁才解锁），缺省 true */
  lockScroll?: boolean;
}

export interface OverlayHandle {
  /** 撤销监听并释放滚动锁（重复调用无害）；不会移除元素 */
  destroy(): void;
}

/**
 * v0.17.0：给 `.overlay` 遮罩挂点击遮罩关闭 / Esc 关闭 / body 滚动锁。
 * 拖选文字松手在遮罩上不会误关；模块顶层不碰 DOM，SSR 可 import。
 */
export function mountOverlay(overlayEl: HTMLElement, options?: OverlayOptions): OverlayHandle;
