/* ============================================================
   @szyyw/design · overlay.js (v0.17.0)
   给 .overlay 遮罩挂「点遮罩关闭 + Esc 关闭 + body 滚动锁」。框架无关；模块顶层不碰 DOM（SSR 可 import）。

   mountOverlay(overlayEl, { onClose, lockScroll = true }) → { destroy() }

   - 关闭意图要求「按下与松开都落在遮罩本身（target === overlayEl）」：只判 click 的 target 不够——
     在输入框里按住鼠标选文字、拖到弹窗外松手时，浏览器把 click 派发到按下/松开的共同祖先（遮罩），
     会被误判成点了外面，整个弹窗就关了。
   - 嵌套多个弹层时 body 滚动锁引用计数，最后一个关闭才解锁。
   - Esc 只关最上层（最后挂载、尚未销毁的那个）。
   - 弹层本身要自己挂到 body 下（见 DESIGN.md §3）；本函数不搬动 DOM、不负责移除元素。
   ============================================================ */

let lockCount = 0;
let prevOverflow = "";
/** 已挂载的弹层栈，末尾 = 最上层 */
const stack = [];
let keyBound = false;

function onKeydown(e) {
  if (e.key !== "Escape" || e.defaultPrevented) return;
  const top = stack[stack.length - 1];
  if (!top) return;
  e.preventDefault();
  top.close();
}

export function mountOverlay(overlayEl, options = {}) {
  const { onClose, lockScroll = true } = options;
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

  return {
    destroy() {
      if (destroyed) return;
      destroyed = true;
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
