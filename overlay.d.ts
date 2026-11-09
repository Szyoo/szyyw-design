export interface OverlayDragCloseOptions {
  /** 要拖的卡片，缺省取遮罩里的第一个 `.sheet` */
  sheet?: HTMLElement;
  /** 从哪里按下才开始拖（选择器），缺省 `.sheet-grabber, .sheet-head`；其中的按钮、链接、输入框不触发 */
  handle?: string;
}

export interface OverlayOptions {
  /** 用户想关闭时调用：点遮罩（按下与松开都在遮罩上）或按 Esc（仅最上层）。真正的移除由调用方负责 */
  onClose?: () => void;
  /** 挂载期间锁 body 滚动（嵌套时引用计数，最后一个销毁才解锁），缺省 true */
  lockScroll?: boolean;
  /**
   * v0.31.0：底部抽屉（≤899px 的 `.sheet`）从上沿往下拖关闭。卡片跟手、遮罩变淡；
   * 松手超过卡片高 30%（最多 200px）或快速下甩 → 卡片滑出后调 onClose，否则弹回。宽屏下不生效。
   * 缺省不开，行为与之前相同
   */
  dragClose?: boolean | OverlayDragCloseOptions;
}

export interface OverlayHandle {
  /** 撤销监听并释放滚动锁（重复调用无害）；不会移除元素 */
  destroy(): void;
  /**
   * v0.31.0：把组件自己区域里的下滑手势接进下拉关闭（dy = 相对按下点的纵向位移，px）。
   * 没开 dragClose、宽屏或正在关闭时返回 false，不做任何事
   */
  dragBy(dy: number): boolean;
  /** v0.31.0：手势结束。velocity 为松手时的纵向速度（px/ms，向下为正）；返回 true 表示判定为关闭 */
  release(dy: number, velocity?: number): boolean;
}

/**
 * v0.17.0：给 `.overlay` 遮罩挂点击遮罩关闭 / Esc 关闭 / body 滚动锁。
 * 拖选文字松手在遮罩上不会误关；模块顶层不碰 DOM，SSR 可 import。
 */
export function mountOverlay(overlayEl: HTMLElement, options?: OverlayOptions): OverlayHandle;
