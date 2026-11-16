/** v0.32.0：当前页面是否以「主屏 App」（standalone）方式打开（display-mode: standalone，或 iOS 的 navigator.standalone） */
export function isStandalone(): boolean;

/**
 * v0.32.0：整屏页面（body.app-screen + .app-fill）跟随可见视口，只给底部有输入框的整屏页面用。
 * visualViewport 的 resize / scroll（按帧合并）→ <html> 上的 --app-h = 可见视口高度（px，取整）；
 * 键盘高度超过 120px 时 <html> 加 kb-open（--safe-bottom 归零）；页面被推走时滚回顶部。
 * 没有 visualViewport 时什么都不做。
 * @returns 卸载：移除监听，并清掉 --app-h 与 kb-open
 */
export function fitViewport(): () => void;

/**
 * v0.32.0：缺省的忙判断——焦点在有内容的文字 input / textarea / contenteditable 上，
 * 或页面上有 dialog[open]、可见的 .drawer / .sheet / .overlay（confirm、lightbox 都在 .overlay 里）。
 */
export function defaultIsBusy(): boolean;

export interface AutoUpdateOptions {
  /** 当前页面版本，约定取 document.documentElement.dataset.version；为空时 autoUpdate 什么都不做 */
  current: string | null | undefined;
  /** 取线上版本；抛错或返回空值 = 未知，不刷新。同一时刻只会有一个 check 在进行 */
  check: () => Promise<string | null | undefined>;
  /** 此刻刷新是否会打断用户；缺省 defaultIsBusy */
  isBusy?: () => boolean;
  /** 定时检查间隔，缺省 600000（10 分钟）；页面在后台时跳过 */
  intervalMs?: number;
  /** 在后台待超过这么久再回到前台，不忙就直接刷新；缺省 1800000（30 分钟） */
  awayMs?: number;
}

/**
 * v0.32.0：新版本上线后自动刷新（定时 + 回到前台检查）。版本不同且不忙 → location.reload()；
 * 忙时记下，等 focusout / 点击 / Esc / dialog 关闭之后或下一次定时再试。
 * @returns 停止：清掉定时器与所有监听
 */
export function autoUpdate(options: AutoUpdateOptions): () => void;
