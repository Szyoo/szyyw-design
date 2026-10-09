export interface MenuHandle {
  open(): void;
  close(): void;
  toggle(): void;
  readonly isOpen: boolean;
  /** 关闭并解绑（不移除 DOM） */
  destroy(): void;
}

/**
 * v0.13.0：给锚定按钮的 .menu 下拉接上开合与定位（表格行操作「⋯」）。
 * 打开时把菜单暂时搬到 <body> 下 fixed 定位（不被 .table-wrap 裁、不被 .glass 的 backdrop-filter 困住），
 * 下方放不下翻到上方；点 .menu-item / 点外面 / Esc / 滚动 / 缩放关闭，关闭时搬回原处；同一时刻只开一个。
 */
export function attachMenu(
  trigger: HTMLElement,
  menu: HTMLElement,
  options?: {
    /** 与按钮右缘（"end"，缺省）还是左缘（"start"）对齐 */
    align?: "end" | "start";
    /** 点 .menu-item 后关闭，缺省 true */
    closeOnSelect?: boolean;
  }
): MenuHandle;
