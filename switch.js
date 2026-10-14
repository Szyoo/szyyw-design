/* ============================================================
   @szyyw/design · switch.js
   .switch 的渐进增强：拖动滑块时按速度拉伸、松手挤压回弹（Squish Switch 的手感）。
   出处：React Bits Squish Switch（David Haz），MIT + Commons Clause。

   不挂本模块时 .switch 也有动效（按下压扁、滑动带回弹、颜色渐变，纯 CSS）；
   挂上之后多出：指针拖动滑块（跟手）、拖动时按速度横向拉伸、松手按速度回弹。

     import { enhanceSwitches } from "@szyyw/design/switch";
     const stop = enhanceSwitches();            // 处理文档里所有 input.switch
     enhanceSwitches(container, { stretch: 50 });
     stop();                                    // 解除（还原内联变量与监听）

   语义与原生 checkbox 完全一致：点击 / 键盘 / label / 表单提交 / reset 都是浏览器原生；
   拖动结束时只在「落点与当前状态不同」才通过 el.click() 切换，所以 click / input / change
   事件、React 受控组件、form 数据都照常。拖动过程不触发任何事件。
   选项（也可写在元素上：data-stretch / data-hover-scale / data-speed / data-color-duration /
   data-width / data-height / data-radius，元素上的优先）：
     stretch        0–100，缺省 36   拖动拉伸强度（上游同名）；reduced-motion 下为 0
     hoverScale     缺省 1.035       悬停时滑块膨胀（写入 --sw-hover）
     speed          0–100，缺省 50   滑动时长（写入 --sw-dur；越大越快）
     colorDuration  ms，缺省 200     颜色渐变（写入 --sw-fade）
     width / height / radius  px     几何（写入 --sw-w / --sw-h / --sw-r）
   模块顶层不碰 DOM。
   ============================================================ */

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const MAX_STRETCH = 0.4;
const STRETCH_SPEED = 0.6; // px/ms：到这个速度时拉伸达到上限
const HELD = 1.14; // 按住时滑块的基础横向放大
const SLOP = { mouse: 4, touch: 8 };

const num = (v) => (v == null || v === "" ? undefined : Number(v));

function readOptions(el, base) {
  const d = el.dataset;
  return {
    stretch: num(d.stretch) ?? base.stretch ?? 36,
    hoverScale: num(d.hoverScale) ?? base.hoverScale,
    speed: num(d.speed) ?? base.speed,
    colorDuration: num(d.colorDuration) ?? base.colorDuration,
    width: num(d.width) ?? base.width,
    height: num(d.height) ?? base.height,
    radius: num(d.radius) ?? base.radius
  };
}

function applyVars(el, o) {
  const set = (k, v) => v !== undefined && !Number.isNaN(v) && el.style.setProperty(k, v);
  set("--sw-w", o.width !== undefined ? `${o.width}px` : undefined);
  set("--sw-h", o.height !== undefined ? `${o.height}px` : undefined);
  set("--sw-r", o.radius !== undefined ? `${o.radius}px` : undefined);
  set("--sw-hover", o.hoverScale);
  set("--sw-dur", o.speed !== undefined ? `${Math.round(600 - clamp(o.speed, 0, 100) * 4.8)}ms` : undefined);
  set("--sw-fade", o.colorDuration !== undefined ? `${o.colorDuration}ms` : undefined);
}
const VARS = ["--sw-w", "--sw-h", "--sw-r", "--sw-hover", "--sw-dur", "--sw-fade", "--sw-x", "--sw-sx", "--sw-sy"];

function enhanceOne(el, base) {
  const opts = readOptions(el, base);
  applyVars(el, opts);
  const reduceMq = typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null;

  let grip = null; // { id, startX, moved, grab, slop, x, last, lastT, v, flow, raf }
  let pending = null;
  let pendingTimer = 0;

  const geom = () => {
    const cs = getComputedStyle(el);
    const w = parseFloat(cs.getPropertyValue("--sw-w")) || el.offsetWidth;
    const h = parseFloat(cs.getPropertyValue("--sw-h")) || el.offsetHeight;
    const inset = parseFloat(cs.getPropertyValue("--sw-inset")) || 3;
    const thumb = h - inset * 2;
    return { travel: Math.max(1, w - h), thumb, inset };
  };

  function paint(g, gm) {
    const gain = reduceMq?.matches ? 0 : clamp(opts.stretch, 0, 100) / 100;
    const flow = g.flow;
    const sx = (1 + Math.min(MAX_STRETCH, Math.abs(flow) / STRETCH_SPEED) * gain) * HELD;
    // 前缘不动、尾部被拉长：中心向运动反方向让出
    const dir = Math.sign(flow) || 0;
    const shift = -dir * (sx - 1) * gm.thumb * 0.5 * 0.5;
    el.style.setProperty("--sw-x", `${clamp(g.x + shift, -2, gm.travel + 2)}px`);
    el.style.setProperty("--sw-sx", sx.toFixed(3));
    el.style.setProperty("--sw-sy", (0.92 / (1 + (sx / HELD - 1) * 0.6)).toFixed(3));
  }

  function loop(g, gm) {
    // 速度平滑 + 指针静止时衰减
    const now = performance.now();
    if (now - g.lastT > 60) g.v *= 0.8;
    g.flow += (g.v - g.flow) * 0.25;
    paint(g, gm);
    g.raf = requestAnimationFrame(() => loop(g, gm));
  }

  function release(cancelled) {
    const g = grip;
    if (!g) return;
    grip = null;
    cancelAnimationFrame(g.raf);
    try {
      el.releasePointerCapture(g.id);
    } catch {}
    if (g.moved) document.documentElement.style.userSelect = g.prevSelect;
    const target = cancelled ? g.onAtPress : g.x > g.gm.travel / 2;
    // 松手：一次性去掉跟手状态与内联变量，CSS 过渡（带过冲缓动）把位置与拉伸一起收到目标
    el.classList.remove("is-dragging");
    el.style.removeProperty("--sw-x");
    el.style.removeProperty("--sw-sx");
    el.style.removeProperty("--sw-sy");
    if (!g.moved) return; // 纯点击：交给原生
    // 拖动后浏览器照常会补一个 click：落点与点击后的状态一致就放行（原生切换，事件只有这一次），
    // 不一致就拦掉（preventDefault 还原）；没等到 click 时由定时器补一次 el.click()
    pending = { target };
    clearTimeout(pendingTimer);
    pendingTimer = setTimeout(() => {
      const p = pending;
      pending = null;
      if (p && p.target !== el.checked) el.click();
    }, 60);
  }

  function onDown(e) {
    if (el.disabled || grip || e.button !== 0) return;
    const gm = geom();
    grip = {
      id: e.pointerId,
      startX: e.clientX,
      moved: false,
      grab: 0,
      slop: e.pointerType === "touch" ? SLOP.touch : SLOP.mouse,
      onAtPress: el.checked,
      gm,
      x: el.checked ? gm.travel : 0,
      lastT: performance.now(),
      v: 0,
      flow: 0,
      raf: 0,
      prevSelect: ""
    };
  }

  const localX = (clientX) => {
    const rect = el.getBoundingClientRect();
    const scale = rect.width / (el.offsetWidth || rect.width) || 1;
    return (clientX - rect.left) / scale;
  };

  function onMove(e) {
    const g = grip;
    if (!g || g.id !== e.pointerId) return;
    const half = g.gm.inset + g.gm.thumb / 2;
    if (!g.moved) {
      if (Math.abs(e.clientX - g.startX) <= g.slop) return;
      g.moved = true;
      try {
        el.setPointerCapture(e.pointerId);
      } catch {}
      el.classList.add("is-dragging");
      g.prevSelect = document.documentElement.style.userSelect;
      document.documentElement.style.userSelect = "none";
      getSelection?.()?.removeAllRanges();
      // 抓取点：指针相对滑块中心的偏移，拖动时保持（抓在边上就不会跳）
      g.grab = clamp(localX(g.startX) - (half + g.x), -half, half);
      g.lastT = performance.now();
      g.raf = requestAnimationFrame(() => loop(g, g.gm));
    }
    const nx = clamp(localX(e.clientX) - g.grab - half, 0, g.gm.travel);
    const now = performance.now();
    const dt = Math.max(1, now - g.lastT);
    g.v = (nx - g.x) / dt;
    g.x = nx;
    g.lastT = now;
    paint(g, g.gm);
  }

  const onUp = (e) => {
    if (grip && grip.id === e.pointerId) release(false);
  };
  const onCancel = (e) => {
    if (grip && grip.id === e.pointerId) release(true);
  };
  const onKey = (e) => {
    if (e.key === "Escape" && grip?.moved) release(true);
  };
  const onClick = (e) => {
    if (!pending) return;
    const p = pending;
    pending = null;
    clearTimeout(pendingTimer);
    // 此时原生已把 checked 翻转；翻出来不是落点就拦下（preventDefault 会翻回去）
    if (el.checked !== p.target) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  };

  el.addEventListener("pointerdown", onDown);
  el.addEventListener("pointermove", onMove);
  el.addEventListener("pointerup", onUp);
  el.addEventListener("pointercancel", onCancel);
  el.addEventListener("keydown", onKey);
  el.addEventListener("click", onClick, true);

  return () => {
    clearTimeout(pendingTimer);
    pending = null;
    if (grip) release(true);
    el.removeEventListener("pointerdown", onDown);
    el.removeEventListener("pointermove", onMove);
    el.removeEventListener("pointerup", onUp);
    el.removeEventListener("pointercancel", onCancel);
    el.removeEventListener("keydown", onKey);
    el.removeEventListener("click", onClick, true);
    el.classList.remove("is-dragging");
    for (const k of VARS) el.style.removeProperty(k);
  };
}

const done = new WeakMap();

/**
 * 给 root（缺省 document）里所有 input.switch 挂上拖动 / 拉伸增强。已挂过的跳过。
 * 之后新增的开关不会自动处理（再调一次即可；MutationObserver 由调用方按需自接）。
 * @returns {() => void} 解除本次挂上的所有开关
 */
export function enhanceSwitches(root = document, options = {}) {
  if (typeof document === "undefined") return () => {};
  const scope = root || document;
  const list = [];
  const pick = scope.matches?.("input.switch") ? [scope] : [];
  pick.push(...scope.querySelectorAll("input.switch"));
  for (const el of pick) {
    if (done.has(el)) continue;
    const off = enhanceOne(el, options);
    done.set(el, off);
    list.push(el);
  }
  return () => {
    for (const el of list) {
      done.get(el)?.();
      done.delete(el);
    }
  };
}
