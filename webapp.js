/* ============================================================
   @szyyw/design · webapp.js（v0.32.0）
   「添加到主屏幕」后当独立 App 用（standalone）的运行时部分：
     isStandalone()  当前是否以主屏 App 打开
     fitViewport()   整屏页面跟随可见视口：--app-h / html.kb-open / 页面不被键盘顶走
     autoUpdate()    新版本上线后自动刷新（定时 + 回到前台），用户正在输入 / 开着弹层时不打断
   配套 CSS 在 components.css（body.app-screen、.app-fill）与 tokens.css（--safe-bottom）。
   用法与 head 片段见 DESIGN.md「主屏 Web App」。模块顶层不碰 DOM（服务端也可 import）。
   ============================================================ */

const KB_CLASS = "kb-open";
const APP_H = "--app-h";
/** 可见视口比布局视口矮出这么多才算键盘弹起（地址栏 / 工具栏收放只差几十 px） */
const KB_THRESHOLD = 120;

/** 当前页面是否以「主屏 App」（standalone）方式打开；iOS 老版本只认 navigator.standalone */
export function isStandalone() {
  if (typeof window === "undefined") return false;
  try {
    if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
  } catch {
    /* 老浏览器不认这个媒体特性 */
  }
  return window.navigator?.standalone === true;
}

/**
 * 整屏页面（body.app-screen + .app-fill）跟随可见视口。只给底部有输入框的整屏页面用。
 * 手机上软键盘盖住页面却不缩小布局视口，iOS 还会把整页往上推：
 * - 把 --app-h 设成可见视口高度（visualViewport.height，取整），.app-fill 跟着变矮，输入栏贴着键盘；
 * - 键盘高度（布局视口高 − 可见视口高）超过 120px 时给 <html> 加 kb-open（--safe-bottom 归零）；
 * - 页面被推走（scrollY / visualViewport.offsetTop 不为 0）时滚回顶部。
 * resize / scroll 回调用 requestAnimationFrame 合并成每帧一次。没有 visualViewport 的环境什么都不做。
 * @returns {() => void} 卸载：移除监听，并清掉 --app-h 与 kb-open
 */
export function fitViewport() {
  const vv = typeof window !== "undefined" ? window.visualViewport : null;
  if (!vv) return () => {};
  const root = document.documentElement;
  let raf = 0;

  const fit = () => {
    raf = 0;
    const h = Math.round(vv.height);
    root.style.setProperty(APP_H, `${h}px`);
    root.classList.toggle(KB_CLASS, root.clientHeight - h > KB_THRESHOLD);
    if (window.scrollY || vv.offsetTop) window.scrollTo(0, 0);
  };
  const later = () => {
    if (!raf) raf = requestAnimationFrame(fit);
  };

  vv.addEventListener("resize", later);
  vv.addEventListener("scroll", later);
  fit();

  return () => {
    vv.removeEventListener("resize", later);
    vv.removeEventListener("scroll", later);
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    root.style.removeProperty(APP_H);
    root.classList.remove(KB_CLASS);
  };
}

/** 不算「正在输入」的 input 类型（值不是用户打的字） */
const NON_TEXT_INPUTS = new Set(["button", "checkbox", "color", "file", "hidden", "image", "radio", "range", "reset", "submit"]);

/** 可见：没被 hidden、在渲染树里（fixed 元素没有 offsetParent，所以看 getClientRects） */
function shown(el) {
  return !el.hidden && el.getClientRects().length > 0;
}

/**
 * 缺省的「忙」判断：此刻刷新会丢掉用户正在做的事。
 * - 焦点在 input（文字类）/ textarea / contenteditable 上，且里面有内容；
 * - 或页面上有打开的 dialog[open]，或可见的 .drawer / .sheet / .overlay（confirm、lightbox 等都在 .overlay 里）。
 */
export function defaultIsBusy() {
  if (typeof document === "undefined") return false;
  const a = document.activeElement;
  if (a && a !== document.body) {
    if (a.isContentEditable) {
      if ((a.textContent || "").trim()) return true;
    } else if (a.tagName === "TEXTAREA" || (a.tagName === "INPUT" && !NON_TEXT_INPUTS.has(a.type))) {
      if (String(a.value || "").trim()) return true;
    }
  }
  if (document.querySelector("dialog[open]")) return true;
  for (const el of document.querySelectorAll(".drawer, .sheet, .overlay")) {
    if (shown(el)) return true;
  }
  return false;
}

/**
 * 新版本上线后自动刷新，主屏 App 没有地址栏、也不能下拉刷新时靠它拿到新代码。
 *
 * - 每 intervalMs 检查一次（页面在后台时跳过），回到前台（visibilitychange）时也检查；
 *   check() 返回的版本与 current 不同、且此刻不忙 → location.reload()。
 * - 在后台待超过 awayMs 再回到前台：不忙就直接刷新（像原生 App 被系统回收后重新打开），不必等检查。
 * - 忙（isBusy() 为真）时不刷新，记下「有新版本」；之后在 focusout、点击、Esc、dialog 关闭之后（下一轮事件循环）
 *   以及每次定时检查时重试，一旦不忙就刷新——例如清空输入框并失焦、关掉弹层之后。
 * - check() 抛错或返回空值 = 版本未知，不刷新。同一时刻只有一个 check() 在进行。
 *
 * @param {object} options
 * @param {string|null|undefined} options.current  当前页面的版本（约定写在 <html data-version>）；为空时什么都不做
 * @param {() => Promise<string|undefined|null>} options.check  取线上版本
 * @param {() => boolean} [options.isBusy]  忙判断，缺省 defaultIsBusy
 * @param {number} [options.intervalMs=600000]  定时检查间隔（10 分钟）
 * @param {number} [options.awayMs=1800000]     在后台超过这么久回来就直接刷新（30 分钟）
 * @returns {() => void} 停止：清掉定时器与所有监听
 */
export function autoUpdate({ current, check, isBusy = defaultIsBusy, intervalMs = 600000, awayMs = 1800000 } = {}) {
  if (!current || typeof check !== "function" || typeof window === "undefined") return () => {};
  const cur = String(current);
  let stopped = false;
  let inflight = null;
  let pending = false;
  let hiddenAt = 0;
  let retryTimer = 0;

  const busy = () => {
    try {
      return !!isBusy?.();
    } catch {
      return true; // 判断不了就当忙，宁可晚点刷新
    }
  };

  function reload() {
    stop();
    location.reload();
  }

  function tryPending() {
    if (!stopped && pending && !busy()) reload();
  }

  function runCheck() {
    if (stopped || inflight || document.hidden) return;
    inflight = (async () => {
      let v;
      try {
        v = await check();
      } catch {
        v = undefined; // 离线 / 接口出错：版本未知，下次再说
      }
      inflight = null;
      if (stopped || !v || String(v) === cur) return;
      pending = true;
      tryPending();
    })();
  }

  function onTick() {
    if (pending) tryPending();
    else runCheck();
  }

  function onVisibility() {
    if (document.hidden) {
      hiddenAt = Date.now();
      return;
    }
    const away = hiddenAt && Date.now() - hiddenAt > awayMs;
    hiddenAt = 0;
    if ((away || pending) && !busy()) return reload();
    if (!pending) runCheck();
  }

  // 有新版本但当时在忙：交互结束后的下一轮再看一次（失焦后 activeElement 才更新；点关闭后弹层才移除）
  function onInteract(e) {
    if (!pending || stopped) return;
    if (e.type === "keyup" && e.key !== "Escape") return; // 打字途中不刷新；Esc 可能刚关掉弹层
    clearTimeout(retryTimer);
    retryTimer = setTimeout(tryPending, 0);
  }

  const timer = setInterval(onTick, intervalMs);
  document.addEventListener("visibilitychange", onVisibility);
  document.addEventListener("focusout", onInteract, true);
  document.addEventListener("click", onInteract, true);
  document.addEventListener("keyup", onInteract, true);
  document.addEventListener("close", onInteract, true);

  function stop() {
    if (stopped) return;
    stopped = true;
    clearInterval(timer);
    clearTimeout(retryTimer);
    document.removeEventListener("visibilitychange", onVisibility);
    document.removeEventListener("focusout", onInteract, true);
    document.removeEventListener("click", onInteract, true);
    document.removeEventListener("keyup", onInteract, true);
    document.removeEventListener("close", onInteract, true);
  }

  return stop;
}
