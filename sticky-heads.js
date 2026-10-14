/* ============================================================
   @szyyw/design · sticky-heads.js（v0.22.0）
   吸顶标题 .page-head.sticky / .section-head.sticky 的可选增强（样式与旋钮见 components.css、DESIGN.md §13.2）。
   不挂它也能吸顶（纯 CSS：玻璃底常驻、小标题按缺省 52px 让位）；挂上之后多三件事：

   1. 实测：标题行高度 → html 上的 --sticky-page-h（标题行折行 / 字号变化时小标题位置跟着对）；
      给了 offset（应用自己的 sticky / fixed 顶栏）时，它的实际高度 → --sticky-top（display: none 时为 0）
   2. 吸住状态：每个吸顶标题写 data-stuck="1" | "0"——没吸住时玻璃底隐去，在页面里看起来就是普通标题；
      有小标题吸在标题行下方时，标题行再写 data-covered
   3. Gradual Blur：每个吸顶标题下沿外侧挂一条渐进模糊带（gradual-blur.js 的 outside 模式），
      吸住时标题下方滚上去的内容被雾化；blur: false 可关

     import { mountStickyHeads } from "@szyyw/design/sticky-heads";
     const h = mountStickyHeads({ offset: ".mobile-topbar" });   // 一个应用挂一次即可（外壳里）
     h.refresh();   // 手动重扫 / 重量（一般不需要：DOM 变化与尺寸变化都会自动跟进）
     h.destroy();   // 撤监听、拆模糊带、清掉写过的属性与 html 上的变量

   - 只跟页面（window）滚动；滚动容器里的吸顶不在此列。
   - root（缺省 document.body）下的增删由 MutationObserver 跟进，客户端路由换页不用重挂。
   - 模块顶层不碰 DOM：SSR 时被求值也不会炸。
   ============================================================ */

import { mountGradualBlur } from "./gradual-blur.js";

export const STICKY_HEAD_SELECTOR = ".page-head.sticky, .section-head.sticky";

/** 模糊带缺省参数（可被 options.blur 覆盖；position / outside / edgeFade 固定） */
export const BLUR_DEFAULTS = { height: "1.5rem", strength: 2, divCount: 5, curve: "linear" };

/**
 * @param {{ root?: ParentNode, offset?: Element | string | null, blur?: false | object }} [options]
 * @returns {{ refresh(): void, destroy(): void }}
 */
export function mountStickyHeads(options = {}) {
  if (typeof window === "undefined" || typeof document === "undefined") return { refresh() {}, destroy() {} };
  const root = options.root || document.body;
  const blurOpts = options.blur === false ? null : { ...BLUR_DEFAULTS, ...(options.blur || {}) };
  const html = document.documentElement;
  /** @type {Map<Element, { blur: { destroy(): void } | null, top: number, page: boolean }>} */
  const heads = new Map();
  let offsetEl = null;
  let raf = 0;
  let dirty = false; // 下一帧要重扫 + 重量（而不只是更新吸住状态）
  let destroyed = false;

  const ro = typeof ResizeObserver === "function" ? new ResizeObserver(() => schedule(true)) : null;

  function resolveOffset() {
    const o = options.offset;
    const el = typeof o === "string" ? document.querySelector(o) : o || null;
    if (el === offsetEl) return;
    if (offsetEl) ro?.unobserve(offsetEl);
    offsetEl = el instanceof Element ? el : null;
    if (offsetEl) ro?.observe(offsetEl);
  }

  function release(el, rec) {
    rec.blur?.destroy();
    ro?.unobserve(el);
    el.removeAttribute("data-stuck");
    el.removeAttribute("data-covered");
  }

  function scan() {
    const found = new Set(root.querySelectorAll(STICKY_HEAD_SELECTOR));
    for (const [el, rec] of heads) {
      if (found.has(el)) continue;
      release(el, rec);
      heads.delete(el);
    }
    for (const el of found) {
      if (heads.has(el)) continue;
      const blur = blurOpts
        ? mountGradualBlur(el, { ...blurOpts, position: "bottom", outside: true, edgeFade: 0, zIndex: 1 })
        : null;
      heads.set(el, { blur, top: 0, page: el.classList.contains("page-head") });
      ro?.observe(el);
    }
    resolveOffset();
  }

  function measure() {
    if (options.offset !== undefined) {
      const h = offsetEl ? offsetEl.getBoundingClientRect().height : 0;
      html.style.setProperty("--sticky-top", `${Math.round(h)}px`);
    }
    let pageH = 0;
    for (const [el, rec] of heads) {
      if (rec.page && !pageH) pageH = el.getBoundingClientRect().height;
    }
    html.style.setProperty("--sticky-page-h", `${Math.round(pageH)}px`);
    // 变量写完再读各自的吸顶位置（computed top 已解析成 px）
    for (const [el, rec] of heads) rec.top = parseFloat(getComputedStyle(el).top) || 0;
  }

  function updateStuck() {
    const scrolled = window.scrollY > 0;
    let covered = false;
    let pageEl = null;
    for (const [el, rec] of heads) {
      const r = el.getBoundingClientRect();
      // 贴在吸顶线上（或正被父容器带着往上推）且还有一部分露在线下 = 吸住；页面在顶端时一律不算
      const stuck = scrolled && r.height > 0 && r.top <= rec.top + 0.5 && r.bottom > rec.top + 0.5;
      el.setAttribute("data-stuck", stuck ? "1" : "0");
      if (rec.page) pageEl ??= el;
      else if (stuck) covered = true;
    }
    if (pageEl) pageEl.toggleAttribute("data-covered", covered);
  }

  function schedule(full = false) {
    if (destroyed) return;
    if (full) dirty = true;
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      if (destroyed) return;
      if (dirty) {
        dirty = false;
        scan();
        measure();
      }
      updateStuck();
    });
  }

  const onScroll = () => schedule();
  const onResize = () => schedule(true);
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onResize);
  const mo = typeof MutationObserver === "function" ? new MutationObserver(() => schedule(true)) : null;
  mo?.observe(root, { childList: true, subtree: true });

  scan();
  measure();
  updateStuck();

  return {
    refresh() {
      schedule(true);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      mo?.disconnect();
      for (const [el, rec] of heads) release(el, rec);
      heads.clear();
      ro?.disconnect();
      html.style.removeProperty("--sticky-page-h");
      if (options.offset !== undefined) html.style.removeProperty("--sticky-top");
    },
  };
}
