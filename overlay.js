/* ============================================================
   @szyyw/design · overlay.js (v0.17.0；v0.31.0 加 dragClose)
   给 .overlay 遮罩挂「点遮罩关闭 + Esc 关闭 + body 滚动锁」。框架无关；模块顶层不碰 DOM（SSR 可 import）。

   mountOverlay(overlayEl, { onClose, lockScroll = true, dragClose }) → { destroy(), dragBy(dy), release(dy, velocity?) }

   - 关闭意图要求「按下与松开都落在遮罩本身（target === overlayEl）」：只判 click 的 target 不够——
     在输入框里按住鼠标选文字、拖到弹窗外松手时，浏览器把 click 派发到按下/松开的共同祖先（遮罩），
     会被误判成点了外面，整个弹窗就关了。
   - 嵌套多个弹层时 body 滚动锁引用计数，最后一个关闭才解锁。
   - Esc 只关最上层（最后挂载、尚未销毁的那个）。
   - 弹层本身要自己挂到 body 下（见 DESIGN.md §3）；本函数不搬动 DOM、不负责移除元素。
   - dragClose（v0.31.0）：.sheet 在 ≤899px 是底部抽屉时，从上沿（.sheet-grabber 抓手 + .sheet-head，按钮等控件除外）
     往下拖，卡片跟手、遮罩随之变淡；松手按距离（卡片高 30%，最多 200px）或速度（快速下甩）决定关闭还是弹回。
     关闭时卡片滑出屏幕后才调 onClose。宽屏（居中弹窗）下不生效。不给 dragClose 时行为与之前完全相同。
     dragBy / release 让组件把自己区域里的下滑手势接进来（例如 ./lightbox 没放大时在图上下滑）。
   ============================================================ */

let lockCount = 0;
let prevOverflow = "";
/** 已挂载的弹层栈，末尾 = 最上层 */
const stack = [];
let keyBound = false;

/** 与 components.css 里 .sheet 变成底部抽屉的断点一致 */
const DRAWER_MQ = "(max-width: 899px)";
const HANDLE_SEL = ".sheet-grabber, .sheet-head";
const INTERACTIVE = "button, a[href], input, select, textarea, label, [role='button'], [contenteditable='true']";

function onKeydown(e) {
  if (e.key !== "Escape" || e.defaultPrevented) return;
  const top = stack[stack.length - 1];
  if (!top) return;
  e.preventDefault();
  top.close();
}

function cssMs(el, name, fallback) {
  const v = getComputedStyle(el).getPropertyValue(name).trim();
  const n = parseFloat(v);
  if (!v || Number.isNaN(n)) return fallback;
  return v.endsWith("ms") ? n : n * 1000;
}

/** 底部抽屉的下拉关闭（dragClose）。返回 null 表示没找到 .sheet */
function setupDragClose(overlayEl, opts, requestClose) {
  const sheet = opts.sheet || overlayEl.querySelector(".sheet");
  if (!sheet) return null;
  const handleSel = opts.handle || HANDLE_SEL;
  sheet.setAttribute("data-drag-close", "");

  let anim = null;
  let closing = false;
  let dragging = false;
  let destroyed = false;
  let g = null; // 上沿拖动：{ id, y0, lastY, lastT, vy, moved }

  const mq = typeof matchMedia === "function" ? matchMedia(DRAWER_MQ) : null;
  const reduced = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const enabled = () => !destroyed && !closing && !!mq && mq.matches;

  /** 往上拖只给一点阻尼位移，不让卡片离开底边太多 */
  const shift = (dy) => (dy >= 0 ? dy : -Math.min(24, Math.sqrt(-dy) * 2));
  const veil = (y) => {
    const h = sheet.offsetHeight || 1;
    const k = Math.max(0, Math.min(1, 1 - Math.max(0, y) / h));
    return `color-mix(in srgb, var(--overlay-bg) ${Math.round(k * 100)}%, transparent)`;
  };

  function reset() {
    sheet.style.transform = "";
    overlayEl.style.backgroundColor = "";
    sheet.removeAttribute("data-dragging");
  }

  function dragBy(dy) {
    if (!enabled()) return false;
    if (anim) { anim.cancel(); anim = null; }
    if (!dragging) {
      dragging = true;
      sheet.setAttribute("data-dragging", "");
      // .sheet 的入场动画（fill both）会盖住行内 transform；终帧就是 none，关掉没有可见变化
      sheet.style.animation = "none";
    }
    const y = shift(dy);
    sheet.style.transform = `translateY(${y}px)`;
    overlayEl.style.backgroundColor = veil(y);
    return true;
  }

  /** 松手：返回 true 表示判定为关闭 */
  function release(dy, velocity = 0) {
    if (!dragging) return false;
    dragging = false;
    sheet.removeAttribute("data-dragging");
    const h = sheet.offsetHeight || 1;
    const y = shift(dy);
    const shouldClose = dy > Math.min(h * 0.3, 200) || (velocity > 0.5 && dy > 16);
    const dur = reduced() ? 0 : cssMs(sheet, "--dur-base", 250);
    const easing = getComputedStyle(sheet).getPropertyValue("--ease-out").trim() || "ease-out";
    const to = shouldClose ? h + 16 : 0;
    if (shouldClose) closing = true;
    const finish = () => {
      anim = null;
      if (shouldClose) {
        sheet.style.transform = `translateY(${to}px)`;
        overlayEl.style.backgroundColor = veil(h);
        requestClose();
        // onClose 没把弹层移走（应用决定不关）：复原
        requestAnimationFrame(() => {
          if (!destroyed && overlayEl.isConnected) { closing = false; reset(); }
        });
      } else reset();
    };
    if (!dur || typeof sheet.animate !== "function") { finish(); return shouldClose; }
    const opt = { duration: dur, easing, fill: "forwards" };
    anim = sheet.animate([{ transform: `translateY(${y}px)` }, { transform: `translateY(${to}px)` }], opt);
    overlayEl.animate([{ backgroundColor: veil(y) }, { backgroundColor: veil(to) }], opt);
    const a = anim;
    a.onfinish = () => {
      if (anim !== a) return;
      finish();
      a.cancel();
      overlayEl.getAnimations?.().forEach((x) => x.cancel());
    };
    return shouldClose;
  }

  const onDown = (e) => {
    if (g || !enabled() || e.button > 0) return;
    const t = e.target;
    if (!(t instanceof Element)) return;
    const zone = t.closest(handleSel);
    if (!zone || !sheet.contains(zone)) return;
    if (t.closest(INTERACTIVE)) return;
    g = { id: e.pointerId, y0: e.clientY, lastY: e.clientY, lastT: e.timeStamp, vy: 0, moved: false };
    try { sheet.setPointerCapture(e.pointerId); } catch { /* 指针已失效：不捕获也照样处理 */ }
  };
  const onMove = (e) => {
    if (!g || e.pointerId !== g.id) return;
    const dy = e.clientY - g.y0;
    if (!g.moved && Math.abs(dy) < 4) return;
    g.moved = true;
    const dt = e.timeStamp - g.lastT;
    if (dt > 0) g.vy = 0.7 * ((e.clientY - g.lastY) / dt) + 0.3 * g.vy;
    g.lastY = e.clientY;
    g.lastT = e.timeStamp;
    e.preventDefault();
    dragBy(dy);
  };
  const onUp = (e) => {
    if (!g || e.pointerId !== g.id) return;
    const cur = g;
    g = null;
    if (!cur.moved) return;
    // 停住一会儿再松手不算甩
    const vy = e.type === "pointercancel" || e.timeStamp - cur.lastT > 100 ? 0 : cur.vy;
    release(e.type === "pointercancel" ? 0 : e.clientY - cur.y0, vy);
  };
  sheet.addEventListener("pointerdown", onDown);
  sheet.addEventListener("pointermove", onMove);
  sheet.addEventListener("pointerup", onUp);
  sheet.addEventListener("pointercancel", onUp);

  return {
    dragBy,
    release,
    destroy() {
      destroyed = true;
      sheet.removeEventListener("pointerdown", onDown);
      sheet.removeEventListener("pointermove", onMove);
      sheet.removeEventListener("pointerup", onUp);
      sheet.removeEventListener("pointercancel", onUp);
      sheet.removeAttribute("data-drag-close");
      if (anim) { anim.cancel(); anim = null; }
      if (!closing) reset();
    }
  };
}

export function mountOverlay(overlayEl, options = {}) {
  const { onClose, lockScroll = true, dragClose } = options;
  let pressed = false;
  let destroyed = false;

  const onPointerDown = (e) => { pressed = e.target === overlayEl; };
  const onClick = (e) => {
    const intended = pressed && e.target === overlayEl;
    pressed = false;
    if (intended && onClose) onClose();
  };

  overlayEl.addEventListener("pointerdown", onPointerDown);
  overlayEl.addEventListener("click", onClick);

  const entry = { close: () => { if (onClose) onClose(); } };
  stack.push(entry);
  if (!keyBound) {
    document.addEventListener("keydown", onKeydown);
    keyBound = true;
  }
  if (lockScroll) {
    if (lockCount === 0) prevOverflow = document.body.style.overflow;
    lockCount += 1;
    document.body.style.overflow = "hidden";
  }

  const drag = dragClose ? setupDragClose(overlayEl, dragClose === true ? {} : dragClose, entry.close) : null;

  return {
    dragBy: (dy) => (drag && !destroyed ? drag.dragBy(dy) : false),
    release: (dy, velocity) => (drag && !destroyed ? drag.release(dy, velocity) : false),
    destroy() {
      if (destroyed) return;
      destroyed = true;
      drag?.destroy();
      overlayEl.removeEventListener("pointerdown", onPointerDown);
      overlayEl.removeEventListener("click", onClick);
      const i = stack.indexOf(entry);
      if (i >= 0) stack.splice(i, 1);
      if (!stack.length && keyBound) {
        document.removeEventListener("keydown", onKeydown);
        keyBound = false;
      }
      if (lockScroll) {
        lockCount -= 1;
        if (lockCount <= 0) {
          lockCount = 0;
          document.body.style.overflow = prevOverflow;
        }
      }
    },
  };
}
