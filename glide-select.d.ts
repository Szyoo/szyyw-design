export interface GlideSelectOptions {
  /** 选中项 value 为 "" 时触发器显示的文字；缺省取该 option 的文字，再缺省 "Select…" */
  placeholder?: string;
  /** option 的 data-tag 显示在行尾，缺省 true */
  showTags?: boolean;
  /** 颜色：CSS 颜色或 token 名（"--accent"）。缺省 accent = --accent，surface = --sheet-bg，highlight = accent 的 14% 着色，text = --text */
  accent?: string;
  surface?: string;
  highlight?: string;
  text?: string;
  /** 仅非 .field 的 select；.field 跟 .field 自己的尺寸。缺省 "md" */
  size?: "sm" | "md" | "lg";
  /** 菜单圆角 px，缺省 12 */
  radius?: number;
  /** 菜单宽度 px；缺省 null = 不小于触发器、按内容 */
  menuWidth?: number | null;
  /** 缺省 "bottom"；放不下自动翻转 */
  placement?: "top" | "bottom";
  /** 菜单与触发器哪一侧对齐，缺省 "left" */
  align?: "left" | "right";
  /** 弹出时长 ms，缺省 180（收起 2/3） */
  popDuration?: number;
  /** 高亮块滑动时长 ms，缺省 220 */
  glideDuration?: number;
  /** 鼠标移出列表后高亮留在原行，缺省 true */
  rememberPosition?: boolean;
  /** 无 <label> 时的可访问名；缺省取 select 的 aria-label */
  ariaLabel?: string;
  /** 追加到外层 .glide-select 的类 */
  className?: string;
}

export interface GlideSelectHandle {
  /** 外部改了 option 列表 / disabled 之后手动同步（MutationObserver 与 value 写入已自动处理） */
  refresh(): void;
  /** 还原原生 select（去掉隐藏类 / 访问器 / 监听），移除触发器与菜单 */
  destroy(): void;
}

/**
 * v0.19.0：原生 <select> 的渐进增强（移植自 React Bits Glide Select）。
 * 原生 select 留在 DOM 里作真实数据源：选中时写 selectedIndex 并派发原生 input / change（冒泡）；
 * 外部写 value / selectedIndex 会自动同步（不派发事件）。不支持 multiple。
 * select 上的 data-glide-<选项名>（kebab → camel，如 data-glide-menu-width）优先于 options。
 */
export function enhanceSelect(select: HTMLSelectElement, options?: GlideSelectOptions): GlideSelectHandle;

/** 处理 root（缺省 document）里所有 select[data-glide]，返回解除函数 */
export function enhanceSelects(root?: ParentNode | Element | null, options?: GlideSelectOptions): () => void;
