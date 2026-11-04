export interface DisclosureOptions {
  /** 内容区，缺省取按钮 aria-controls 指向的元素 */
  panel?: HTMLElement;
  /** 初始是否展开，缺省取按钮的 aria-expanded */
  open?: boolean;
  /** 高度动画（--dur-base / --ease），缺省 true；reduced-motion 下总是没有 */
  animate?: boolean;
  /** 用户点击或调用 open / close / toggle 改变状态后调用 */
  onToggle?: (open: boolean) => void;
}

export interface DisclosureHandle {
  readonly expanded: boolean;
  open(): void;
  close(): void;
  /** 不传参 = 切换 */
  toggle(force?: boolean): void;
  /** 撤销监听（不改当前展开状态，重复调用无害） */
  destroy(): void;
}

/**
 * v0.29.0：非 details 写法的折叠区块（`button.disclosure-summary[aria-expanded][aria-controls]` + `.disclosure-body`）。
 * 同步 aria-expanded 与内容区 hidden，展开收起带高度动画。同一按钮重复调用返回同一个 handle。
 */
export function mountDisclosure(trigger: HTMLElement, options?: DisclosureOptions): DisclosureHandle;

/** 处理 root（缺省 document）里所有 `.disclosure-summary[aria-controls]`，返回撤销函数 */
export function enhanceDisclosures(root?: ParentNode & Partial<Element>, options?: Omit<DisclosureOptions, "panel">): () => void;
