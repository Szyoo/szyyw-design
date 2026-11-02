export interface TabsHandle {
  /** 下一帧重测所有轨道的滑块位置（DOM / 尺寸 / 字体变化本来就会自动触发，一般不用调） */
  refresh(): void;
  /** 撤全部监听，清掉轨道上的 data-pill / data-pill-on / data-pill-ready 与 --tab-pill-*（原本没有 style 属性的轨道连空 style 一起去掉）；重复调用无害 */
  destroy(): void;
}

/** ".tabs, .seg" */
export const TABS_SELECTOR: string;

/**
 * v0.23.0 滑块分段的可选增强：root 范围内（root 自己也算）现在与之后出现的 .tabs / .seg 轨道，
 * 选中项（直接子元素带 .active / [aria-selected="true"] / [aria-pressed="true"]）下方的凸起块改由轨道 ::before 画，切换时滑过去。
 * 不插入任何子节点；选中态仍由应用自己改（类名或 aria 属性），本函数只跟随。mountChrome 缺省已调用（tabs: false 关闭）。
 * @param root 缺省 document
 */
export function enhanceTabs(root?: ParentNode): TabsHandle;
