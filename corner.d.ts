/** 内置工具的位次，留出间隔给项目自己的按钮 */
export const CORNER_ORDER: { scheme: number; settings: number };

/** 取得（必要时创建）右上角工具位容器 */
export function cornerRail(): HTMLElement;

/** 把按钮放进右上角工具位（order 小的在左边），返回卸载函数 */
export function mountCornerTool(el: HTMLElement, options?: { order?: number }): () => void;

/** 立刻重新实测并发布工具位高度（--corner-rail-h）；浮层弹出前调用 */
export function syncCornerRail(): void;
