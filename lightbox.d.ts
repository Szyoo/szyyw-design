export type LightboxLocale = "zh" | "ja" | "en";

export interface LightboxTexts {
  /** 对话框的可访问名（「查看图片」） */
  dialog: string;
  /** 关闭键（「关闭」） */
  close: string;
  /** 翻页键（「上一张」「下一张」） */
  prev: string;
  next: string;
  /** 缩放键（「放大」「缩小」）；百分比按钮的 title / 可访问名前缀（「还原」） */
  zoomIn: string;
  zoomOut: string;
  reset: string;
  /** 1:1 按钮的说明（「原图一像素对屏幕一像素」） */
  actualSize: string;
  /** 底栏「原图 W×H」的前缀（「原图」） */
  original: string;
  /** 底栏打开原图链接（「打开原图」） */
  openOriginal: string;
  /** 转圈的可访问名（「加载中」） */
  loading: string;
  /** 失败态标题（「图片加载失败」）与链接（「在新标签打开原图」） */
  loadFailed: string;
  openInNewTab: string;
  /** 切图时读屏播报，{i} {n} 会被替换（「第 {i} / {n} 张」） */
  position: string;
  /** 没给 alt 时原图的替代文字（「图片 {i} / {n}」） */
  image: string;
  /** 缩略图带的可访问名（「全部图片」）与每块磁贴（「第 {i} 张」） */
  thumbs: string;
  thumb: string;
}

/** 内置文案（zh / ja / en） */
export const LIGHTBOX_TEXTS: Readonly<Record<LightboxLocale, LightboxTexts>>;

export interface LightboxItem {
  /** 原图地址（必填；没有 src 的项被丢掉） */
  src: string;
  /** 缩略图：加载原图期间模糊撑出占位，也用于底部缩略图带（缺省用 src） */
  thumb?: string;
  /** 替代文字，缺省 labels.image */
  alt?: string;
  /** 原图像素尺寸：加载前按它撑出版面；加载后以 naturalWidth / naturalHeight 为准 */
  width?: number;
  height?: number;
}

export interface LightboxOptions {
  items: LightboxItem[];
  /** 从第几张开始（0 起），缺省 0 */
  start?: number;
  /** 缺省 "zh" */
  locale?: LightboxLocale;
  labels?: Partial<LightboxTexts>;
  /** 用户关闭（关闭键 / Esc / 点遮罩 / 下拉）后调用；destroy() 不调用 */
  onClose?: () => void;
  /** 关闭后焦点回到哪里，缺省打开时的焦点元素 */
  returnFocus?: HTMLElement;
}

export interface LightboxHandle {
  /** 关闭并调用 onClose（重复调用无害） */
  close(): void;
  /** 跳到第 i 张（超出范围按张数取模） */
  go(index: number): void;
  /** 静默移除（不调用 onClose），撤掉全部监听 */
  destroy(): void;
}

/**
 * v0.31.0：原图查看器。挂到 body（.overlay + .sheet.wide），桌面居中小窗、≤899px 大半屏卡片（下拉关闭）。
 * 打开时对 items 做快照；关闭后焦点回到触发元素
 */
export function openLightbox(options: LightboxOptions): LightboxHandle;

/**
 * v0.31.0：root（缺省 document）里 `.thumb-strip` 中带 `data-lightbox-src` 的 `.thumb-tile` 点开看图，从被点的那张开始。
 * 同组 = 相同 `data-lightbox-group`；没写组 = 同一条里没写组的磁贴。`data-lightbox-thumb` 缺省取磁贴里 img 的 src，
 * `data-lightbox-w` / `data-lightbox-h` 是原图尺寸。事件委托、重复调用不重复绑定（返回同一个解绑函数）
 */
export function enhanceLightbox(root?: ParentNode, options?: Omit<LightboxOptions, "items" | "start" | "returnFocus">): () => void;
