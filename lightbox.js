/* ============================================================
   @szyyw/design · lightbox.js（v0.31.0）
   原图查看器：缩略图点开看原图，放大 / 平移 / 翻页（DESIGN.md §16.5）。框架无关；模块顶层不碰 DOM（SSR 可 import）。

     import { openLightbox, enhanceLightbox, LIGHTBOX_TEXTS } from "@szyyw/design/lightbox";
     const lb = openLightbox({ items: [{ src: "/p/1.jpg", thumb: "/p/1-360.jpg", width: 4032, height: 3024 }], start: 0 });
     lb.go(2); lb.close(); lb.destroy();
     const undo = enhanceLightbox();   // .thumb-strip 里带 data-lightbox-src 的 .thumb-tile 点开看图（事件委托）

   结构：.overlay.lightbox > .sheet.wide.lightbox-sheet（role="dialog"）挂到 body；遮罩、Esc、滚动锁、底部抽屉下拉关闭
   交给 mountOverlay（dragClose）。桌面是居中小窗，≤899px 是底部升起的大半屏卡片（抓手 / 头部往下拖关闭）。
   - 显示原图：按原图比例算好像素尺寸居中摆放，只有图上是放大光标；先用 thumb 模糊撑出占位，原图到了淡入；失败给「在新标签打开原图」。
   - 放大：双击 / 双点图片（点的位置放大到 2.5 倍）、双指张合、滚轮（没放大时只在图上）、+ − 键与按钮、1:1（原图一像素 = 一个 CSS 像素）；
     0 键或点百分比还原。上限 max(5, 1:1 倍数)。放大后拖动平移，不许拖出边。
   - 没放大时：左右滑（跟手，松手按距离 / 速度切换或回弹，首尾阻尼）、← →、两侧翻页键切换；触屏在图上竖向下滑接到下拉关闭。
   - 一张以上时底部有缩略图带（.thumb-strip.sm），预加载相邻前后各一张。
   - 键盘只在弹层内处理（监听挂在弹层上），关闭 / destroy 撤掉全部监听；切图时 aria-live 播报「第 i / n 张」。
   文案 zh / ja / en（locale，缺省 "zh"），labels 覆盖任意一条。
   ============================================================ */

import { mountOverlay } from "./overlay.js";
import { icon } from "./icons.js";

export const LIGHTBOX_TEXTS = {
  zh: {
    dialog: "查看图片", close: "关闭", prev: "上一张", next: "下一张",
    zoomIn: "放大", zoomOut: "缩小", reset: "还原", actualSize: "原图一像素对屏幕一像素",
    original: "原图", openOriginal: "打开原图", loading: "加载中",
    loadFailed: "图片加载失败", openInNewTab: "在新标签打开原图",
    position: "第 {i} / {n} 张", image: "图片 {i} / {n}", thumbs: "全部图片", thumb: "第 {i} 张"
  },
  ja: {
    dialog: "画像を表示", close: "閉じる", prev: "前の画像", next: "次の画像",
    zoomIn: "拡大", zoomOut: "縮小", reset: "元に戻す", actualSize: "原寸（1 画素 = 画面 1 画素）",
    original: "原寸", openOriginal: "原寸を開く", loading: "読み込み中",
    loadFailed: "画像を読み込めませんでした", openInNewTab: "新しいタブで原寸を開く",
    position: "{i} / {n} 枚目", image: "画像 {i} / {n}", thumbs: "すべての画像", thumb: "{i} 枚目"
  },
  en: {
    dialog: "View image", close: "Close", prev: "Previous", next: "Next",
    zoomIn: "Zoom in", zoomOut: "Zoom out", reset: "Reset zoom", actualSize: "Actual size (1 image pixel = 1 screen pixel)",
    original: "Original", openOriginal: "Open original", loading: "Loading",
    loadFailed: "Image failed to load", openInNewTab: "Open original in new tab",
    position: "Image {i} of {n}", image: "Image {i} of {n}", thumbs: "All images", thumb: "Image {i}"
  }
};

/** 放大倍数下限上限（原图更大时放宽到 1:1，见 maxScale）、双击放大倍数、+ − 每步倍数 */
const MAX_SCALE = 5;
const TAP_ZOOM = 2.5;
const STEP = 1.5;
const FIT = Object.freeze({ scale: 1, x: 0, y: 0 });
const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

const fmt = (s, vars) => String(s).replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ""));

function el(tag, className, attrs) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (attrs) for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}

function cssMs(node, name, fallback) {
  const v = getComputedStyle(node).getPropertyValue(name).trim();
  const n = parseFloat(v);
  if (!v || Number.isNaN(n)) return fallback;
  return v.endsWith("ms") ? n : n * 1000;
}

/**
 * @param {{ items: Array<{ src: string, thumb?: string, alt?: string, width?: number, height?: number }>, start?: number,
 *           locale?: string, labels?: object, onClose?: () => void, returnFocus?: HTMLElement }} options
 */
export function openLightbox(options = {}) {
  const noop = { close() {}, go() {}, destroy() {} };
  if (typeof document === "undefined") return noop;
  // 打开时快照：调用方之后换掉数组（轮询刷新）不影响正在看的
  const items = (options.items || []).filter((it) => it && it.src).map((it) => ({ ...it }));
  const n = items.length;
  if (!n) return noop;
  const t = { ...(LIGHTBOX_TEXTS[options.locale] || LIGHTBOX_TEXTS.zh), ...(options.labels || {}) };
  const prevFocus = options.returnFocus || document.activeElement;
  const reduced = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const wrap = (i) => ((Math.round(i) % n) + n) % n;

  /* ---------- 结构 ---------- */
  const overlay = el("div", "overlay lightbox");
  const sheet = el("div", "sheet wide lightbox-sheet", { role: "dialog", "aria-modal": "true", "aria-label": t.dialog, tabindex: "-1" });
  const grabber = el("div", "sheet-grabber", { "aria-hidden": "true" });
  const head = el("div", "sheet-head");
  const closeBtn = el("button", "close-x", { type: "button", "aria-label": t.close });
  closeBtn.append(icon("x"));
  head.append(closeBtn);

  const body = el("div", "sheet-body lightbox-body");
  const stage = el("div", "lightbox-stage", { "data-state": "loading" });
  const track = el("div", "lightbox-track");
  const frame = el("div", "lightbox-frame");
  frame.hidden = true;
  track.append(frame);
  const spinner = el("span", "spinner lg lightbox-spinner", { role: "status", "aria-label": t.loading });
  const errorBox = el("div", "empty compact lightbox-error");
  errorBox.hidden = true;
  const errTitle = el("p", "empty-title");
  errTitle.textContent = t.loadFailed;
  const errActions = el("div", "empty-actions");
  const errLink = el("a", "btn-ghost btn-small", { target: "_blank", rel: "noopener" });
  errLink.append(icon("external-link"), document.createTextNode(t.openInNewTab));
  errActions.append(errLink);
  errorBox.append(icon("circle-alert"), errTitle, errActions);
  const prevBtn = el("button", "btn-icon lightbox-nav prev", { type: "button", "aria-label": t.prev });
  prevBtn.append(icon("chevron-left"));
  const nextBtn = el("button", "btn-icon lightbox-nav next", { type: "button", "aria-label": t.next });
  nextBtn.append(icon("chevron-right"));
  prevBtn.hidden = nextBtn.hidden = n < 2;
  stage.append(track, spinner, errorBox, prevBtn, nextBtn);

  // 缩略图带：一张以上才有
  const strip = el("ul", "thumb-strip sm lightbox-thumbs", { "aria-label": t.thumbs });
  strip.hidden = n < 2;
  const tiles = [];
  if (n > 1) {
    items.forEach((it, k) => {
      const li = el("li");
      const b = el("button", "thumb-tile", { type: "button", "aria-label": fmt(t.thumb, { i: k + 1, n }) });
      const im = el("img", "", { alt: "", loading: "lazy", decoding: "async", draggable: "false" });
      im.src = it.thumb || it.src;
      b.append(im);
      b.addEventListener("click", () => show(k));
      li.append(b);
      strip.append(li);
      tiles.push(b);
    });
  }

  const bar = el("div", "lightbox-bar");
  const count = el("span", "lightbox-count");
  const zoomOutBtn = el("button", "btn-icon lightbox-zoom", { type: "button", "aria-label": t.zoomOut });
  zoomOutBtn.append(icon("minus"));
  const pctBtn = el("button", "btn-ghost btn-small lightbox-pct", { type: "button", title: t.reset });
  const zoomInBtn = el("button", "btn-icon lightbox-zoom", { type: "button", "aria-label": t.zoomIn });
  zoomInBtn.append(icon("plus"));
  const actualBtn = el("button", "btn-ghost btn-small lightbox-zoom", { type: "button", title: t.actualSize, "aria-label": t.actualSize });
  actualBtn.textContent = "1:1";
  const openLink = el("a", "btn-ghost btn-small lightbox-open", { target: "_blank", rel: "noopener" });
  openLink.append(icon("external-link"), document.createTextNode(t.openOriginal));
  bar.append(count, el("span", "lightbox-sep", { "aria-hidden": "true" }), zoomOutBtn, pctBtn, zoomInBtn, actualBtn,
    el("span", "lightbox-sep end", { "aria-hidden": "true" }), openLink);

  const live = el("div", "lightbox-live", { "aria-live": "polite", role: "status" });
  body.append(stage, strip, bar);
  sheet.append(grabber, head, body, live);
  overlay.append(sheet);
  document.body.append(overlay);

  /* ---------- 状态 ---------- */
  let index = wrap(options.start ?? 0);
  let view = FIT;
  let box = null; // 「整张放进舞台」时的显示尺寸
  let token = 0; // 切图后作废旧图片的回调
  let thumbImg = null;
  let fullImg = null;
  let closed = false;
  let slideAnim = null;
  /** 每张原图的加载结果（预加载也写这里） */
  const info = items.map(() => ({ state: "idle", w: 0, h: 0 }));
  const preloads = new Map();

  const ov = mountOverlay(overlay, { onClose: () => close(), dragClose: { sheet } });

  function setState(s) { stage.setAttribute("data-state", s); }

  /** 布局用的尺寸：已加载的原图 → 调用方给的 width/height → 缩略图比例 */
  function knownSize() {
    const inf = info[index];
    if (inf.state === "loaded") return { w: inf.w, h: inf.h };
    const it = items[index];
    if (it.width > 0 && it.height > 0) return { w: it.width, h: it.height };
    if (thumbImg && thumbImg.naturalWidth) return { w: thumbImg.naturalWidth, h: thumbImg.naturalHeight };
    return null;
  }
  /** 原图像素尺寸（底栏与 1:1 用）：加载后以 naturalWidth/Height 为准，之前用调用方给的 */
  function naturalSize() {
    const inf = info[index];
    if (inf.state === "loaded") return { w: inf.w, h: inf.h };
    const it = items[index];
    return it.width > 0 && it.height > 0 ? { w: it.width, h: it.height } : null;
  }
  /** 原图一像素对屏幕一像素时的倍数（原图比舞台小就是 1） */
  function actualScale() {
    const nat = naturalSize();
    return nat && box ? Math.max(1, nat.w / box.w) : 1;
  }
  const maxScale = () => Math.max(MAX_SCALE, actualScale());

  function layout() {
    const s = knownSize();
    const W = stage.clientWidth;
    const H = stage.clientHeight;
    if (!s || !W || !H) {
      box = null;
      frame.hidden = true;
    } else {
      const fit = Math.min(W / s.w, H / s.h);
      box = { w: s.w * fit, h: s.h * fit };
      frame.style.width = `${box.w}px`;
      frame.style.height = `${box.h}px`;
      frame.hidden = false;
    }
    view = clamp(view);
    paintView();
  }

  /** 放大后不许拖出边：平移上限 = 放大后的图比舞台多出来的一半 */
  function clamp(v) {
    const scale = Math.min(maxScale(), Math.max(1, v.scale));
    if (!box || scale <= 1) return FIT;
    const mx = Math.max(0, (box.w * scale - stage.clientWidth) / 2);
    const my = Math.max(0, (box.h * scale - stage.clientHeight) / 2);
    return { scale, x: Math.min(mx, Math.max(-mx, v.x)), y: Math.min(my, Math.max(-my, v.y)) };
  }

  /** 以舞台内一点（相对舞台中心的像素）为中心缩放到 scale */
  function zoomAt(scale, px = 0, py = 0, from = view) {
    if (!box) return;
    const k = Math.min(maxScale(), Math.max(1, scale)) / from.scale;
    setView({ scale: from.scale * k, x: px - (px - from.x) * k, y: py - (py - from.y) * k });
  }
  function setView(v) { view = clamp(v); paintView(); }

  function paintView() {
    frame.style.transform = `translate(-50%, -50%) translate(${view.x}px, ${view.y}px) scale(${view.scale})`;
    stage.classList.toggle("zoomed", view.scale > 1);
    paintBar();
  }

  function paintBar() {
    const nat = naturalSize();
    count.textContent = `${index + 1} / ${n}${nat ? ` · ${t.original} ${nat.w}×${nat.h}` : ""}`;
    const zoomed = view.scale > 1;
    const pct = `${Math.round(view.scale * 100)}%`;
    pctBtn.textContent = pct;
    pctBtn.setAttribute("aria-label", `${t.reset} ${pct}`);
    pctBtn.disabled = !zoomed;
    zoomOutBtn.disabled = !zoomed;
    zoomInBtn.disabled = !box || view.scale >= maxScale() - 0.001;
    const a = actualScale();
    actualBtn.disabled = !box || a <= 1 || Math.abs(view.scale - a) < 0.01;
  }

  function loadInto(i, onDone) {
    const pic = new Image();
    pic.decoding = "async";
    pic.onload = () => {
      info[i] = { state: "loaded", w: pic.naturalWidth, h: pic.naturalHeight };
      onDone?.();
    };
    pic.onerror = () => {
      info[i] = { state: "error", w: 0, h: 0 };
      onDone?.();
    };
    pic.src = items[i].src;
    return pic;
  }

  /** 预加载相邻前后各一张 */
  function preloadAround(i) {
    if (n < 2) return;
    for (const k of new Set([wrap(i - 1), wrap(i + 1)])) {
      if (k === i || info[k].state !== "idle" || preloads.has(k)) continue;
      info[k].state = "loading";
      preloads.set(k, loadInto(k, () => preloads.delete(k)));
    }
  }

  let announced = false;
  function announce() {
    const msg = fmt(t.position, { i: index + 1, n });
    live.textContent = "";
    requestAnimationFrame(() => { if (!closed) live.textContent = msg; });
  }

  function show(i, { silent = false } = {}) {
    if (closed) return;
    i = wrap(i);
    const changed = i !== index || !fullImg;
    index = i;
    view = FIT;
    const my = ++token;
    const it = items[i];

    frame.replaceChildren();
    thumbImg = null;
    if (it.thumb && it.thumb !== it.src && info[i].state !== "loaded") {
      thumbImg = el("img", "lightbox-thumb", { alt: "", "aria-hidden": "true", draggable: "false" });
      thumbImg.addEventListener("load", () => { if (my === token) layout(); });
      thumbImg.src = it.thumb;
      frame.append(thumbImg);
    }
    fullImg = el("img", "lightbox-full", { alt: it.alt || fmt(t.image, { i: i + 1, n }), draggable: "false" });
    const onLoad = () => {
      if (my !== token) return;
      info[i] = { state: "loaded", w: fullImg.naturalWidth, h: fullImg.naturalHeight };
      errorBox.hidden = true;
      setState("loaded");
      layout();
    };
    const onError = () => {
      if (my !== token) return;
      info[i] = { state: "error", w: 0, h: 0 };
      errorBox.hidden = false;
      setState("error");
      layout();
    };
    fullImg.addEventListener("load", onLoad);
    fullImg.addEventListener("error", onError);
    fullImg.src = it.src;
    frame.append(fullImg);
    errLink.href = it.src;
    openLink.href = it.src;
    errorBox.hidden = true;
    if (fullImg.complete && fullImg.naturalWidth) onLoad();
    else setState("loading");
    layout();

    tiles.forEach((b, k) => {
      if (k === i) b.setAttribute("aria-current", "true");
      else b.removeAttribute("aria-current");
    });
    scrollThumbIntoView();
    if (changed && !silent && announced) announce();
    announced = true;
    preloadAround(i);
  }

  function scrollThumbIntoView() {
    const b = tiles[index];
    if (!b || strip.hidden) return;
    const r = b.getBoundingClientRect();
    const sr = strip.getBoundingClientRect();
    const pad = parseFloat(getComputedStyle(strip).paddingLeft) || 0;
    let d = 0;
    if (r.left < sr.left + pad) d = r.left - (sr.left + pad);
    else if (r.right > sr.right - pad) d = r.right - (sr.right - pad);
    if (d) strip.scrollTo({ left: strip.scrollLeft + d, behavior: reduced() ? "auto" : "smooth" });
  }

  /* ---------- 跟手滑动 ---------- */
  function setTrack(x) { track.style.transform = x ? `translate3d(${x}px, 0, 0)` : ""; }
  function cancelSlide() {
    if (slideAnim) { slideAnim.cancel(); slideAnim = null; }
  }
  function settle(fromX, dir) {
    cancelSlide();
    const W = stage.clientWidth || 1;
    const fast = cssMs(stage, "--dur-fast", 150);
    const base = cssMs(stage, "--dur-base", 250);
    const easing = getComputedStyle(stage).getPropertyValue("--ease-out").trim() || "ease-out";
    setTrack(0);
    if (reduced() || typeof track.animate !== "function") {
      if (dir) show(index + dir);
      return;
    }
    if (!dir) {
      slideAnim = track.animate([{ transform: `translate3d(${fromX}px, 0, 0)` }, { transform: "none" }], { duration: base, easing });
      slideAnim.onfinish = () => { slideAnim = null; };
      return;
    }
    // 先把当前这张滑出去，再让下一张从同侧轻推进来
    const out = track.animate([{ transform: `translate3d(${fromX}px, 0, 0)` }, { transform: `translate3d(${-dir * W}px, 0, 0)` }],
      { duration: fast, easing, fill: "forwards" });
    slideAnim = out;
    out.onfinish = () => {
      if (slideAnim !== out) return;
      show(index + dir);
      out.cancel();
      slideAnim = track.animate([{ transform: `translate3d(${dir * W * 0.25}px, 0, 0)`, opacity: 0 }, { transform: "none", opacity: 1 }],
        { duration: base, easing });
      slideAnim.onfinish = () => { slideAnim = null; };
    };
  }

  /* ---------- 指针手势 ---------- */
  const pointers = new Map();
  let g = null;
  let lastTap = 0;

  function local(e) {
    const r = stage.getBoundingClientRect();
    return { x: e.clientX - r.left - r.width / 2, y: e.clientY - r.top - r.height / 2 };
  }
  const onImage = (target) => !frame.hidden && frame.contains(target);

  function onPointerDown(e) {
    if (e.button > 0) return;
    if (e.target.closest("button, a")) return;
    try { stage.setPointerCapture(e.pointerId); } catch { /* 指针已失效：不捕获也照样处理 */ }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.values()];
    if (pts.length === 2 && g) {
      // 第二根手指落下：放弃正在进行的滑动 / 下拉，改为张合
      if (g.axis === "x") settle(g.offset || 0, 0);
      if (g.ydrag) ov.release(0, 0);
    }
    cancelSlide();
    setTrack(0);
    const mid = pts.length === 2 ? local({ clientX: (pts[0].x + pts[1].x) / 2, clientY: (pts[0].y + pts[1].y) / 2 }) : local(e);
    const dist = pts.length === 2 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0;
    stage.classList.add("dragging");
    g = {
      startX: e.clientX, startY: e.clientY, view, dist, mid, moved: pts.length > 1, onImage: onImage(e.target),
      axis: pts.length > 1 ? "pinch" : null, touch: e.pointerType === "touch", offset: 0, ydrag: false,
      lastX: e.clientX, lastY: e.clientY, lastT: e.timeStamp, vx: 0, vy: 0
    };
  }

  function onPointerMove(e) {
    if (!g || !pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.values()];
    if (pts.length === 2 && g.dist) {
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      zoomAt((g.view.scale * dist) / g.dist, g.mid.x, g.mid.y, g.view);
      return;
    }
    const dx = e.clientX - g.startX;
    const dy = e.clientY - g.startY;
    const dt = e.timeStamp - g.lastT;
    if (dt > 0) {
      g.vx = 0.7 * ((e.clientX - g.lastX) / dt) + 0.3 * g.vx;
      g.vy = 0.7 * ((e.clientY - g.lastY) / dt) + 0.3 * g.vy;
    }
    g.lastX = e.clientX;
    g.lastY = e.clientY;
    g.lastT = e.timeStamp;
    if (Math.abs(dx) + Math.abs(dy) > 6) g.moved = true;
    if (g.view.scale > 1) {
      setView({ scale: g.view.scale, x: g.view.x + dx, y: g.view.y + dy });
      return;
    }
    if (view.scale > 1 || g.axis === "pinch") return;
    // 方向锁：先判定水平还是垂直，再跟手
    if (!g.axis && Math.hypot(dx, dy) > 8) g.axis = Math.abs(dx) >= Math.abs(dy) ? "x" : "y";
    if (g.axis === "x") {
      const edge = n < 2 || (index === 0 && dx > 0) || (index === n - 1 && dx < 0);
      g.offset = edge ? dx * 0.3 : dx;
      setTrack(g.offset);
    } else if (g.axis === "y" && g.touch) {
      g.ydrag = ov.dragBy(dy) || g.ydrag;
    }
  }

  function onPointerUp(e) {
    pointers.delete(e.pointerId);
    if (pointers.size === 1 && g && g.axis === "pinch") {
      // 张合中先抬起一根手指（哪根先抬都一样）：以剩下那根手指和当前视图重建手势，
      // 否则剩下那根一动就按张合前的视图平移，缩放倍数弹回去；axis 保持 pinch，不触发翻页 / 下拉
      const [rest] = pointers.values();
      Object.assign(g, {
        startX: rest.x, startY: rest.y, view, dist: 0, moved: true,
        lastX: rest.x, lastY: rest.y, lastT: e.timeStamp, vx: 0, vy: 0
      });
      return;
    }
    if (pointers.size > 0 || !g) return;
    const cur = g;
    g = null;
    stage.classList.remove("dragging");
    const cancelled = e.type === "pointercancel";
    const dx = cancelled ? 0 : e.clientX - cur.startX;
    const dy = cancelled ? 0 : e.clientY - cur.startY;
    const stale = e.timeStamp - cur.lastT > 100; // 停住再松手不算甩
    if (cur.axis === "x" && cur.view.scale === 1 && view.scale === 1) {
      const W = stage.clientWidth || 1;
      const vx = stale ? 0 : cur.vx;
      const dir = dx < 0 ? 1 : -1;
      const target = index + dir;
      const flick = Math.abs(vx) > 0.5 && Math.abs(dx) > 20 && Math.sign(vx) === Math.sign(dx);
      const commit = !cancelled && (Math.abs(dx) > W * 0.2 || flick) && target >= 0 && target < n;
      settle(cur.offset, commit ? dir : 0);
      return;
    }
    if (cur.axis === "y") {
      if (cur.ydrag) ov.release(dy, stale ? 0 : cur.vy);
      return;
    }
    if (cancelled || cur.moved) return;
    // 双击 / 双点：没放大时只在图上放大（空白处不放大），放大时任意处还原
    if (cur.view.scale === 1 && !cur.onImage) return;
    const now = e.timeStamp;
    if (now - lastTap < 300) {
      lastTap = 0;
      if (view.scale > 1) setView(FIT);
      else {
        const p = local(e);
        zoomAt(TAP_ZOOM, p.x, p.y);
      }
    } else lastTap = now;
  }

  /** 滚轮缩放：passive:false 才拦得住页面滚动；没放大时只在图上才缩放 */
  function onWheel(e) {
    if (view.scale === 1 && !onImage(e.target)) return;
    e.preventDefault();
    const p = local(e);
    zoomAt(view.scale * Math.exp(-e.deltaY * 0.0025), p.x, p.y);
  }

  /** 键盘：监听挂在弹层上（打开时焦点在弹层里），关闭即随元素撤掉 */
  function onKeydown(e) {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === "Tab") {
      const list = [...sheet.querySelectorAll(FOCUSABLE)].filter((x) => x.offsetParent !== null);
      if (!list.length) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === sheet)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
      return;
    }
    if (e.key === "ArrowLeft") show(index - 1);
    else if (e.key === "ArrowRight") show(index + 1);
    else if (e.key === "+" || e.key === "=") zoomAt(view.scale * STEP);
    else if (e.key === "-" || e.key === "_") zoomAt(view.scale / STEP);
    else if (e.key === "0") setView(FIT);
    else return;
    e.preventDefault();
  }

  stage.addEventListener("pointerdown", onPointerDown);
  stage.addEventListener("pointermove", onPointerMove);
  stage.addEventListener("pointerup", onPointerUp);
  stage.addEventListener("pointercancel", onPointerUp);
  stage.addEventListener("wheel", onWheel, { passive: false });
  sheet.addEventListener("keydown", onKeydown);
  closeBtn.addEventListener("click", () => close());
  prevBtn.addEventListener("click", () => show(index - 1));
  nextBtn.addEventListener("click", () => show(index + 1));
  zoomOutBtn.addEventListener("click", () => zoomAt(view.scale / STEP));
  zoomInBtn.addEventListener("click", () => zoomAt(view.scale * STEP));
  pctBtn.addEventListener("click", () => setView(FIT));
  actualBtn.addEventListener("click", () => zoomAt(actualScale()));

  const ro = typeof ResizeObserver === "function" ? new ResizeObserver(() => { view = FIT; layout(); }) : null;
  ro?.observe(stage);

  show(index, { silent: true });
  sheet.focus({ preventScroll: true });

  function teardown() {
    closed = true;
    token++;
    cancelSlide();
    ro?.disconnect();
    ov.destroy();
    for (const pic of preloads.values()) { pic.onload = pic.onerror = null; }
    preloads.clear();
    stage.removeEventListener("pointerdown", onPointerDown);
    stage.removeEventListener("pointermove", onPointerMove);
    stage.removeEventListener("pointerup", onPointerUp);
    stage.removeEventListener("pointercancel", onPointerUp);
    stage.removeEventListener("wheel", onWheel);
    sheet.removeEventListener("keydown", onKeydown);
    overlay.remove();
    if (prevFocus && prevFocus.isConnected && typeof prevFocus.focus === "function") prevFocus.focus({ preventScroll: true });
  }

  function close() {
    if (closed) return;
    teardown();
    options.onClose?.();
  }

  return {
    close,
    go: (i) => show(Number(i) || 0),
    destroy() {
      if (!closed) teardown();
    }
  };
}

const TILE_SEL = ".thumb-strip .thumb-tile[data-lightbox-src]";
const bound = new WeakMap();

function tileItem(tile) {
  const img = tile.querySelector("img");
  const num = (v) => {
    const x = parseInt(v || "", 10);
    return x > 0 ? x : undefined;
  };
  return {
    src: tile.getAttribute("data-lightbox-src"),
    thumb: tile.getAttribute("data-lightbox-thumb") || img?.currentSrc || img?.getAttribute("src") || undefined,
    alt: img?.getAttribute("alt") || undefined,
    width: num(tile.getAttribute("data-lightbox-w")),
    height: num(tile.getAttribute("data-lightbox-h"))
  };
}

/**
 * 声明式：root（缺省 document）里 .thumb-strip 中带 data-lightbox-src 的 .thumb-tile 点开看图，从被点的那张开始。
 * 同组 = 相同 data-lightbox-group（跨条）；没写组时 = 同一条里也没写组的磁贴。事件委托，重复调用不重复绑定。
 * @param {ParentNode} [root]
 * @param {{ locale?: string, labels?: object, onClose?: () => void }} [options]
 * @returns {() => void} 解绑
 */
export function enhanceLightbox(root, options = {}) {
  if (typeof document === "undefined") return () => {};
  const scope = root || document;
  const existing = bound.get(scope);
  if (existing) return existing;
  const onClick = (e) => {
    if (e.defaultPrevented || e.button > 0) return;
    const tile = e.target instanceof Element ? e.target.closest(TILE_SEL) : null;
    if (!tile || (scope !== document && !scope.contains(tile))) return;
    if (tile.disabled || tile.getAttribute("aria-disabled") === "true") return;
    // 链接写法的磁贴：带修饰键时交给浏览器（新标签打开）
    if (tile.tagName === "A" && (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)) return;
    e.preventDefault();
    const group = tile.getAttribute("data-lightbox-group");
    let list;
    if (group !== null) {
      list = [...scope.querySelectorAll(TILE_SEL)].filter((x) => x.getAttribute("data-lightbox-group") === group);
    } else {
      const strip = tile.closest(".thumb-strip");
      list = [...strip.querySelectorAll(TILE_SEL)].filter((x) => !x.hasAttribute("data-lightbox-group") && x.closest(".thumb-strip") === strip);
    }
    openLightbox({ ...options, items: list.map(tileItem), start: list.indexOf(tile), returnFocus: tile });
  };
  scope.addEventListener("click", onClick);
  const undo = () => {
    scope.removeEventListener("click", onClick);
    bound.delete(scope);
  };
  bound.set(scope, undo);
  return undo;
}
