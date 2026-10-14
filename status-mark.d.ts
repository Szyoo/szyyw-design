export type StatusMarkStatus = "pending" | "running" | "done" | "failed" | "cancelled" | "idle" | "error";

export interface StatusMarkOptions {
  /** 上游五态 + 别名 "idle"（= pending）、"error"（= failed）；缺省 "pending" */
  status?: StatusMarkStatus;
  /** 仅 running：0–1 定进度弧；缺省（或非数）= 不定进度，弧转圈 */
  progress?: number;
  /** 文字标签（字符串或 Node）；完成时划掉 */
  label?: string | Node;
  /** CSS 颜色或 token 名（"--accent"）。缺省 currentColor / --ok / --err */
  color?: string;
  doneColor?: string;
  errorColor?: string;
  /** px，缺省 20 */
  size?: number;
  /** 缺省 2 */
  strokeWidth?: number;
  /** 待定态虚线圈的段数，缺省 8 */
  dashes?: number;
  /** 缺省 14 */
  fontSize?: number;
  /** 不定进度一圈 ms，缺省 1100 */
  spinDuration?: number;
  /** 不定进度弧占整圈比例，缺省 0.68 */
  arcLength?: number;
  /** 勾 / 叉描画 ms，缺省 240 */
  drawDuration?: number;
  /** 完成 / 失败时圈内淡底不透明度，缺省 0.06 */
  fillOpacity?: number;
  /** 完成时划掉文字，缺省 true */
  strike?: boolean;
  /** 划线延迟 ms，缺省 60 */
  strikeDelay?: number;
  /** 读屏文字覆盖，如 { running: "进行中" } */
  texts?: Partial<Record<"pending" | "running" | "done" | "failed" | "cancelled", string>>;
}

export interface StatusMarkHandle {
  /** 合并更新选项并过渡到新状态 */
  set(partial: StatusMarkOptions): void;
  /** 清空生成的内容并还原元素 */
  destroy(): void;
}

/** v0.19.0：状态标记（移植自 React Bits Status Mark）。el 通常是 <span>，会被加上 .status-mark 并清空内容。 */
export function mountStatusMark(el: HTMLElement, options?: StatusMarkOptions): StatusMarkHandle;

/**
 * 声明式：处理 root（缺省 document）里所有 .status-mark[data-status]（data-progress / data-label 等 data-* 见 DESIGN），
 * 之后 data-status / data-progress / data-label 的变化自动同步。返回解除函数。
 */
export function enhanceStatusMarks(root?: ParentNode | Element | null): () => void;
