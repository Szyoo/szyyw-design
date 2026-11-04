export type LucideIconName = "x" | "plus" | "minus" | "check" | "chevron-left" | "chevron-right" | "chevron-up" | "chevron-down" | "chevrons-left" | "chevrons-right" | "arrow-left" | "arrow-right" | "arrow-up" | "arrow-down" | "arrow-up-right" | "arrow-left-right" | "copy" | "clipboard" | "external-link" | "link" | "refresh-cw" | "rotate-ccw" | "search" | "filter" | "trash-2" | "pencil" | "save" | "download" | "upload" | "share-2" | "send" | "zoom-in" | "zoom-out" | "maximize" | "minimize" | "maximize-2" | "minimize-2" | "scan" | "eye" | "eye-off" | "menu" | "ellipsis" | "ellipsis-vertical" | "grip-vertical" | "settings" | "sliders-horizontal" | "info" | "circle-help" | "circle-alert" | "triangle-alert" | "circle-check" | "circle-x" | "loader" | "loader-circle" | "user" | "users" | "lock" | "log-in" | "log-out" | "house" | "calendar" | "clock" | "mail" | "mic" | "bell" | "image" | "file" | "file-text" | "folder" | "star" | "sun" | "moon" | "monitor"; // @icons:names
export type LucideIconAlias = "alert-triangle" | "alert-circle" | "help-circle" | "check-circle" | "x-circle" | "more-horizontal" | "more-vertical" | "home"; // @icons:aliases
/** 可传入的图标名：Lucide 现名，或常用旧名（如 "alert-triangle" = "triangle-alert"） */
export type IconName = LucideIconName | LucideIconAlias;

export interface IconOptions {
  /** px 数或 CSS 长度；缺省不写 = 1em（按钮里自动适配） */
  size?: number | string;
  /** 有意义的图标给读屏文字（role="img" + aria-label）；缺省 = 装饰（aria-hidden） */
  label?: string;
  /** 追加到 svg 的类 */
  className?: string;
  /** 缺省 2 */
  strokeWidth?: number;
  /** 转圈（.icon-spin；reduced-motion 下不转） */
  spin?: boolean;
}

/** 全部可用名字（现名） */
export const ICON_NAMES: readonly LucideIconName[];
/** 收录时的 lucide-static 版本 */
export const LUCIDE_VERSION: string;
/** 名字是否可用（运行时判断外部输入用） */
export function hasIcon(name: string): name is IconName;
/** SVG 标记字符串；未知名字抛错 */
export function iconSvg(name: IconName, options?: IconOptions): string;
/** SVG 元素；未知名字抛错 */
export function icon(name: IconName, options?: IconOptions): SVGSVGElement;
/** 把 root 内的 [data-icon] 占位替换成 svg.icon；返回替换个数 */
export function enhanceIcons(root?: ParentNode): number;
