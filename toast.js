/* ============================================================
   @szyyw/design · toast.js（v0.19.0：Swipe Toast）
   操作反馈 toast：视口底部居中堆叠，几秒后自己消失；下滑可关、点一下立刻关；
   卡片底边一根细「引线」随剩余时间烧短（悬停 / 按住 / 聚焦 / 标签页隐藏时暂停）。
   样子在 components.css 的 .toast-region / .toast（「interactions」段）；本模块只管 DOM 与计时。

     import { toast } from "@szyyw/design/toast";
     toast("已保存");                                   // info
     toast("保存失败：网络错误", { tone: "err", timeout: 6000 });
     toast("已删除 3 条", { title: "回收站", action: { label: "撤销", onClick: undo } });

   调用方式与语义自 v0.13.0 起不变（toast(message, { tone, timeout }) / clearToasts()）；
   外观与交互取自 React Bits「Swipe Toast」。
   出处与许可：React Bits「Swipe Toast」（https://reactbits.dev/components/swipe-toast），
   Copyright (c) 2026 David Haz，MIT + Commons Clause License Condition v1.0。
   本移植由包作者知情决定随个人站点的设计包一起发布；使用者请自行留意上游许可
   （Commons Clause：不得出售 / 再许可组件本身）。上游原件存于 reference/reactbits/（不进 package files）。

   - 区域懒创建（第一次调用时挂到 body），aria-live="polite"；err 单条用 role="alert" 立即播报
   - 同时最多留 4 条，新的进来挤掉最旧的
   - timeout: 0 = 不自动消失（也没有引线；只能点掉 / 下滑 / Esc / 调 close）
   - 卡片可聚焦（Tab），Esc 关闭；下滑超过 40px 或快速下甩即关，否则弹簧回位；上拉有阻尼
   - prefers-reduced-motion 下没有入场 / 退场 / 下滑位移动画（只淡入淡出），引线仍表示剩余时间
   - 颜色全部取自 token：ok / err / warn 用语义色，info 用 --accent
   与上游的差异：上游固定在右下角，这里沿用本包既有的底部居中区域（--toast-offset 让位底部导航）；
   上游的 fuseColor / background / width 等视觉参数由 token 与 CSS 变量（--toast-w 等）取代。
   模块顶层不碰 DOM：SSR 时被求值也不会炸。
   ============================================================ */

const TONES = ["ok", "err", "warn", "info"];
const MAX = 4;
const LEAVE_MS = 300;
const FLICK = 0.11; // px/ms，下甩速度阈值
const DEAD_ZONE = 3;
const RESIST_PX = 24;
const SVG_NS = "http://www.w3.org/2000/svg";
const ICON_PATHS = {
  ok: ['<circle cx="12" cy="12" r="9.25"/>', '<path d="M8 12.4l2.8 2.8L16.2 9.6"/>'],
  err: ['<circle cx="12" cy="12" r="9.25"/>', '<path d="M12 7.5v5.5"/>', '<path d="M12 16.6h.01"/>'],
  warn: ['<path d="M12 3.6 21.2 19.6H2.8z"/>', '<path d="M12 10v4.4"/>', '<path d="M12 17.2h.01"/>'],
  info: ['<circle cx="12" cy="12" r="9.25"/>', '<path d="M12 11v5.2"/>', '<path d="M12 7.7h.01"/>'],
};
const CLOSE_PATH = '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>';

let region = null;
const closers = new WeakMap(); // .toast 元素 → close()

function ensureRegion() {
  if (region?.isConnected) return region;
  region = document.querySelector(".toast-region");
  if (!region) {
    region = document.createElement("div");
    region.className = "toast-region";
    region.setAttribute("role", "status");
    region.setAttribute("aria-live", "polite");
    document.body.appendChild(region);
  }
  return region;
}

const reducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

function svgIcon(paths, size = 18) {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML = paths.join("");
  return svg;
}

const rubberband = (over, dim, c = 0.55) => (over * dim * c) / (dim + c * Math.abs(over));

/**
 * 弹一条 toast。
 *
 * @param {string|Node} message
 * @param {object} options
 * @param {"ok"|"err"|"warn"|"info"} options.tone  缺省 "info"
 * @param {number} options.timeout  毫秒，缺省 3000；0 = 不自动消失
 * @param {string|Node} [options.title]  有则加粗显示在 message 上方（message 变成说明行）
 * @param {{ label: string, onClick?: () => void }} [options.action]  卡片右侧的操作按钮；点了先执行 onClick 再关闭
 * @param {Node|string|false} [options.icon]  自定义图标（Node / SVG 标记字符串）；false = 不要图标
 * @param {boolean} [options.closeButton]  显示关闭按钮；缺省 false
 * @param {boolean} [options.pauseOnHover]  悬停时暂停引线；缺省 true
 * @param {(reason: "timeout"|"swipe"|"action"|"close"|"escape"|"click"|"programmatic") => void} [options.onClose]
 * @returns {{ el: HTMLElement, close(): void }}
 */
export function toast(message, options = {}) {
  const { tone = "info", timeout = 3000, title, action, icon, closeButton = false, pauseOnHover = true, onClose } = options;
  const host = ensureRegion();
  const t = TONES.includes(tone) ? tone : "info";

  // slot（折叠高度）> gate > .toast（卡片）
  const slot = document.createElement("div");
  slot.className = "toast-slot";
  const gate = document.createElement("div");
  gate.className = "toast-gate";
  const el = document.createElement("div");
  el.className = `toast ${t}`;
  el.tabIndex = 0;
  if (t === "err") el.setAttribute("role", "alert");

  if (icon !== false) {
    const ic = document.createElement("span");
    ic.className = "toast-icon";
    ic.setAttribute("aria-hidden", "true");
    if (icon instanceof Node) ic.append(icon);
    else if (typeof icon === "string") ic.innerHTML = icon;
    else ic.append(svgIcon(ICON_PATHS[t]));
    el.append(ic);
  }

  const body = document.createElement("span");
  body.className = "toast-body";
  const addText = (cls, value) => {
    const node = document.createElement("span");
    node.className = cls;
    if (value instanceof Node) node.append(value);
    else node.textContent = String(value ?? "");
    body.append(node);
  };
  if (title != null && title !== "") {
    addText("toast-title", title);
    addText("toast-text toast-desc", message);
  } else {
    addText("toast-text", message);
  }
  el.append(body);

  let closed = false;
  let reason = "timeout";
  let fuseAnim = null;
  const flags = { hover: false, interacting: false, focus: false, hidden: false };

  function syncFuse() {
    if (!fuseAnim) return;
    if (flags.hover || flags.interacting || flags.focus || flags.hidden) fuseAnim.pause();
    else if (fuseAnim.playState === "paused") fuseAnim.play();
  }

  function finalize() {
    slot.remove();
    document.removeEventListener("visibilitychange", onVisibility);
    onClose?.(reason);
  }

  function close(why = "programmatic") {
    if (closed) return;
    closed = true;
    reason = why;
    fuseAnim?.cancel();
    fuseAnim = null;
    if (reducedMotion()) {
      finalize();
      return;
    }
    el.classList.add("leaving");
    slot.classList.add("leaving");
    setTimeout(finalize, LEAVE_MS);
  }
  closers.set(el, close);

  if (action?.label) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "toast-action";
    btn.textContent = action.label;
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      try {
        action.onClick?.(e);
      } finally {
        close("action");
      }
    });
    el.append(btn);
  }
  if (closeButton) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "toast-close";
    btn.setAttribute("aria-label", "Close");
    btn.append(svgIcon([CLOSE_PATH], 12));
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      close("close");
    });
    el.append(btn);
  }

  const fuse = document.createElement("i");
  fuse.className = "toast-fuse";
  fuse.setAttribute("aria-hidden", "true");
  el.append(fuse);
  if (!(timeout > 0)) el.dataset.fuse = "none";

  // ---- 下滑关闭（鼠标 / 触屏 / 笔） ----
  let drag = null;
  let ty = 0;
  let suppressClick = false;
  const setY = (v) => {
    ty = v;
    el.style.transform = v ? `translateY(${v}px)` : "";
  };
  const velocityOf = (hist) => {
    if (hist.length < 2) return 0;
    const [t0, y0] = hist[0];
    const [t1, y1] = hist[hist.length - 1];
    return performance.now() - t1 > 100 ? 0 : (y1 - y0) / Math.max(1, t1 - t0);
  };

  el.addEventListener("pointerdown", (e) => {
    if (closed || drag || e.button !== 0 || e.target.closest("button")) return;
    try {
      el.setPointerCapture(e.pointerId);
    } catch {}
    el.getAnimations().forEach((a) => a.cancel());
    drag = { id: e.pointerId, startY: e.clientY, grab: null, moved: false, hist: [[performance.now(), ty]] };
    flags.interacting = true;
    syncFuse();
  });
  el.addEventListener("pointermove", (e) => {
    if (!drag || drag.id !== e.pointerId) return;
    if (drag.grab === null) {
      if (Math.abs(e.clientY - drag.startY) < DEAD_ZONE) return;
      drag.grab = e.clientY - ty;
      el.dataset.swiping = "";
    }
    const raw = e.clientY - drag.grab;
    const next = raw >= 0 ? raw : rubberband(raw, RESIST_PX);
    setY(next);
    drag.moved = true;
    drag.hist.push([performance.now(), next]);
    if (drag.hist.length > 4) drag.hist.shift();
  });
  const endDrag = (e) => {
    if (!drag || drag.id !== e.pointerId) return;
    const d = drag;
    drag = null;
    delete el.dataset.swiping;
    try {
      el.releasePointerCapture(e.pointerId);
    } catch {}
    flags.interacting = false;
    if (d.moved) {
      suppressClick = true; // 拖动后浏览器仍会发 click：吞掉，别当成「点一下关闭」
      setTimeout(() => (suppressClick = false), 0);
    }
    const v = velocityOf(d.hist);
    if (e.type !== "pointercancel" && ty > 0 && (v > FLICK || (ty >= 40 && v >= 0))) {
      swipeOut(ty);
      return;
    }
    if (d.moved) {
      const from = ty;
      setY(0);
      if (!reducedMotion()) {
        el.animate(
          [{ transform: `translateY(${from}px)` }, { transform: "translateY(0)" }],
          { duration: 500, easing: "cubic-bezier(0.34, 1.4, 0.64, 1)" }
        );
      }
    }
    syncFuse();
  };
  el.addEventListener("pointerup", endDrag);
  el.addEventListener("pointercancel", endDrag);

  function swipeOut(from) {
    if (closed) return;
    closed = true;
    reason = "swipe";
    fuseAnim?.cancel();
    fuseAnim = null;
    slot.classList.add("leaving");
    if (reducedMotion()) {
      finalize();
      return;
    }
    const dist = from + el.offsetHeight;
    const a = el.animate(
      [
        { transform: `translateY(${from}px)`, opacity: 1 },
        { transform: `translateY(${dist}px)`, opacity: 0 },
      ],
      { duration: 280, easing: "cubic-bezier(0.23, 1, 0.32, 1)", fill: "forwards" }
    );
    a.onfinish = finalize;
  }

  // 点一下关闭（无拖动、不是点在按钮上）
  el.addEventListener("click", (e) => {
    if (suppressClick || e.target.closest("button")) return;
    close("click");
  });
  el.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      close("escape");
    }
  });
  el.addEventListener("pointerenter", (e) => {
    if (pauseOnHover && e.pointerType === "mouse") {
      flags.hover = true;
      syncFuse();
    }
  });
  el.addEventListener("pointerleave", (e) => {
    if (e.pointerType === "mouse") {
      flags.hover = false;
      syncFuse();
    }
  });
  el.addEventListener("focusin", () => {
    flags.focus = true;
    syncFuse();
  });
  el.addEventListener("focusout", (e) => {
    if (!el.contains(e.relatedTarget)) {
      flags.focus = false;
      syncFuse();
    }
  });
  function onVisibility() {
    flags.hidden = document.hidden;
    syncFuse();
  }
  document.addEventListener("visibilitychange", onVisibility);

  gate.append(el);
  slot.append(gate);
  host.appendChild(slot);

  // 超出上限：最旧的（还没在退场的）先走
  const live = [...host.querySelectorAll(".toast:not(.leaving)")];
  for (const old of live.slice(0, Math.max(0, live.length - MAX))) closers.get(old)?.("programmatic");

  // 引线：剩余时间。到点关闭
  if (timeout > 0 && typeof el.animate === "function") {
    fuseAnim = fuse.animate([{ transform: "scaleX(1)" }, { transform: "scaleX(0)" }], {
      duration: timeout,
      easing: "linear",
      fill: "forwards",
    });
    fuseAnim.onfinish = () => close("timeout");
    flags.hidden = document.hidden;
    syncFuse();
  } else if (timeout > 0) {
    setTimeout(() => close("timeout"), timeout);
  }

  return { el, close: () => close("programmatic") };
}

/** 关掉所有 toast（如切页时） */
export function clearToasts() {
  if (!region?.isConnected) return;
  for (const el of region.querySelectorAll(".toast:not(.leaving)")) closers.get(el)?.("programmatic");
}
