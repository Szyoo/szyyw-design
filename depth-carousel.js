/* ============================================================
   @szyyw/design · depth-carousel.js（v0.24.0：Depth Carousel）
   纵深轮播：当前卡片在最前，其余卡片沿斜后方层层退远（变暗、模糊、倾斜）。
   拖动（鼠标 / 触摸）、键盘 ← → Home End、左右按钮、底部圆点、横向滚轮、可选自动轮播。
   主要用途：应用里点开照片时，在 .overlay + .sheet.wide 弹层里看图（DESIGN.md §16「Depth Carousel」）。

     import { mountDepthCarousel } from "@szyyw/design/depth-carousel";
     const dc = mountDepthCarousel(el, {
       items: ["a.jpg", { image: "b.jpg", alt: "收据" }],
       start: 2,
       cardWidth: "auto", cardHeight: "auto", aspect: 3 / 4,   // 按容器宽高自适应
       onChange: (i) => { counter.textContent = `${i + 1} / ${dc.count}`; },
     });
     dc.next(); dc.goTo(0); dc.destroy();

   出处与许可：React Bits「Depth Carousel」（https://reactbits.dev/components/depth-carousel），
   Copyright (c) 2026 David Haz，MIT + Commons Clause License Condition v1.0。
   本移植由包作者知情决定随个人站点的设计包一起发布；使用者请自行留意上游许可
   （Commons Clause：不得出售 / 再许可组件本身）。上游原件存于 reference/reactbits/（不进 package files）。

   与上游的差异：
   - 框架无关、零依赖：gsap 补间 → 自写 rAF 补间，只在动画进行中跑帧，空闲不空跑；
     ease 认 gsap 常用名（缺省 "power3.out"）、"cubic-bezier(a, b, c, d)" 或函数。
   - 上游参数全部保留（showControls / showIndicators 改名 controls / indicators，旧名也认）；
     tint 缺省取 var(--bg)（上游写死 #05060a），颜色全部来自 token，明暗 / 配色切换即时生效。
     浅色底色时不再按 falloff 压暗（压暗会让后排卡片发灰），只靠 tint 叠层向底色淡出。
   - 尺寸：上游按容器宽度整体 scale() 缩小；这里改为直接算卡片像素尺寸（图片不被放大糊掉），
     cardWidth / cardHeight 可为 "auto"：按容器宽高与比例（aspect）放大或缩小填满。
   - 大量图片时只创建可见范围附近的卡片（图片随之按需加载）；加载中 / 失败有占位。
   - 滚轮缺省只认横向（触控板左右扫），不挡页面 / 弹层的纵向滚动；wheel: true 恢复上游的纵横都认。
   - 拖动先判方向：纵向手势交给浏览器（touch-action: pan-y），不挡滚动与弹层手势。
   - a11y：role="region" + aria-roledescription="carousel"、每张 aria-label="3 / 8"、
     当前项变化经 aria-live="polite" 播报（自动轮播进行中关闭播报，不打扰）；按钮有 label；文案 zh / ja / en。
   - 自动轮播在悬停 / 拖动 / 聚焦 / 标签页隐藏时暂停；prefers-reduced-motion 下不自动轮播、切换无动画。
   模块顶层不碰 DOM：SSR 时被求值也不会炸。
   ============================================================ */

export const DEFAULTS = Object.freeze({
  items: [],
  start: 0,
  cardWidth: 300,
  cardHeight: 380,
  aspect: undefined,
  radius: 18,
  tint: undefined,
  depth: 220,
  spread: 90,
  tilt: 22,
  tiltDirection: "right",
  perspective: 1400,
  visibleCards: 4,
  falloff: 0.2,
  blur: 6,
  duration: 700,
  ease: "power3.out",
  autoplay: false,
  autoplayDelay: 3200,
  loop: true,
  controls: true,
  indicators: true,
  maxIndicators: 24,
  fit: "contain",
  wheel: "horizontal",
  keyboard: true,
  locale: "zh",
  labels: undefined,
  label: undefined,
  onChange: undefined,
  className: "",
});

const TEXTS = {
  zh: {
    region: "图片轮播", roledescription: "轮播", slide: "幻灯片",
    prev: "上一张", next: "下一张", dots: "选择图片", goTo: (n) => `第 ${n} 张`,
    counter: (i, n) => `${i} / ${n}`, loading: "加载中", error: "加载失败",
  },
  ja: {
    region: "画像カルーセル", roledescription: "カルーセル", slide: "スライド",
    prev: "前へ", next: "次へ", dots: "画像を選択", goTo: (n) => `${n} 枚目`,
    counter: (i, n) => `${i} / ${n}`, loading: "読み込み中", error: "読み込みに失敗しました",
  },
  en: {
    region: "Image carousel", roledescription: "carousel", slide: "slide",
    prev: "Previous", next: "Next", dots: "Choose image", goTo: (n) => `Go to image ${n}`,
    counter: (i, n) => `${i} / ${n}`, loading: "Loading", error: "Failed to load",
  },
};

/* ---------- 缓动 ---------- */

const powerOut = (p) => (t) => 1 - Math.pow(1 - t, p);
const powerIn = (p) => (t) => Math.pow(t, p);
const inOut = (fin) => (t) => (t < 0.5 ? fin(t * 2) / 2 : 1 - fin((1 - t) * 2) / 2);
const BASE = {
  power1: 2, quad: 2, power2: 3, cubic: 3, power3: 4, quart: 4, power4: 5, quint: 5, strong: 5,
};
const SPECIAL = {
  sine: (t) => 1 - Math.cos((t * Math.PI) / 2),
  expo: (t) => (t === 0 ? 0 : Math.pow(2, 10 * (t - 1))),
  circ: (t) => 1 - Math.sqrt(1 - t * t),
};

/** cubic-bezier(x1, y1, x2, y2) → (t) => y（牛顿迭代 + 二分兜底） */
export function cubicBezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (u) => ((ax * u + bx) * u + cx) * u;
  const sy = (u) => ((ay * u + by) * u + cy) * u;
  const dx = (u) => (3 * ax * u + 2 * bx) * u + cx;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let u = x;
    for (let i = 0; i < 8; i++) {
      const e = sx(u) - x;
      if (Math.abs(e) < 1e-6) return sy(u);
      const d = dx(u);
      if (Math.abs(d) < 1e-6) break;
      u -= e / d;
    }
    let lo = 0, hi = 1;
    u = x;
    for (let i = 0; i < 30; i++) {
      const v = sx(u);
      if (Math.abs(v - x) < 1e-6) break;
      if (v < x) lo = u; else hi = u;
      u = (lo + hi) / 2;
    }
    return sy(u);
  };
}

/** gsap 常用名（"power3.out" / "sine.inOut" / "none" …）、"cubic-bezier(…)" 或函数 → 缓动函数；认不出时回落 power3.out */
export function resolveEase(ease) {
  if (typeof ease === "function") return ease;
  const s = String(ease ?? "").trim();
  const m = /^cubic-bezier\(([^)]+)\)$/i.exec(s);
  if (m) {
    const v = m[1].split(",").map(Number);
    if (v.length === 4 && v.every(Number.isFinite)) return cubicBezier(v[0], v[1], v[2], v[3]);
  }
  if (s === "none" || s === "linear") return (t) => t;
  const [name, kind = "out"] = s.split(".");
  let fin = null;
  if (BASE[name]) fin = powerIn(BASE[name]);
  else if (SPECIAL[name]) fin = SPECIAL[name];
  if (!fin) return powerOut(4);
  if (kind === "in") return fin;
  if (kind === "inOut") return inOut(fin);
  return (t) => 1 - fin(1 - t);
}

/* ---------- 工具 ---------- */

const SVG_NS = "http://www.w3.org/2000/svg";
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
const mod = (v, n) => ((v % n) + n) % n;
const normalizeItem = (it) =>
  typeof it === "string" ? { image: it, alt: "" } : { image: String(it?.image ?? ""), alt: it?.alt ?? "" };
const reducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

function svgIcon(d) {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", "20");
  svg.setAttribute("height", "20");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", d);
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "currentColor");
  path.setAttribute("stroke-width", "2");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");
  svg.appendChild(path);
  return svg;
}

/** getComputedStyle 的颜色串 → 相对亮度（0–1）；解析不了返回 null */
function luminanceOf(color) {
  const m = /^rgba?\(([^)]+)\)$/.exec(color) || /^color\(srgb ([^)]+)\)$/.exec(color);
  if (!m) return null;
  const parts = m[1].replace(/\//g, " ").split(/[\s,]+/).filter(Boolean).map(Number);
  if (parts.length < 3 || parts.slice(0, 3).some((v) => !Number.isFinite(v))) return null;
  const scale = color.startsWith("color(") ? 1 : 255;
  const [r, g, b] = parts.slice(0, 3).map((v) => {
    const c = v / scale;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/* ---------- 主体 ---------- */

export function mountDepthCarousel(el, options = {}) {
  if (!el || typeof el.appendChild !== "function") throw new TypeError("mountDepthCarousel: 需要一个元素");
  const o = { ...DEFAULTS, ...options };
  if (options.showControls !== undefined && options.controls === undefined) o.controls = options.showControls;
  if (options.showIndicators !== undefined && options.indicators === undefined) o.indicators = options.showIndicators;
  const t = { ...(TEXTS[o.locale] || TEXTS.zh), ...(o.labels || {}) };
  const ease = resolveEase(o.ease);
  const auto = o.cardWidth === "auto" || o.cardHeight === "auto";

  let data = (Array.isArray(o.items) ? o.items : []).map(normalizeItem);
  let n = data.length;

  /* ---- 根元素：记下原有属性，destroy 时还原 ---- */
  const ATTRS = ["role", "aria-roledescription", "aria-label", "tabindex"];
  const prevAttrs = ATTRS.map((a) => [a, el.getAttribute(a)]);
  const prevStyle = el.getAttribute("style");
  const prevClass = el.getAttribute("class");
  const addedClasses = ["depth-carousel", ...String(o.className || "").split(/\s+/).filter(Boolean)]
    .filter((c) => !el.classList.contains(c));
  el.classList.add(...addedClasses);
  if (auto) el.classList.add("is-auto");
  el.setAttribute("role", "region");
  el.setAttribute("aria-roledescription", t.roledescription);
  el.setAttribute("aria-label", o.label || t.region);
  if (o.keyboard) el.setAttribute("tabindex", "0");
  if (o.tint) el.style.setProperty("--dc-tint", o.tint.startsWith("--") ? `var(${o.tint})` : o.tint);
  if (o.fit === "cover") el.style.setProperty("--dc-fit", "cover");

  const stage = document.createElement("div");
  stage.className = "depth-carousel__stage";
  const live = document.createElement("span");
  live.className = "depth-carousel__live";
  live.setAttribute("aria-live", "polite");
  live.setAttribute("aria-atomic", "true");
  el.append(stage, live);

  let prevBtn = null, nextBtn = null, dotsWrap = null, dots = [];

  function buildChrome() {
    prevBtn?.remove(); nextBtn?.remove(); dotsWrap?.remove();
    prevBtn = nextBtn = dotsWrap = null;
    dots = [];
    if (o.controls && n > 1) {
      prevBtn = document.createElement("button");
      prevBtn.type = "button";
      prevBtn.className = "depth-carousel__arrow depth-carousel__arrow--prev";
      prevBtn.setAttribute("aria-label", t.prev);
      prevBtn.appendChild(svgIcon("M15 5l-7 7 7 7"));
      prevBtn.addEventListener("click", () => navigateBy(-1));
      nextBtn = document.createElement("button");
      nextBtn.type = "button";
      nextBtn.className = "depth-carousel__arrow depth-carousel__arrow--next";
      nextBtn.setAttribute("aria-label", t.next);
      nextBtn.appendChild(svgIcon("M9 5l7 7-7 7"));
      nextBtn.addEventListener("click", () => navigateBy(1));
      el.append(prevBtn, nextBtn);
    }
    if (o.indicators && n > 1 && n <= o.maxIndicators) {
      dotsWrap = document.createElement("div");
      dotsWrap.className = "depth-carousel__dots";
      dotsWrap.setAttribute("role", "group");
      dotsWrap.setAttribute("aria-label", t.dots);
      for (let i = 0; i < n; i++) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "depth-carousel__dot";
        b.setAttribute("aria-label", t.goTo(i + 1));
        b.addEventListener("click", () => setFocus(i, true));
        dots.push(b);
        dotsWrap.appendChild(b);
      }
      el.appendChild(dotsWrap);
    }
    el.classList.toggle("has-dots", !!dotsWrap);
  }

  /* ---- 状态 ---- */
  let pos = 0;          // 连续位置（补间 / 拖动中为小数）
  let focus = 0;        // 当前项
  let k = 1;            // 尺寸单位：实际像素 = 设计参数 × k
  let tintLight = false;
  let raf = 0;
  let tween = null;
  let destroyed = false;
  const cards = new Map(); // index → { el, tintEl, img }

  const refW = () => (typeof o.cardWidth === "number" ? o.cardWidth : 300);
  const refH = () => {
    if (o.aspect > 0) return refW() / o.aspect;
    return typeof o.cardHeight === "number" ? o.cardHeight : 380;
  };

  function measure() {
    const w = el.clientWidth, h = el.clientHeight;
    if (!w) return;
    const rw = refW(), rh = refH();
    if (auto) {
      const reserve = dotsWrap ? 48 : 12;
      el.style.setProperty("--dc-reserve", `${reserve}px`);
      const kw = (w - 16) / (rw + Math.abs(o.spread) * 0.75);
      const kh = h ? (h - reserve - 12) / rh : kw;
      k = Math.max(0.2, Math.min(kw, kh));
    } else {
      k = clamp(w / (rw + Math.abs(o.spread) * 2 + 120), 0.4, 1);
    }
    el.style.setProperty("--dc-w", `${(rw * k).toFixed(2)}px`);
    el.style.setProperty("--dc-h", `${(rh * k).toFixed(2)}px`);
    el.style.setProperty("--dc-radius", `${(o.radius * k).toFixed(2)}px`);
    el.style.setProperty("--dc-perspective", `${(o.perspective * k).toFixed(1)}px`);
  }

  function readTint() {
    const lum = luminanceOf(getComputedStyle(stage).color);
    tintLight = lum !== null && lum > 0.4;
  }

  function createCard(i) {
    const item = data[i];
    const card = document.createElement("div");
    card.className = "depth-carousel__card";
    card.setAttribute("role", "group");
    card.setAttribute("aria-roledescription", t.slide);
    card.setAttribute("aria-label", t.counter(i + 1, n));
    card.dataset.state = "loading";
    const img = document.createElement("img");
    img.className = "depth-carousel__img";
    img.alt = item.alt || "";
    img.draggable = false;
    img.decoding = "async";
    const msg = document.createElement("span");
    msg.className = "depth-carousel__msg";
    msg.setAttribute("aria-hidden", "true");
    msg.textContent = t.loading;
    const tintEl = document.createElement("span");
    tintEl.className = "depth-carousel__tint";
    const settle = (ok) => {
      card.dataset.state = ok ? "loaded" : "error";
      msg.textContent = ok ? "" : t.error;
      if (!ok) msg.prepend(svgIcon("M4 5h16v14H4zM4 15l4.5-4.5 4 4L15 12l5 5M15.5 8.5h.01"));
    };
    img.addEventListener("load", () => settle(true), { once: true });
    img.addEventListener("error", () => settle(false), { once: true });
    img.src = item.image;
    card.append(img, msg, tintEl);
    card.addEventListener("click", () => {
      if (suppressClick) return;
      if (i !== focus) setFocus(i, true);
    });
    stage.appendChild(card);
    const rec = { el: card, tintEl };
    cards.set(i, rec);
    return rec;
  }

  function layout(p) {
    if (!n) return;
    const dir = o.tiltDirection === "left" ? -1 : 1;
    const vis = o.visibleCards;
    const keep = new Set();
    for (let i = 0; i < n; i++) {
      let d = i - p;
      if (o.loop && n > 1) {
        d = mod(d, n);
        if (d > n / 2) d -= n;
      }
      if (d <= -1.5 || d >= vis + 1.5) continue;
      keep.add(i);
      const rec = cards.get(i) || createCard(i);
      const card = rec.el;
      const back = Math.max(0, d);
      const shown = Math.abs(d) <= vis + 0.5;
      const tz = -o.depth * k * d;
      const tx = dir * o.spread * k * d;
      const ry = dir * o.tilt * clamp(d, 0, 1);
      let opacity = d < 0 ? Math.max(0, 1 + d) : 1;
      if (!shown) opacity = 0;
      const brightness = tintLight ? 1 : Math.max(0.15, 1 - back * o.falloff);
      const blurPx = o.blur > 0 ? Math.min(o.blur, (back / Math.max(1, vis)) * o.blur) : 0;
      card.style.transform =
        `translate(-50%, -50%) translate3d(${tx.toFixed(2)}px, 0, ${tz.toFixed(2)}px) rotateY(${ry.toFixed(3)}deg)`;
      card.style.opacity = opacity.toFixed(3);
      card.style.filter = `brightness(${brightness.toFixed(3)}) blur(${blurPx.toFixed(2)}px)`;
      card.style.zIndex = String(Math.round(2000 - d * 20));
      card.style.pointerEvents = shown && opacity > 0.05 ? "auto" : "none";
      rec.tintEl.style.opacity = clamp(back * o.falloff * 1.25, 0, 0.86).toFixed(3);
      const active = i === focus;
      if (active) card.removeAttribute("aria-hidden");
      else card.setAttribute("aria-hidden", "true");
      card.classList.toggle("is-active", active);
    }
    for (const [i, rec] of cards) {
      if (!keep.has(i)) {
        rec.el.remove();
        cards.delete(i);
      }
    }
  }

  /* ---- 补间（只在动画进行中跑 rAF） ---- */
  function stopTween() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    tween = null;
  }

  function finish() {
    if (n > 0 && o.loop) pos = mod(pos, n);
    layout(pos);
  }

  function tweenTo(target, animate) {
    stopTween();
    const dur = animate && !reducedMotion() ? Math.max(0, o.duration) : 0;
    if (!dur || Math.abs(target - pos) < 1e-4) {
      pos = target;
      finish();
      return;
    }
    tween = { from: pos, to: target, t0: performance.now(), dur };
    const step = (now) => {
      if (!tween) return;
      const p = clamp((now - tween.t0) / tween.dur, 0, 1);
      pos = tween.from + (tween.to - tween.from) * ease(p);
      if (p >= 1) {
        pos = tween.to;
        raf = 0;
        tween = null;
        finish();
        return;
      }
      layout(pos);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }

  function announce(fromAuto) {
    const item = data[focus];
    live.setAttribute("aria-live", fromAuto && !focused ? "off" : "polite");
    live.textContent = t.counter(focus + 1, n) + (item?.alt ? ` · ${item.alt}` : "");
  }

  function syncIndicators() {
    dots.forEach((b, i) => {
      const on = i === focus;
      b.classList.toggle("is-active", on);
      if (on) b.setAttribute("aria-current", "true");
      else b.removeAttribute("aria-current");
    });
    if (!o.loop && prevBtn && nextBtn) {
      prevBtn.disabled = focus <= 0;
      nextBtn.disabled = focus >= n - 1;
    }
  }

  function setFocus(raw, animate = true, fromAuto = false) {
    if (!n || destroyed) return;
    const idx = o.loop ? mod(Math.round(raw), n) : clamp(Math.round(raw), 0, n - 1);
    let delta = idx - pos;
    if (o.loop && n > 1) {
      delta = mod(delta, n);
      if (delta > n / 2) delta -= n;
    }
    const changed = idx !== focus;
    focus = idx;
    tweenTo(pos + delta, animate);
    syncIndicators();
    if (changed) {
      announce(fromAuto);
      try { o.onChange?.(idx, data[idx]); } catch (e) { console.error(e); }
    }
    syncAuto();
  }

  const navigateBy = (step, fromAuto = false) => setFocus(focus + step, true, fromAuto);

  /* ---- 拖动（指针事件；先判方向，纵向手势交还浏览器） ---- */
  let drag = null;
  let suppressClick = false;
  const stepPx = () => Math.max(refW() * k * 0.55, 40);

  function onPointerDown(e) {
    if (n < 2 || e.button > 0 || e.target.closest?.(".depth-carousel__arrow, .depth-carousel__dots")) return;
    drag = { x: e.clientX, y: e.clientY, startPos: pos, lastX: e.clientX, lastT: performance.now(), v: 0, moved: false, id: e.pointerId };
  }
  function onPointerMove(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (!drag.moved) {
      if (Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx)) { drag = null; return; }
      if (Math.abs(dx) <= 4 || Math.abs(dx) < Math.abs(dy)) return;
      drag.moved = true;
      stopTween();
      drag.startPos = pos;
      drag.x = e.clientX;
      try { el.setPointerCapture(drag.id); } catch { /* 指针已失效 */ }
      el.classList.add("is-dragging");
      syncAuto();
      return;
    }
    const now = performance.now();
    drag.v = (e.clientX - drag.lastX) / Math.max(now - drag.lastT, 1);
    drag.lastX = e.clientX;
    drag.lastT = now;
    let p = drag.startPos - dx / stepPx();
    if (!o.loop) {
      // 越过首尾时加阻尼
      if (p < 0) p = p / 3;
      else if (p > n - 1) p = n - 1 + (p - (n - 1)) / 3;
    }
    pos = p;
    layout(pos);
  }
  function onPointerEnd(e) {
    if (!drag || (e && e.pointerId !== drag.id)) return;
    const d = drag;
    drag = null;
    if (!d.moved) return;
    el.classList.remove("is-dragging");
    try { el.releasePointerCapture(d.id); } catch { /* 已释放 */ }
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 0);
    const projected = pos - (d.v * 180) / stepPx();
    setFocus(Math.round(projected), true);
  }

  // 触摸指针有隐式捕获（落在卡片上）：改由根元素捕获时卡片会收到冒泡上来的 lostpointercapture，那不是拖动结束
  const onLostCapture = (e) => { if (e.target === el) onPointerEnd(e); };

  /* ---- 滚轮 ---- */
  let wheelTimer = 0;
  function onWheel(e) {
    if (n < 2 || !o.wheel) return;
    const horiz = Math.abs(e.deltaX) > Math.abs(e.deltaY);
    if (!horiz && o.wheel !== true) return;
    e.preventDefault();
    stopTween();
    const raw = horiz ? e.deltaX : e.deltaY;
    const delta = e.deltaMode === 1 ? raw * 24 : raw;
    pos += clamp(delta / (refW() * k * 0.9), -0.6, 0.6);
    if (!o.loop) pos = clamp(pos, -0.3, n - 0.7);
    layout(pos);
    clearTimeout(wheelTimer);
    wheelTimer = setTimeout(() => setFocus(Math.round(pos), true), 130);
  }

  /* ---- 键盘（焦点在组件内时） ---- */
  function onKeyDown(e) {
    if (!o.keyboard || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    const k2 = e.key;
    if (k2 === "ArrowLeft") navigateBy(o.tiltDirection === "left" ? 1 : -1);
    else if (k2 === "ArrowRight") navigateBy(o.tiltDirection === "left" ? -1 : 1);
    else if (k2 === "Home") setFocus(0, true);
    else if (k2 === "End") setFocus(n - 1, true);
    else return;
    e.preventDefault();
  }

  /* ---- 自动轮播：悬停 / 拖动 / 聚焦 / 标签页隐藏 / 减少动效时暂停 ---- */
  let hovered = false, focused = false, autoTimer = 0;
  function canAuto() {
    return o.autoplay && n > 1 && !destroyed && !hovered && !focused && !drag?.moved &&
      !(typeof document !== "undefined" && document.hidden) && !reducedMotion();
  }
  function syncAuto() {
    clearTimeout(autoTimer);
    autoTimer = 0;
    if (!canAuto()) return;
    autoTimer = setTimeout(() => {
      autoTimer = 0;
      if (canAuto()) navigateBy(1, true);
    }, Math.max(o.autoplayDelay, 600));
  }
  const onEnter = (e) => { if (e.pointerType === "mouse") { hovered = true; syncAuto(); } };
  const onLeave = (e) => { if (e.pointerType === "mouse") { hovered = false; syncAuto(); } };
  const onFocusIn = () => { focused = true; live.setAttribute("aria-live", "polite"); syncAuto(); };
  const onFocusOut = (e) => {
    if (e.relatedTarget && el.contains(e.relatedTarget)) return;
    focused = false;
    syncAuto();
  };
  const onVisibility = () => syncAuto();
  const mqReduce = typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null;
  const onReduce = () => syncAuto();

  /* ---- 尺寸与明暗 ---- */
  const relayout = () => { if (!destroyed) { measure(); layout(pos); } };
  const ro = typeof ResizeObserver === "function" ? new ResizeObserver(relayout) : null;
  const onSchemeChange = () => { if (!destroyed) { readTint(); layout(pos); } };
  const mo = typeof MutationObserver === "function" ? new MutationObserver(onSchemeChange) : null;
  const mqDark = typeof matchMedia === "function" ? matchMedia("(prefers-color-scheme: dark)") : null;

  el.addEventListener("pointerdown", onPointerDown);
  el.addEventListener("pointermove", onPointerMove);
  el.addEventListener("pointerup", onPointerEnd);
  el.addEventListener("pointercancel", onPointerEnd);
  el.addEventListener("lostpointercapture", onLostCapture);
  el.addEventListener("wheel", onWheel, { passive: false });
  el.addEventListener("keydown", onKeyDown);
  el.addEventListener("pointerenter", onEnter);
  el.addEventListener("pointerleave", onLeave);
  el.addEventListener("focusin", onFocusIn);
  el.addEventListener("focusout", onFocusOut);
  document.addEventListener("visibilitychange", onVisibility);
  mqReduce?.addEventListener?.("change", onReduce);
  mqDark?.addEventListener?.("change", onSchemeChange);
  ro?.observe(el);
  mo?.observe(document.documentElement, { attributes: true, attributeFilter: ["data-scheme", "data-palette", "data-theme", "class", "style"] });

  function init(start) {
    stopTween();
    for (const rec of cards.values()) rec.el.remove();
    cards.clear();
    buildChrome();
    focus = n ? (o.loop ? mod(Math.round(start) || 0, n) : clamp(Math.round(start) || 0, 0, n - 1)) : 0;
    pos = focus;
    el.classList.toggle("is-empty", !n);
    readTint();
    measure();
    layout(pos);
    syncIndicators();
    live.setAttribute("aria-live", "off");
    live.textContent = n ? t.counter(focus + 1, n) : "";
    syncAuto();
  }
  init(o.start);

  return {
    goTo(i, opts = {}) { setFocus(i, opts.animate !== false); },
    next() { navigateBy(1); },
    prev() { navigateBy(-1); },
    get index() { return focus; },
    get count() { return n; },
    setItems(items, start = 0) {
      if (destroyed) return;
      data = (Array.isArray(items) ? items : []).map(normalizeItem);
      n = data.length;
      init(start);
    },
    refresh() { if (!destroyed) { readTint(); relayout(); } },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      stopTween();
      clearTimeout(autoTimer);
      clearTimeout(wheelTimer);
      ro?.disconnect();
      mo?.disconnect();
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerEnd);
      el.removeEventListener("pointercancel", onPointerEnd);
      el.removeEventListener("lostpointercapture", onLostCapture);
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("keydown", onKeyDown);
      el.removeEventListener("pointerenter", onEnter);
      el.removeEventListener("pointerleave", onLeave);
      el.removeEventListener("focusin", onFocusIn);
      el.removeEventListener("focusout", onFocusOut);
      document.removeEventListener("visibilitychange", onVisibility);
      mqReduce?.removeEventListener?.("change", onReduce);
      mqDark?.removeEventListener?.("change", onSchemeChange);
      stage.remove();
      live.remove();
      prevBtn?.remove();
      nextBtn?.remove();
      dotsWrap?.remove();
      cards.clear();
      el.classList.remove(...addedClasses, "is-auto", "is-dragging", "is-empty", "has-dots");
      for (const [a, v] of prevAttrs) {
        if (v === null) el.removeAttribute(a);
        else el.setAttribute(a, v);
      }
      if (prevClass === null && !el.classList.length) el.removeAttribute("class");
      if (prevStyle === null) el.removeAttribute("style");
      else el.setAttribute("style", prevStyle);
    },
  };
}
