/* ============================================================
   @szyyw/design · tabs.js（v0.23.0）
   滑块分段的可选增强：给 .tabs / .seg 轨道加一块跟随选中项滑动的凸起块。
   外观全在 components.css（§12.1），不挂本模块时选中项自己画凸起底，功能完全一样。

   做法：不往轨道里插节点（框架管理的子节点列表保持原样），只在轨道上写
     data-pill / data-pill-on / data-pill-ready 与 --tab-pill-x / -y / -w / -h，
   凸起块由轨道的 ::before 画。选中项 = 轨道的直接子元素中带 .active / [aria-selected="true"] /
   [aria-pressed="true"] 且可见的第一个。

   跟进：MutationObserver（轨道增删、选中态 / hidden / disabled 变化，React 等改 aria-selected 也算）、
   ResizeObserver（轨道与各段尺寸）、document.fonts（字体加载完重测）。
   首次测到有效位置才加 data-pill-ready（才有过渡），首帧不会从 0 滑入；轨道隐藏时不接管，显示后再测。
   ============================================================ */

export const TABS_SELECTOR = ".tabs, .seg";

const SELECTED = ':scope > :is(.active, [aria-selected="true"], [aria-pressed="true"]):not([hidden])';
const VARS = ["--tab-pill-x", "--tab-pill-y", "--tab-pill-w", "--tab-pill-h"];
const ATTRS = ["data-pill", "data-pill-on", "data-pill-ready"];
const WATCHED_ATTRS = ["class", "aria-selected", "aria-pressed", "hidden", "disabled"];

/**
 * @param {ParentNode} [root]  在哪个范围里找轨道并跟进增删；缺省 document（root 自己是轨道也算）
 * @returns {{ refresh(): void, destroy(): void }}
 */
export function enhanceTabs(root) {
  const noop = { refresh() {}, destroy() {} };
  if (typeof document === "undefined") return noop;
  const scope = root || document;

  /** track → { origStyle: string|null, ready: boolean, on: boolean } */
  const tracks = new Map();
  const ro = typeof ResizeObserver === "function" ? new ResizeObserver(() => schedule()) : null;
  let raf = 0;
  let destroyed = false;

  const findTracks = () => {
    const list = [];
    if (scope.nodeType === 1 && scope.matches(TABS_SELECTOR)) list.push(scope);
    if (scope.querySelectorAll) list.push(...scope.querySelectorAll(TABS_SELECTOR));
    return list;
  };

  const observeTrack = (track) => {
    if (!ro) return;
    ro.observe(track);
    for (const child of track.children) ro.observe(child);
  };

  const release = (track, state) => {
    for (const a of ATTRS) track.removeAttribute(a);
    for (const v of VARS) track.style.removeProperty(v);
    if (state.origStyle === null) {
      if (!track.getAttribute("style")) track.removeAttribute("style");
    }
    if (ro) {
      ro.unobserve(track);
      for (const child of track.children) ro.unobserve(child);
    }
  };

  const measure = (track, state) => {
    // 轨道不可见（display: none 的面板里）：不接管，保持纯 CSS 外观，等它显示出来 ResizeObserver 再触发
    if (!track.offsetParent && getComputedStyle(track).position !== "fixed") {
      if (state.ready) {
        track.removeAttribute("data-pill-ready");
        state.ready = false;
      }
      return;
    }
    const sel = track.querySelector(SELECTED);
    const w = sel ? sel.offsetWidth : 0;
    if (!sel || !w) {
      track.setAttribute("data-pill", "");
      track.removeAttribute("data-pill-on");
      state.on = false;
      return;
    }
    // 从「无选中 / 未就绪」到有选中：先关过渡直接放到位，再淡入，不从旧位置或 0 滑过来
    const jump = !state.ready || !state.on;
    if (jump) track.removeAttribute("data-pill-ready");
    track.setAttribute("data-pill", "");
    track.style.setProperty("--tab-pill-x", `${sel.offsetLeft}px`);
    track.style.setProperty("--tab-pill-y", `${sel.offsetTop}px`);
    track.style.setProperty("--tab-pill-w", `${w}px`);
    track.style.setProperty("--tab-pill-h", `${sel.offsetHeight}px`);
    track.setAttribute("data-pill-on", "");
    state.on = true;
    if (jump) {
      void track.offsetWidth; // 让无过渡的位置先生效
      track.setAttribute("data-pill-ready", "");
      state.ready = true;
    }
  };

  const scan = () => {
    raf = 0;
    if (destroyed) return;
    const current = new Set(findTracks());
    for (const [track, state] of tracks) {
      if (!current.has(track) || !track.isConnected) {
        release(track, state);
        tracks.delete(track);
      }
    }
    for (const track of current) {
      let state = tracks.get(track);
      if (!state) {
        state = { origStyle: track.getAttribute("style"), ready: false, on: false };
        tracks.set(track, state);
      }
      observeTrack(track); // 重复 observe 无害；新插入的段也会被观察到
      measure(track, state);
    }
  };

  function schedule() {
    if (destroyed || raf) return;
    raf = typeof requestAnimationFrame === "function" ? requestAnimationFrame(scan) : (setTimeout(scan, 16), 1);
  }

  const isTrack = (n) => n?.nodeType === 1 && n.matches(TABS_SELECTOR);
  const hasTrack = (n) => n?.nodeType === 1 && (n.matches(TABS_SELECTOR) || !!n.querySelector(TABS_SELECTOR));

  // 属性变化只看轨道本身与它的直接子元素（选中态 / hidden / disabled / 类名）；祖先显隐由 ResizeObserver 兜住
  const mo = typeof MutationObserver === "function"
    ? new MutationObserver((records) => {
        for (const r of records) {
          if (r.type === "attributes") {
            if (isTrack(r.target) || isTrack(r.target.parentElement)) return schedule();
          } else {
            if (isTrack(r.target)) return schedule();
            for (const n of r.addedNodes) if (hasTrack(n)) return schedule();
          }
        }
        for (const track of tracks.keys()) if (!track.isConnected) return schedule();
      })
    : null;
  const moTarget = scope === document ? document.documentElement : scope;
  mo?.observe(moTarget, { childList: true, subtree: true, attributes: true, attributeFilter: WATCHED_ATTRS });

  const fonts = document.fonts;
  fonts?.ready?.then(() => schedule());
  fonts?.addEventListener?.("loadingdone", schedule);
  window.addEventListener("resize", schedule);

  scan();

  return {
    refresh() {
      schedule();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      if (raf && typeof cancelAnimationFrame === "function") cancelAnimationFrame(raf);
      raf = 0;
      mo?.disconnect();
      ro?.disconnect();
      fonts?.removeEventListener?.("loadingdone", schedule);
      window.removeEventListener("resize", schedule);
      for (const [track, state] of tracks) release(track, state);
      tracks.clear();
    }
  };
}
