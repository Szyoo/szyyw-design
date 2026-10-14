import type { GradualBlurOptions } from "./gradual-blur";

export interface StickyHeadsOptions {
  /** 在哪个范围里找吸顶标题并跟进增删；缺省 document.body */
  root?: ParentNode;
  /**
   * 应用自己的 sticky / fixed 顶栏（元素或选择器）：它的实际高度写成 html 上的 --sticky-top
   * （display: none 时为 0，可随断点自动切换）。不传则不碰 --sticky-top（应用可自己在 CSS 里设）。
   */
  offset?: Element | string | null;
  /**
   * 标题下沿外侧的 Gradual Blur 带。v0.22.1 起**缺省不挂**（内容只在滚进标题区域时被玻璃底模糊）；
   * true = 用 BLUR_DEFAULTS 挂，对象 = 覆盖参数（position / outside / edgeFade 固定）
   */
  blur?: boolean | Omit<GradualBlurOptions, "position" | "outside" | "edgeFade">;
}

export interface StickyHeadsHandle {
  /** 下一帧重扫吸顶标题并重量高度（DOM / 尺寸变化本来就会自动触发，一般不用调） */
  refresh(): void;
  /** 撤监听、拆模糊带、清掉 data-stuck / data-covered 与 html 上写过的 --sticky-page-h / --sticky-top；重复调用无害 */
  destroy(): void;
}

/** ".page-head.sticky, .section-head.sticky" */
export const STICKY_HEAD_SELECTOR: string;

/** 模糊带缺省参数：{ height: "1.5rem", strength: 2, divCount: 5, curve: "linear" } */
export const BLUR_DEFAULTS: Readonly<Pick<GradualBlurOptions, "height" | "strength" | "divCount" | "curve">>;

/**
 * v0.22.0：吸顶标题 `.page-head.sticky` / `.section-head.sticky` 的可选增强——
 * 实测标题行高度（--sticky-page-h）与顶栏高度（--sticky-top），写 data-stuck / data-covered，
 * 可选（blur）在吸顶标题下沿外侧挂 Gradual Blur（v0.22.1 起缺省不挂）。只跟页面（window）滚动。模块顶层不碰 DOM，SSR 可 import。
 */
export function mountStickyHeads(options?: StickyHeadsOptions): StickyHeadsHandle;
