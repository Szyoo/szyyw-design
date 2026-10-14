/* ============================================================
   @szyyw/design · target-cursor.js（v0.19.0）
   Target Cursor：四角取景框跟着鼠标转，移到可交互元素上时吸附成元素的选框，
   按下时收缩，可选在框上方显示 data-cursor-label 文字；中心一个小圆点跟手。

   出处与许可：React Bits「Target Cursor」（https://reactbits.dev/animations/target-cursor），
   Copyright (c) 2026 David Haz，MIT + Commons Clause License Condition v1.0。
   本移植由包作者知情决定随个人站点的设计包一起发布；使用者请自行留意上游许可
   （Commons Clause：不得出售 / 再许可组件本身）。上游原件存于 reference/reactbits/（不进 package files）。

     import { mountTargetCursor } from "@szyyw/design/target-cursor";
     const cursor = mountTargetCursor();          // 全页面，缺省选择器 ".cursor-target, a, button, [role=button]"
     cursor.update({ spinDuration: 4 });          // 热更新参数
     cursor.destroy();                            // 完全恢复系统光标与 DOM

   行为对齐上游：弹簧驱动（中心 / 半宽高 / 圆角 / 旋转 / 吸附 / 按压各一根弹簧），
   空闲（指针不动、已静止）不跑 rAF；reduced-motion 下不自转。
   与上游的差异：
   - 框架无关：React 组件 → 挂载函数；参数同名保留（targetSelector 另接受别名 selector）
   - 颜色只取 token：缺省 cursorColor = "var(--accent)"、吸附时渐变到 "var(--accent2)"，
     主题 / 配色 / 明暗变化时自动换色（颜色写成 CSS 变量引用，不重建）。
     blendMode 缺省 "normal"（上游缺省 difference + 白色：在浅色背景上会变得很淡）
   - 仅 `(hover: hover) and (pointer: fine)` 生效；设备条件变化时自动挂 / 卸，destroy 后无残留
   - 缺省选择器比上游宽（链接 / 按钮 / role=button 也吸附）
   模块顶层不碰 DOM：SSR 时被求值也不会炸。
   ============================================================ */

export const DEFAULTS = {
  /** 吸附目标选择器（上游缺省 ".cursor-target"） */
  targetSelector: ".cursor-target, a, button, [role=button]",
  /** 缺省态颜色：CSS 颜色或 token 引用，如 "var(--accent)" */
  cursorColor: "var(--accent)",
  /** 吸附到目标时渐变到的颜色；null = 不变色 */
  cursorColorOnTarget: "var(--accent2)",
  /** 自转一圈的秒数；0 = 不转 */
  spinDuration: 2,
  /** 吸附（弹簧）的体感时长，秒，最小 0.05 */
  hoverDuration: 0.2,
  /** 吸附时框轻微跟随指针偏移 */
  parallaxOn: true,
  /** 光标在页面内时隐藏系统光标 */
  hideDefaultCursor: true,
  /** 自由态取景框边长 px */
  size: 36,
  /** 角标臂长 px */
  cornerSize: 12,
  /** 角标线宽 px */
  thickness: 3,
  /** 吸附时框比目标外扩 px */
  padding: 6,
  /** 吸附时角标圆角跟随目标的圆角 */
  matchRadius: true,
  /** 中心圆点直径 px；0 = 不画 */
  dotSize: 4,
  /** 叠加模式，CSS mix-blend-mode */
  blendMode: "normal",
  /** 吸附目标有 data-cursor-label 时在框上方显示 */
  showLabel: true,
  /** 按下时框与圆点收缩 */
  clickEffect: true,
  /** 限定在某个元素内生效（元素或 { current }）；null = 整个页面 */
  container: null,
};

const CORNER_ANGLES = [0, 90, 180, 270];
const QUARTER = Math.PI / 2;
const STYLE_ATTR = "data-target-cursor-style";
const SCOPE_ATTR = "data-target-cursor-scope";

const CSS = `
.target-cursor{position:fixed;inset:0;z-index:2147483647;pointer-events:none}
.target-cursor__corner{position:absolute;top:0;left:0;box-sizing:border-box;border-style:solid;border-color:var(--target-cursor-color);transform-origin:0 0;will-change:transform}
.target-cursor__dot{position:absolute;top:0;left:0;border-radius:50%;background:var(--target-cursor-color);will-change:transform}
.target-cursor__label{position:absolute;top:0;left:0;color:var(--target-cursor-color);font-size:12px;font-weight:500;line-height:1;white-space:nowrap;opacity:0;will-change:transform,opacity}
`;

function spring(state, goal, stiffness, damping, dt) {
  const steps = 2;
  const h = dt / steps;
  for (let i = 0; i < steps; i++) {
    state.v += (stiffness * (goal - state.x) - damping * state.v) * h;
    state.x += state.v * h;
  }
}

const resolveElement = (value) => (value && "current" in value ? value.current : value) || null;
const clamp01 = (n) => Math.max(0, Math.min(1, n));

function normalize(opts) {
  const o = { ...DEFAULTS, ...opts };
  if (opts && opts.selector && !opts.targetSelector) o.targetSelector = opts.selector;
  o.hoverDuration = Math.max(0.05, o.hoverDuration);
  o.size = Math.max(4, o.size);
  o.cornerSize = Math.max(2, o.cornerSize);
  o.thickness = Math.max(0.5, o.thickness);
  o.dotSize = Math.max(0, o.dotSize);
  return o;
}

/**
 * 挂载 Target Cursor。
 * @param {Partial<typeof DEFAULTS> & { selector?: string }} [options]
 * @returns {{ update(options: object): void, destroy(): void }}
 */
export function mountTargetCursor(options = {}) {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return { update() {}, destroy() {} };
  }
  let settings = normalize(options);
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  const reduceMq = window.matchMedia("(prefers-reduced-motion: reduce)");
  let live = null; // 当前挂载的实例（设备不满足时为 null）
  let destroyed = false;

  function build() {
    const root = document.createElement("div");
    root.className = "target-cursor";
    root.setAttribute("aria-hidden", "true");
    root.style.opacity = "0";
    const corners = CORNER_ANGLES.map(() => {
      const c = document.createElement("span");
      c.className = "target-cursor__corner";
      root.append(c);
      return c;
    });
    const dot = document.createElement("span");
    dot.className = "target-cursor__dot";
    const label = document.createElement("span");
    label.className = "target-cursor__label";
    root.append(dot, label);

    const style = document.createElement("style");
    style.setAttribute(STYLE_ATTR, "");
    style.textContent = CSS;
    const hideStyle = document.createElement("style");
    hideStyle.setAttribute(STYLE_ATTR, "hide");
    document.head.append(style, hideStyle);
    document.body.append(root);

    const pointer = { x: 0, y: 0, inside: false, seen: false, pressed: false };
    const centerX = { x: 0, v: 0 };
    const centerY = { x: 0, v: 0 };
    const halfW = { x: 0, v: 0 };
    const halfH = { x: 0, v: 0 };
    const radius = { x: 0, v: 0 };
    const turn = { x: 0, v: 0 };
    const lock = { x: 0, v: 0 };
    const press = { x: 0, v: 0 };
    const presence = { x: 0, v: 0 };
    let target = null;
    let targetRadius = 0;
    let quarter = 0;
    let spinSpeed = 0;
    let raf = 0;
    let last = 0;
    let lastLabel = "";
    let lastColor = "";
    let lastScope = null;

    const scopeOf = () => resolveElement(settings.container);

    function hideCursor() {
      const scope = scopeOf();
      if (scope !== lastScope) {
        lastScope?.removeAttribute(SCOPE_ATTR);
        scope?.setAttribute(SCOPE_ATTR, "");
        lastScope = scope;
      }
      const selector = scope ? `[${SCOPE_ATTR}]` : "html";
      const rule = settings.hideDefaultCursor && pointer.inside ? `${selector}, ${selector} * { cursor: none !important; }` : "";
      if (hideStyle.textContent !== rule) hideStyle.textContent = rule;
    }

    function findTarget(x, y, element) {
      const node = element || document.elementFromPoint(x, y);
      let found = null;
      try {
        found = node?.closest(settings.targetSelector) || null;
      } catch {
        found = null; // 非法选择器：当作没有目标
      }
      const scope = scopeOf();
      if (found && scope && !scope.contains(found)) return null;
      return found;
    }

    function lockOn(next) {
      if (next === target) return;
      target = next;
      if (target) {
        quarter = Math.round(turn.x / QUARTER);
        targetRadius = parseFloat(getComputedStyle(target).borderTopLeftRadius) || 0;
        spinSpeed = 0;
      }
    }

    function frame(now) {
      raf = 0;
      const s = settings;
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
      last = now;

      if (target && !target.isConnected) lockOn(null);
      const rect = target ? target.getBoundingClientRect() : null;
      const locked = !!rect && pointer.inside;
      const snapW = 4.6 / s.hoverDuration;
      const snapK = snapW * snapW;
      const snapC = 2 * 0.62 * snapW;

      spring(presence, pointer.inside ? 1 : 0, 260, 32, dt);
      spring(lock, locked ? 1 : 0, snapK, 2 * snapW, dt);
      spring(press, pointer.pressed && s.clickEffect ? 1 : 0, 900, 40, dt);

      let goalX = pointer.x;
      let goalY = pointer.y;
      let goalW = s.size / 2;
      let goalH = s.size / 2;
      let goalR = Math.min(2, s.cornerSize / 4);
      if (locked) {
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const lean = s.parallaxOn ? 0.08 : 0;
        goalX = cx + (pointer.x - cx) * lean;
        goalY = cy + (pointer.y - cy) * lean;
        const odd = Math.abs(quarter) % 2 === 1;
        const w = rect.width / 2 + s.padding;
        const h = rect.height / 2 + s.padding;
        goalW = odd ? h : w;
        goalH = odd ? w : h;
        goalR = s.matchRadius ? Math.min(targetRadius + Math.max(0, s.padding), s.cornerSize) : 0;
      }

      if (!pointer.inside && presence.x < 0.01) pointer.seen = false;
      if (!pointer.seen) {
        centerX.x = goalX;
        centerY.x = goalY;
        halfW.x = goalW;
        halfH.x = goalH;
        pointer.seen = pointer.inside;
      }

      const follow = locked ? snapK : 2200;
      const followC = locked ? snapC : 2 * Math.sqrt(2200);
      spring(centerX, goalX, follow, followC, dt);
      spring(centerY, goalY, follow, followC, dt);
      spring(halfW, goalW, snapK, snapC, dt);
      spring(halfH, goalH, snapK, snapC, dt);
      spring(radius, goalR, snapK, 2 * snapW, dt);

      if (locked) {
        spring(turn, quarter * QUARTER, snapK, snapC, dt);
      } else {
        const speed = s.spinDuration > 0 && !reduceMq.matches ? (Math.PI * 2) / s.spinDuration : 0;
        spinSpeed += (speed - spinSpeed) * (1 - Math.exp(-dt * 3));
        turn.v = spinSpeed;
        turn.x += spinSpeed * dt;
      }

      const squeeze = 1 - press.x * 0.14;
      const cos = Math.cos(turn.x);
      const sin = Math.sin(turn.x);
      const w = Math.max(0, halfW.x) * squeeze;
      const h = Math.max(0, halfH.x) * squeeze;
      const local = [[-w, -h], [w, -h], [w, h], [-w, h]];
      const r = Math.max(0, Math.min(radius.x, s.cornerSize));
      const degrees = (turn.x * 180) / Math.PI;
      let left = Infinity;
      let top = Infinity;
      corners.forEach((corner, i) => {
        const [lx, ly] = local[i];
        const x = centerX.x + lx * cos - ly * sin;
        const y = centerY.x + lx * sin + ly * cos;
        left = Math.min(left, x);
        top = Math.min(top, y);
        corner.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) rotate(${(CORNER_ANGLES[i] + degrees).toFixed(2)}deg)`;
        corner.style.width = `${s.cornerSize}px`;
        corner.style.height = `${s.cornerSize}px`;
        corner.style.borderWidth = `${s.thickness}px 0 0 ${s.thickness}px`;
        corner.style.borderTopLeftRadius = `${r.toFixed(2)}px`;
      });

      const dotScale = 1 - press.x * 0.35;
      dot.style.transform = `translate3d(${pointer.x}px, ${pointer.y}px, 0) translate(-50%, -50%) scale(${dotScale.toFixed(3)})`;
      dot.style.width = `${s.dotSize}px`;
      dot.style.height = `${s.dotSize}px`;

      const text = s.showLabel && target ? target.getAttribute("data-cursor-label") || "" : "";
      if (text && text !== lastLabel) label.textContent = text;
      if (text) lastLabel = text;
      const shown = text ? clamp01(lock.x) : 0;
      label.style.transform = `translate3d(${left.toFixed(2)}px, ${(top - 8).toFixed(2)}px, 0) translateY(-100%) translateY(${((1 - shown) * 4).toFixed(2)}px)`;
      label.style.opacity = shown.toFixed(3);

      const mix = s.cursorColorOnTarget ? Math.round(clamp01(lock.x) * 100) : 0;
      const color = mix ? `color-mix(in oklab, ${s.cursorColorOnTarget} ${mix}%, ${s.cursorColor})` : s.cursorColor;
      if (color !== lastColor) {
        root.style.setProperty("--target-cursor-color", color);
        lastColor = color;
      }
      root.style.mixBlendMode = s.blendMode;
      root.style.opacity = clamp01(presence.x).toFixed(3);

      const resting =
        !pointer.inside &&
        presence.x < 0.002 &&
        Math.abs(presence.v) < 0.002 &&
        Math.abs(lock.x) < 0.002 &&
        Math.abs(press.x) < 0.002;
      const spinning = pointer.inside && !locked && spinSpeed > 0.0001;
      const moving =
        Math.abs(centerX.v) + Math.abs(centerY.v) + Math.abs(halfW.v) + Math.abs(halfH.v) + Math.abs(turn.v) > 0.01 ||
        Math.abs(goalX - centerX.x) + Math.abs(goalY - centerY.x) > 0.05 ||
        Math.abs(lock.v) + Math.abs(press.v) + Math.abs(presence.v) > 0.001;
      if (!resting && (spinning || moving || locked)) raf = requestAnimationFrame(frame);
      else last = 0;
    }

    const wake = () => {
      if (!raf) raf = requestAnimationFrame(frame);
    };

    function insideScope(x, y, element) {
      const scope = scopeOf();
      if (!scope) return true;
      if (element && scope.contains(element)) return true;
      const box = scope.getBoundingClientRect();
      return x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
    }

    const onPointerMove = (event) => {
      if (event.pointerType && event.pointerType !== "mouse") return;
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      const inside = insideScope(pointer.x, pointer.y, event.target);
      if (inside !== pointer.inside) {
        pointer.inside = inside;
        hideCursor();
      }
      lockOn(inside ? findTarget(pointer.x, pointer.y, event.target) : null);
      wake();
    };
    const onPointerDown = (event) => {
      if (event.pointerType && event.pointerType !== "mouse") return;
      pointer.pressed = true;
      wake();
    };
    const onPointerUp = () => {
      pointer.pressed = false;
      wake();
    };
    const onLeave = () => {
      pointer.inside = false;
      pointer.pressed = false;
      lockOn(null);
      hideCursor();
      wake();
    };
    const onScroll = () => {
      if (!pointer.inside) return;
      lockOn(findTarget(pointer.x, pointer.y));
      wake();
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    window.addEventListener("pointerup", onPointerUp, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true, capture: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    window.addEventListener("blur", onLeave);

    return {
      refresh() {
        hideCursor();
        wake();
      },
      destroy() {
        cancelAnimationFrame(raf);
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerdown", onPointerDown);
        window.removeEventListener("pointerup", onPointerUp);
        window.removeEventListener("scroll", onScroll, { capture: true });
        document.documentElement.removeEventListener("pointerleave", onLeave);
        window.removeEventListener("blur", onLeave);
        lastScope?.removeAttribute(SCOPE_ATTR);
        style.remove();
        hideStyle.remove();
        root.remove();
      },
    };
  }

  function sync() {
    if (destroyed) return;
    if (finePointer.matches && !live) live = build();
    else if (!finePointer.matches && live) {
      live.destroy();
      live = null;
    }
  }
  finePointer.addEventListener("change", sync);
  sync();

  return {
    update(next = {}) {
      settings = normalize({ ...settings, ...next });
      live?.refresh();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      finePointer.removeEventListener("change", sync);
      live?.destroy();
      live = null;
    },
  };
}
