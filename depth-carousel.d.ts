export type DepthCarouselItem = string | { image: string; alt?: string };
export type DepthCarouselLocale = "zh" | "ja" | "en";

export interface DepthCarouselLabels {
  /** 根元素 aria-label，缺省「图片轮播」 */
  region: string;
  /** 根元素 aria-roledescription，缺省「轮播」 */
  roledescription: string;
  /** 每张卡片的 aria-roledescription */
  slide: string;
  prev: string;
  next: string;
  /** 圆点组的 aria-label */
  dots: string;
  goTo: (n: number) => string;
  /** 卡片 aria-label 与播报文字，缺省 `${i} / ${n}`（i 从 1 开始） */
  counter: (i: number, n: number) => string;
  loading: string;
  error: string;
}

export interface DepthCarouselOptions {
  /** 图片 url 或 { image, alt } */
  items?: DepthCarouselItem[];
  /** 初始项（从 0 开始），缺省 0；loop 时取模、否则夹到范围内 */
  start?: number;
  /**
   * 卡片宽（px），缺省 300。数字：按上游行为，容器窄时整体等比缩小（不放大，最小 0.4 倍）。
   * "auto"（cardWidth / cardHeight 任一为 "auto"）：按容器宽高与比例放大或缩小填满，容器须有确定高度（见 --dc-height）。
   */
  cardWidth?: number | "auto";
  /** 卡片高（px），缺省 380；"auto" 同上 */
  cardHeight?: number | "auto";
  /** 卡片宽高比（宽 / 高），给了就覆盖 cardHeight 推出的比例；看照片推荐 3 / 4 */
  aspect?: number;
  /** 圆角（px，随尺寸等比），缺省 18 */
  radius?: number;
  /** 后排卡片淡出到的颜色：CSS 颜色或 token 名（"--bg"）；缺省 var(--bg)，随明暗 / 配色即时变 */
  tint?: string;
  /** 每张向后退的距离（px），缺省 220 */
  depth?: number;
  /** 每张横向错开（px），缺省 90 */
  spread?: number;
  /** 后排卡片的倾斜角（度），缺省 22 */
  tilt?: number;
  /** 后排卡片退向哪一侧，缺省 "right" */
  tiltDirection?: "left" | "right";
  /** 透视距离（px，随尺寸等比），缺省 1400 */
  perspective?: number;
  /** 当前项后面显示几张，缺省 4 */
  visibleCards?: number;
  /** 每往后一张变暗 / 淡出的比例，缺省 0.2 */
  falloff?: number;
  /** 最后一张的模糊（px），缺省 6；0 = 不模糊 */
  blur?: number;
  /** 切换动画时长（ms），缺省 700；reduced-motion 下为 0 */
  duration?: number;
  /** gsap 名（"power3.out" 缺省、"sine.inOut"、"expo.out"、"none" …）、"cubic-bezier(a, b, c, d)" 或缓动函数 */
  ease?: string | ((t: number) => number);
  /** 自动轮播，缺省 false；悬停 / 拖动 / 聚焦 / 标签页隐藏 / reduced-motion 时暂停 */
  autoplay?: boolean;
  /** 自动轮播间隔（ms，最小 600），缺省 3200 */
  autoplayDelay?: number;
  /** 首尾相接，缺省 true；false 时首尾按钮禁用、拖过头有阻尼 */
  loop?: boolean;
  /** 左右按钮，缺省 true（上游名 showControls 也认） */
  controls?: boolean;
  /** 底部圆点，缺省 true（上游名 showIndicators 也认） */
  indicators?: boolean;
  showControls?: boolean;
  showIndicators?: boolean;
  /** 超过这么多张就不显示圆点（应用自己显示「n / N」），缺省 24 */
  maxIndicators?: number;
  /** 图片适配，缺省 "contain"（照片不裁切）；"cover" 裁切填满（上游行为）。也可在容器上写 `--dc-fit` */
  fit?: "contain" | "cover";
  /** 滚轮：缺省 "horizontal"（只认横向，不挡纵向滚动）；true = 纵横都认（上游行为）；false = 不认 */
  wheel?: boolean | "horizontal";
  /** 焦点在组件内时 ← → Home End，缺省 true（根元素 tabindex=0） */
  keyboard?: boolean;
  /** 缺省 "zh" */
  locale?: DepthCarouselLocale;
  labels?: Partial<DepthCarouselLabels>;
  /** 根元素 aria-label（覆盖 labels.region） */
  label?: string;
  /** 当前项变化时调用（用户操作、自动轮播、goTo 都会触发；初始化与 setItems 不触发） */
  onChange?: (index: number, item: { image: string; alt: string }) => void;
  /** 额外加在根元素上的类 */
  className?: string;
}

export interface DepthCarouselHandle {
  /** 跳到第 i 项（从 0 开始）；{ animate: false } 直接跳 */
  goTo(index: number, opts?: { animate?: boolean }): void;
  next(): void;
  prev(): void;
  /** 当前项（从 0 开始） */
  readonly index: number;
  readonly count: number;
  /** 换一组图片并跳到 start（不触发 onChange） */
  setItems(items: DepthCarouselItem[], start?: number): void;
  /** 重新测量容器与 tint（容器尺寸 / 主题变化一般会自动跟进） */
  refresh(): void;
  /** 移除全部生成的 DOM、监听、计时器，还原根元素的类与属性 */
  destroy(): void;
}

export const DEFAULTS: Readonly<Required<Omit<DepthCarouselOptions,
  "aspect" | "tint" | "labels" | "label" | "onChange" | "showControls" | "showIndicators">>> &
  Readonly<Pick<DepthCarouselOptions, "aspect" | "tint" | "labels" | "label" | "onChange">>;

/** 解析缓动：gsap 常用名、"cubic-bezier(…)" 或函数；认不出回落 power3.out */
export function resolveEase(ease: string | ((t: number) => number) | undefined): (t: number) => number;
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (t: number) => number;

/**
 * v0.24.0：Depth Carousel（React Bits 移植，零依赖）。el 即根元素（加 .depth-carousel），
 * 自动创建卡片 / 按钮 / 圆点；只创建可见范围附近的卡片，大量图片也不卡。
 */
export function mountDepthCarousel(el: HTMLElement, options?: DepthCarouselOptions): DepthCarouselHandle;
