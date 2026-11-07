export interface CopyTexts {
  /** 读屏播报：复制成功 */
  copied: string;
  /** 读屏播报：复制失败 */
  failed: string;
}

/** 内置文案（zh / ja / en） */
export const COPY_TEXTS: Readonly<Record<"zh" | "ja" | "en", CopyTexts>>;

export interface CopyOptions {
  /** 要复制的文字；缺省依次取 data-copy 的值 → data-copy-target 指向的元素 → 前一个兄弟元素 → 父元素文字 */
  text?: string | (() => string);
  /** 勾图标（data-copied）保留多久，缺省 1500ms */
  timeout?: number;
  /** "zh"（缺省）| "ja" | "en" */
  locale?: string;
  /** 覆盖内置文案 */
  labels?: Partial<CopyTexts>;
  /** 每次复制后调用 */
  onCopy?: (ok: boolean, text: string) => void;
}

export interface CopyHandle {
  /** 立即复制一次（同点击） */
  copy(): Promise<boolean>;
  /** 撤监听、去掉 data-copied；重复调用无害 */
  destroy(): void;
}

/** v0.30.0：写剪贴板，不可用时退回 execCommand；成功 true */
export function copyText(text: string): Promise<boolean>;

/** v0.30.0：复制按钮（成功时短暂加 data-copied、读屏播报）。同一按钮重复调用返回同一个 handle */
export function mountCopy(button: HTMLElement, options?: CopyOptions): CopyHandle;

/** 处理 root（缺省 document）里所有 `[data-copy]` 按钮，返回撤销函数 */
export function enhanceCopyButtons(root?: ParentNode, options?: Omit<CopyOptions, "text">): () => void;
