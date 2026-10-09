/* ============================================================
   @szyyw/design · techtext.js（v0.15.0）
   TechText 字标：光标（或无指针时自动往复的扫描点）下的那一个字母变成虚线描边，
   配选框 + 四角 + specks + 尺寸标注；字母可拖离基线、松手弹簧回位。

   出处与许可：React Bits「TechText」（https://reactbits.dev/text-animations/tech-text），
   Copyright (c) 2026 David Haz，MIT + Commons Clause License Condition v1.0。
   本移植由包作者知情决定随个人站点的设计包一起发布；使用者请自行留意上游许可
   （Commons Clause：不得出售 / 再许可组件本身）。上游原件存于 reference/reactbits/（不进 package files）。

   行为对齐官方演示（缺省 reveal "letter" + sweep "loop"）：扫描点按上游的
   cos 轨迹在文字上左右往复、0.22s 跟随，选中字母因此一个一个地跳；悬停时跟随指针。
   与上游的差异：
   - 渐进增强已有元素（通常 .app-title）：文字 / 字体 / 位置取自 DOM（Range 逐字量），
     布局零位移，原文字留在无障碍树里
   - 颜色逐段取自元素自己的渐变字（background-clip:text，含子元素如 <span class="grad-text">）
     或文字色；主题 / 配色 / 明暗变化自动换色
   - 参数按字号缩放（上游针对 150px）；小于 minLabelFont 不画标注
   - 拖拽后的那次 click 被吞掉、不触发原生链接拖拽（元素在 <a> 里不误跳转）
   - 性能：所有实例共用一个 rAF；无指针交互时限 30fps；不在视口内停；
     浏览器在隐藏标签里暂停 rAF；reduced-motion 不扫描、静态显示
   - 静态帧同步绘制，原文字只在画布第一次画成功后才隐藏（见 render()）
   ============================================================ */

import { resolveTokenColor } from "./dotfield.js";

export const DEFAULTS = {
  /** "letter" 只揭示光标下那个字母（官方缺省）| "area" 光标圆形区域 | "off" */
  reveal: "letter",
  lineStyle: "dashed",
  /** 选框周边闪烁的小方块数量（0 关；官方 15） */
  specks: 15,
  selection: true,
  labels: true,
  draggable: true,
  /** "loop"（官方：无指针时一直逐字扫）| true（扫一遍就停）| false */
  sweep: "loop",
  speed: 1,
  /** 揭示半径（px，仅 area 模式）；null = 约 2.1 × font-size */
  reach: null,
  softness: 0.7,
  /** 以下 null = 按字号自动 */
  dashLength: null,
  dashGap: null,
  strokeWidth: null,
  labelSize: null,
  /** 字号低于这个值时不画标注（小字的标注会糊成一团） */
  minLabelFont: 18,
  /** 颜色：token 名（"--accent"）、CSS 颜色，或 "auto"（= 元素自己的渐变字 / 文字色） */
  fill: "auto",
  stroke: "auto",
  accent: "--accent",
  /** 标注色；"accent" = 跟选框同色（官方：accent × 0.62） */
  labelColor: "accent"
};

const FALLOFF_STEPS = 8;
const SPRING = 320;
const DAMPING = 22;
const IDLE_FRAME_MS = 1000 / 30; // 无指针交互时的帧间隔上限（30fps）
const LABEL_FAMILY = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const approach = (current, target, dt, seconds) =>
  seconds <= 0 ? target : current + (target - current) * (1 - Math.exp(-dt / seconds));

const noise = (...values) => {
  let h = 2166136261;
  for (const value of values) {
    h = Math.imul(h ^ (value | 0), 16777619);
    h ^= h >>> 13;
    h = Math.imul(h, 0x5bd1e995);
    h ^= h >>> 15;
  }
  return (h >>> 0) / 4294967296;
};

const signed = (v) => (v > 0 ? `+${v}` : v < 0 ? `−${-v}` : "0");

/** 拆字：优先按字素（emoji / 组合字符不拆开），否则按码点 */
const segmenter =
  typeof Intl !== "undefined" && Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity: "grapheme" }) : null;
function graphemes(text) {
  if (segmenter) return Array.from(segmenter.segment(text), (s) => ({ char: s.segment, at: s.index }));
  const out = [];
  let at = 0;
  for (const char of Array.from(text)) {
    out.push({ char, at });
    at += char.length;
  }
  return out;
}

/** 顶层逗号切分（忽略括号里的逗号） */
function splitTop(text) {
  const out = [];
  let depth = 0;
  let cur = "";
  for (const ch of text) {
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

const SIDE_ANGLE = { top: 0, right: 90, bottom: 180, left: 270 };

/** 解析计算后的 linear-gradient(...)；只取第一层背景。解析失败返回 null */
function parseLinearGradient(bg) {
  const m = /^(?:-webkit-)?linear-gradient\((.*)\)/.exec((bg || "").trim());
  if (!m) return null;
  let depth = 1;
  let end = 0;
  const body = m[1];
  for (let i = 0; i < body.length; i++) {
    if (body[i] === "(") depth++;
    else if (body[i] === ")") {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  const parts = splitTop(end ? body.slice(0, end) : body);
  let angle = 180;
  const first = parts[0] || "";
  const deg = /^(-?[\d.]+)(deg|turn|rad|grad)$/.exec(first);
  if (deg) {
    const v = parseFloat(deg[1]);
    angle = deg[2] === "turn" ? v * 360 : deg[2] === "rad" ? (v * 180) / Math.PI : deg[2] === "grad" ? v * 0.9 : v;
    parts.shift();
  } else if (/^to\s/.test(first)) {
    const sides = first.slice(3).trim().split(/\s+/);
    const angles = sides.map((s) => SIDE_ANGLE[s]).filter((a) => a !== undefined);
    if (angles.length === 2) {
      const [a, b] = angles;
      angle = Math.abs(a - b) > 180 ? ((a + b + 360) / 2) % 360 : (a + b) / 2;
    } else if (angles.length === 1) angle = angles[0];
    parts.shift();
  }
  const stops = [];
  for (const p of parts) {
    const sm = /^(.*?)(?:\s+(-?[\d.]+)(%|px))?$/.exec(p);
    if (!sm || !sm[1]) continue;
    stops.push({ color: sm[1].trim(), pos: sm[2] === undefined ? null : +sm[2], unit: sm[3] || "%" });
  }
  return stops.length ? { angle, stops } : null;
}

function colorOf(value, fallback) {
  if (!value || value === "auto") return fallback;
  if (value.startsWith("--")) return resolveTokenColor(value) || fallback;
  return value;
}

const isClipText = (cs) =>
  (cs.backgroundClip === "text" || cs.webkitBackgroundClip === "text") && cs.backgroundImage !== "none";

/* ---------- 共享时钟：所有实例一个 rAF ---------- */
const running = new Set();
let sharedRaf = 0;
function sharedLoop(now) {
  sharedRaf = 0;
  for (const inst of Array.from(running)) {
    if (!inst.frame(now)) running.delete(inst);
  }
  if (running.size) sharedRaf = requestAnimationFrame(sharedLoop);
}
function startLoop(inst) {
  running.add(inst);
  if (!sharedRaf) sharedRaf = requestAnimationFrame(sharedLoop);
}
function stopLoop(inst) {
  running.delete(inst);
  if (!running.size && sharedRaf) {
    cancelAnimationFrame(sharedRaf);
    sharedRaf = 0;
  }
}

const registry = new WeakMap();

/**
 * 把已有元素增强为 TechText 字标。返回 { refresh(), destroy() }。
 * 同一元素重复挂载返回同一个 handle。
 * @param {Element} el
 * @param {Partial<typeof DEFAULTS>} [options]
 */
export function mountTechText(el, options = {}) {
  if (!el || !(el instanceof Element)) throw new TypeError("mountTechText: element required");
  const existing = registry.get(el);
  if (existing) return existing;

  const s = { ...DEFAULTS, ...options };
  const mqReduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const mqFine = window.matchMedia("(hover: hover) and (pointer: fine)");
  const mqForced = window.matchMedia("(forced-colors: active)");
  const mqDark = window.matchMedia("(prefers-color-scheme: dark)");
  const reduced = () => mqReduced.matches;

  const canvas = document.createElement("canvas");
  canvas.className = "tech-text-canvas";
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.cssText = "position:absolute;left:0;top:0;width:0;height:0;pointer-events:none;display:block;";
  const ctx = canvas.getContext("2d");
  const scratch = document.createElement("canvas");
  const scratchCtx = scratch.getContext("2d");

  /* ---------- 元素上的样式改动（全部可还原） ----------
     base：position / touch-action / class（不影响外观，挂载即加）
     hide：字形填充透明 + 渐变字的背景去掉（只在画布画成功后才加，见 render） */
  const touched = new Map(); // element → { prop: [value, priority] }
  const setInline = (node, prop, value, priority = "") => {
    let saved = touched.get(node);
    if (!saved) touched.set(node, (saved = {}));
    if (!(prop in saved)) saved[prop] = [node.style.getPropertyValue(prop), node.style.getPropertyPriority(prop)];
    node.style.setProperty(prop, value, priority);
  };
  const restoreInline = (node, prop) => {
    const saved = touched.get(node);
    if (!saved || !(prop in saved)) return;
    const [v, pr] = saved[prop];
    if (v) node.style.setProperty(prop, v, pr);
    else node.style.removeProperty(prop);
    delete saved[prop];
  };
  const restoreAll = (props) => {
    for (const [node, saved] of touched) for (const p of Object.keys(saved)) if (!props || props.includes(p)) restoreInline(node, p);
  };
  const HIDE_PROPS = ["-webkit-text-fill-color", "background-image"];
  let based = false;
  let hidden = false;
  let clipNodes = []; // 元素自己或子孙里的渐变字（background-clip:text）

  function applyBase() {
    if (getComputedStyle(el).position === "static") setInline(el, "position", "relative");
    if (s.draggable) setInline(el, "touch-action", "pan-y");
    el.classList.add("tech-text");
    based = true;
  }
  function hideText() {
    setInline(el, "-webkit-text-fill-color", "transparent", "important");
    for (const node of clipNodes) setInline(node, "background-image", "none", "important");
    hidden = true;
  }
  function showText() {
    restoreAll(HIDE_PROPS);
    hidden = false;
  }
  /** 暂时露出原样式读计算值（同步完成，不会闪） */
  function withOriginal(fn) {
    const was = hidden;
    if (was) showText();
    try {
      return fn();
    } finally {
      if (was) hideText();
    }
  }

  /* ---------- 颜色 ---------- */
  let colors = { stroke: null, accent: "#38bdf8", label: "#38bdf8", labelAlpha: 0.62 };
  function readColors() {
    const accent = colorOf(s.accent, "#38bdf8");
    colors = {
      stroke: s.stroke !== "auto" ? colorOf(s.stroke, null) : null,
      accent,
      label: s.labelColor === "accent" ? accent : colorOf(s.labelColor, accent),
      labelAlpha: s.labelColor === "accent" ? 0.62 : 0.85
    };
  }

  /** 某个文字节点的父元素该用什么颜料：最近的渐变字祖先（到 el 为止）或它自己的文字色 */
  function paintSpecFor(parent, cache) {
    if (cache.has(parent)) return cache.get(parent);
    let spec = null;
    const custom = s.fill !== "auto" ? colorOf(s.fill, null) : null;
    if (custom) spec = { kind: "color", color: custom };
    else {
      for (let node = parent; node; node = node === el ? null : node.parentElement) {
        const cs = getComputedStyle(node);
        if (isClipText(cs)) {
          const grad = parseLinearGradient(cs.backgroundImage);
          if (grad) {
            spec = { kind: "grad", node, ...grad };
            break;
          }
        }
      }
      if (!spec) {
        const cs = getComputedStyle(parent);
        const fill = cs.webkitTextFillColor;
        spec = { kind: "color", color: fill && fill !== cs.color && !/^rgba\(.*,\s*0\)$/.test(fill) ? fill : cs.color };
      }
    }
    cache.set(parent, spec);
    return spec;
  }

  /* ---------- 布局 ---------- */
  let dpr = 1;
  let cw = 1;
  let ch = 1;
  let fontPx = 16;
  let metrics = null;
  let glyphs = [];
  let layoutDirty = true;
  let colorsDirty = true;
  let canvasLeft0 = 0; // 画布左上角（视口坐标，量的那一刻）
  let canvasTop0 = 0;

  function scaled() {
    const fs = fontPx;
    return {
      reach: s.reach ?? Math.round(fs * 2.1),
      strokeWidth: s.strokeWidth ?? clamp(fs * 0.04, 0.6, 1.5),
      dashLength: s.dashLength ?? clamp(fs * 0.1, 1.4, 4),
      dashGap: s.dashGap ?? clamp(fs * 0.065, 1, 2),
      labelSize: s.labelSize ?? clamp(Math.round(fs * 0.36), 9, 11),
      labels: s.labels && fs >= s.minLabelFont,
      pad: clamp(fs * 0.16, 2, 6),
      corner: Math.round(clamp(fs * 0.12, 2, 5)),
      speck: clamp(fs / 80, 0.35, 1),
      hit: clamp(fs * 0.9, 10, 28)
    };
  }

  function makePaint(c, spec) {
    if (spec.kind === "color") return spec.color;
    const { x, y, w, h } = spec.box;
    const rad = (spec.angle * Math.PI) / 180;
    const dx = Math.sin(rad);
    const dy = -Math.cos(rad);
    const len = Math.abs(w * dx) + Math.abs(h * dy);
    const cx = x + w / 2;
    const cy = y + h / 2;
    const g = c.createLinearGradient(cx - (dx * len) / 2, cy - (dy * len) / 2, cx + (dx * len) / 2, cy + (dy * len) / 2);
    const n = spec.stops.length;
    let lastPos = 0;
    spec.stops.forEach((st, i) => {
      let pos = st.pos === null ? (n === 1 ? 0 : i / (n - 1)) : st.unit === "px" ? st.pos / Math.max(1, len) : st.pos / 100;
      pos = clamp(Math.max(pos, lastPos), 0, 1);
      lastPos = pos;
      try {
        g.addColorStop(pos, st.color);
      } catch {
        /* 无法识别的颜色：跳过这一站 */
      }
    });
    return g;
  }

  function sprite(glyph, stroke) {
    const m = metrics;
    const pad = Math.ceil(m.strokeWidth * 2 + 4);
    const left = glyph.box.x1 - pad;
    const top = glyph.box.y1 - pad;
    const w = glyph.box.x2 - glyph.box.x1 + pad * 2;
    const h = glyph.box.y2 - glyph.box.y1 + pad * 2;
    const image = document.createElement("canvas");
    image.width = Math.max(1, Math.ceil(w * dpr));
    image.height = Math.max(1, Math.ceil(h * dpr));
    const c = image.getContext("2d");
    c.setTransform(dpr, 0, 0, dpr, -left * dpr, -top * dpr);
    c.font = glyph.font;
    c.textAlign = "left";
    c.textBaseline = "alphabetic";
    if (stroke) {
      c.lineJoin = "round";
      c.lineWidth = m.strokeWidth * 2;
      c.lineCap = "butt";
      c.strokeStyle = colors.stroke || makePaint(c, glyph.paint);
      if (s.lineStyle !== "solid") c.setLineDash([Math.max(1, m.dashLength), Math.max(1, m.dashGap)]);
      c.strokeText(glyph.char, glyph.x, glyph.baseline);
      c.setLineDash([]);
      // 只留字形外侧那一半描边（上游做法）
      c.globalCompositeOperation = "destination-out";
      c.fillStyle = "#000";
      c.fillText(glyph.char, glyph.x, glyph.baseline);
      c.globalCompositeOperation = "source-over";
    } else {
      c.fillStyle = makePaint(c, glyph.paint);
      c.fillText(glyph.char, glyph.x, glyph.baseline);
    }
    return { image, left, top };
  }

  function fontOf(cs) {
    const style = cs.fontStyle && cs.fontStyle !== "normal" ? cs.fontStyle + " " : "";
    return `${style}${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  }

  /** 从 DOM 量出每个字的位置并备好字形贴图；返回 false 表示元素当前没有尺寸（display:none 等） */
  function layout() {
    layoutDirty = false;
    if (colorsDirty) {
      readColors();
      colorsDirty = false;
    }
    const csEl = getComputedStyle(el);
    fontPx = parseFloat(csEl.fontSize) || 16;
    metrics = scaled();
    dpr = Math.min(window.devicePixelRatio || 1, 2);

    const elRect = el.getBoundingClientRect();
    if (elRect.width === 0 && elRect.height === 0) {
      glyphs = [];
      canvas.style.display = "none";
      return false;
    }
    canvas.style.display = "block";

    // 逐字取 DOM 位置 + 每段的颜料（在原样式下读）
    const items = [];
    const paintCache = new Map();
    const fontCache = new Map();
    withOriginal(() => {
      clipNodes = [];
      if (isClipText(csEl)) clipNodes.push(el);
      for (const node of el.querySelectorAll("*")) {
        if (node !== canvas && isClipText(getComputedStyle(node))) clipNodes.push(node);
      }
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const range = document.createRange();
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const parent = node.parentElement;
        if (!parent) continue;
        let font = fontCache.get(parent);
        if (!font) {
          font = fontOf(getComputedStyle(parent));
          fontCache.set(parent, font);
        }
        const spec = paintSpecFor(parent, paintCache);
        for (const { char, at } of graphemes(node.data)) {
          if (!char.trim()) continue;
          range.setStart(node, at);
          range.setEnd(node, at + char.length);
          const r = range.getClientRects()[0];
          if (!r || (r.width === 0 && r.height === 0)) continue;
          items.push({ char, font, rect: r, spec });
        }
      }
      // 渐变的定位框（border-box 的 padding 区）
      for (const spec of paintCache.values()) {
        if (spec.kind !== "grad") continue;
        const r = spec.node.getBoundingClientRect();
        const cs = getComputedStyle(spec.node);
        const bl = parseFloat(cs.borderLeftWidth) || 0;
        const bt = parseFloat(cs.borderTopWidth) || 0;
        const br = parseFloat(cs.borderRightWidth) || 0;
        const bb = parseFloat(cs.borderBottomWidth) || 0;
        spec.view = { x: r.left + bl, y: r.top + bt, w: Math.max(1, r.width - bl - br), h: Math.max(1, r.height - bt - bb) };
      }
    });

    // 画布范围：元素盒 ∪ 文字，四周留出拖拽 / 标注余量；横向不越出视口（不出横向滚动）
    let x1 = elRect.left;
    let y1 = elRect.top;
    let x2 = elRect.right;
    let y2 = elRect.bottom;
    for (const it of items) {
      x1 = Math.min(x1, it.rect.left);
      y1 = Math.min(y1, it.rect.top);
      x2 = Math.max(x2, it.rect.right);
      y2 = Math.max(y2, it.rect.bottom);
    }
    const bleed = Math.max(16, Math.round(fontPx * 1.1));
    const vw = document.documentElement.clientWidth;
    const cx1 = Math.max(Math.min(x1, 0), x1 - bleed);
    const cx2 = Math.min(Math.max(x2, vw), x2 + bleed);
    const cy1 = y1 - bleed;
    const cy2 = y2 + bleed;
    cw = Math.max(1, Math.round(cx2 - cx1));
    ch = Math.max(1, Math.round(cy2 - cy1));

    // 先把画布放在 0,0 量出定位原点，再挪到目标处（兼容 border / padding / 行内元素）
    canvas.style.left = "0px";
    canvas.style.top = "0px";
    canvas.style.width = cw + "px";
    canvas.style.height = ch + "px";
    if (canvas.parentNode !== el) el.appendChild(canvas);
    const origin = canvas.getBoundingClientRect();
    const ox = Math.round(cx1 - origin.left);
    const oy = Math.round(cy1 - origin.top);
    canvas.style.left = ox + "px";
    canvas.style.top = oy + "px";
    const left0 = origin.left + ox;
    const top0 = origin.top + oy;
    canvasLeft0 = left0;
    canvasTop0 = top0;
    canvas.width = Math.max(1, Math.round(cw * dpr));
    canvas.height = Math.max(1, Math.round(ch * dpr));
    for (const spec of paintCache.values()) {
      if (spec.kind === "grad") spec.box = { x: spec.view.x - left0, y: spec.view.y - top0, w: spec.view.w, h: spec.view.h };
    }

    // 基线：文字片段的矩形 = 主字体的 ascent + descent，基线 = 顶 + ascent
    const previous = glyphs;
    const lines = [];
    glyphs = [];
    items.forEach((it, i) => {
      scratchCtx.font = it.font;
      scratchCtx.textAlign = "left";
      scratchCtx.textBaseline = "alphabetic";
      if ("letterSpacing" in scratchCtx) scratchCtx.letterSpacing = "0px";
      const m = scratchCtx.measureText(it.char);
      const fa = m.fontBoundingBoxAscent;
      const fd = m.fontBoundingBoxDescent;
      const h = it.rect.height;
      const asc = Number.isFinite(fa) && Number.isFinite(fd) && fa + fd > 0 ? (h * fa) / (fa + fd) : h * 0.8;
      const x = it.rect.left - left0;
      const baseline = it.rect.top - top0 + asc;
      let line = lines.find((l) => Math.abs(l.baseline - baseline) < h * 0.5);
      if (!line) {
        line = { top: it.rect.top - top0, bottom: it.rect.bottom - top0, baseline };
        lines.push(line);
      }
      const kept = previous[glyphs.length];
      const glyph = {
        char: it.char,
        font: it.font,
        paint: it.spec,
        x,
        baseline: line.baseline,
        line,
        box: {
          x1: x - m.actualBoundingBoxLeft,
          y1: line.baseline - m.actualBoundingBoxAscent,
          x2: x + m.actualBoundingBoxRight,
          y2: line.baseline + m.actualBoundingBoxDescent
        },
        offset: kept && kept.char === it.char ? kept.offset : { x: 0, y: 0 },
        velocity: kept && kept.char === it.char ? kept.velocity : { x: 0, y: 0 },
        outline: kept && kept.char === it.char ? kept.outline : 0,
        index: i
      };
      glyph.fill = sprite(glyph, false);
      glyph.dashes = sprite(glyph, true);
      glyphs.push(glyph);
    });
    if (dragging >= glyphs.length) dragging = -1;
    if (frame.index >= glyphs.length) frame.index = -1;
    textObserver?.takeRecords();
    return glyphs.length > 0;
  }

  /* ---------- 动画状态 ---------- */
  let last = 0;
  let lastPaint = 0;
  let visible = true; // IntersectionObserver
  let alive = true;
  let enabled = false;
  let presence = 0;
  let clock = 0;
  let pulse = 0;
  let placed = false;
  let dragging = -1;
  let sweepDone = !s.sweep;
  let sweepClock = 0;
  let focus = -1;
  const pointer = { x: 0, y: 0, inside: false };
  const grab = { x: 0, y: 0 };
  const lens = { x: 0, y: 0 };
  const frame = { x1: 0, y1: 0, x2: 0, y2: 0, alpha: 0, index: -1 };

  const textBounds = () => {
    let left = Infinity;
    let right = -Infinity;
    let top = Infinity;
    let bottom = -Infinity;
    for (const g of glyphs) {
      left = Math.min(left, g.box.x1);
      right = Math.max(right, g.box.x2);
      top = Math.min(top, g.line.top);
      bottom = Math.max(bottom, g.line.bottom);
    }
    return glyphs.length ? { left, right, top, bottom } : { left: 0, right: 0, top: 0, bottom: 0 };
  };

  /** 离 (x, y) 最近的字母（上游按横向距离挑，纵向只做容差过滤，适配多行） */
  function glyphAt(x, y) {
    let best = -1;
    let bestDistance = Infinity;
    const tol = metrics.hit;
    glyphs.forEach((g, i) => {
      const gx1 = g.box.x1 + g.offset.x;
      const gx2 = g.box.x2 + g.offset.x;
      const gy1 = Math.min(g.line.top, g.box.y1) + g.offset.y;
      const gy2 = Math.max(g.line.bottom, g.box.y2) + g.offset.y;
      const dx = x < gx1 ? gx1 - x : x > gx2 ? x - gx2 : 0;
      const dy = y < gy1 ? gy1 - y : y > gy2 ? y - gy2 : 0;
      if (dy > tol) return;
      const d = dx + dy * 0.5;
      if (d < bestDistance) {
        bestDistance = d;
        best = i;
      }
    });
    return bestDistance < tol ? best : -1;
  }

  function falloff(target, cx, cy, radius, strength, softness) {
    const inner = clamp(1 - softness, 0, 1);
    const gradient = target.createRadialGradient(cx, cy, 0, cx, cy, radius);
    gradient.addColorStop(0, `rgba(0,0,0,${strength})`);
    if (inner > 0.995) {
      gradient.addColorStop(0.995, `rgba(0,0,0,${strength})`);
      gradient.addColorStop(1, "rgba(0,0,0,0)");
      return gradient;
    }
    for (let i = 0; i <= FALLOFF_STEPS; i++) {
      const t = i / FALLOFF_STEPS;
      const eased = t * t * (3 - 2 * t);
      gradient.addColorStop(inner + (1 - inner) * t, `rgba(0,0,0,${strength * (1 - eased)})`);
    }
    return gradient;
  }

  function blit(target, art, dx, dy, originX, originY) {
    target.drawImage(art.image, Math.round((art.left + dx) * dpr - originX), Math.round((art.top + dy) * dpr - originY));
  }

  function drawReveal() {
    const radius = metrics.reach * dpr;
    const cx = lens.x * dpr;
    const cy = lens.y * dpr;
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = falloff(ctx, cx, cy, radius, presence, s.softness);
    ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
    ctx.globalCompositeOperation = "source-over";
    const x0 = Math.max(0, Math.floor(cx - radius));
    const y0 = Math.max(0, Math.floor(cy - radius));
    const x1 = Math.min(canvas.width, Math.ceil(cx + radius));
    const y1 = Math.min(canvas.height, Math.ceil(cy + radius));
    if (x1 <= x0 || y1 <= y0) return;
    const w = x1 - x0;
    const h = y1 - y0;
    if (scratch.width < w || scratch.height < h) {
      scratch.width = Math.max(scratch.width, w);
      scratch.height = Math.max(scratch.height, h);
    }
    scratchCtx.setTransform(1, 0, 0, 1, 0, 0);
    scratchCtx.globalCompositeOperation = "source-over";
    scratchCtx.clearRect(0, 0, w, h);
    for (const g of glyphs) blit(scratchCtx, g.dashes, g.offset.x, g.offset.y, x0, y0);
    scratchCtx.globalCompositeOperation = "destination-in";
    scratchCtx.fillStyle = falloff(scratchCtx, cx - x0, cy - y0, radius, 1, s.softness);
    scratchCtx.fillRect(0, 0, w, h);
    scratchCtx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = presence;
    ctx.drawImage(scratch, 0, 0, w, h, x0, y0, w, h);
    ctx.globalAlpha = 1;
  }

  const crisp = (v) => (Math.round(v * dpr) + 0.5) / dpr;

  function perimeterPoint(distance, w, h) {
    const p = 2 * (w + h);
    let d = ((distance % p) + p) % p;
    if (d < w) return [frame.x1 + d, frame.y1, 0, -1];
    d -= w;
    if (d < h) return [frame.x2, frame.y1 + d, 1, 0];
    d -= h;
    if (d < w) return [frame.x2 - d, frame.y2, 0, 1];
    d -= w;
    return [frame.x1, frame.y2 - d, -1, 0];
  }

  function drawSpecks(a) {
    const w = frame.x2 - frame.x1;
    const h = frame.y2 - frame.y1;
    if (w < 2 || h < 2) return;
    const k0 = metrics.speck;
    const perimeter = 2 * (w + h);
    const seed = frame.index + 1;
    const grid = Math.max(1, Math.round(3 * k0));
    ctx.fillStyle = colors.accent;
    ctx.strokeStyle = colors.accent;
    for (let k = 0; k < s.specks; k++) {
      const period = 0.5 + noise(seed, k, 11) * 1.2;
      const t = pulse / period + noise(seed, k, 17);
      const cycle = Math.floor(t);
      const life = t - cycle;
      if (life > 0.7) continue;
      const [px, py, nx, ny] = perimeterPoint(noise(seed, k, cycle) * perimeter, w, h);
      const pick = noise(seed, k, cycle, 2);
      const raw = pick < 0.46 ? 2 : pick < 0.7 ? 3 : pick < 0.84 ? 5 : pick < 0.94 ? 8 : 11;
      const size = Math.max(1, Math.round(raw * k0));
      const large = raw >= 8;
      const out = ((large ? 9 : 4) + Math.floor(noise(seed, k, cycle, 1) * 5) * 3) * k0;
      const x = frame.x1 + Math.round((px + nx * out - frame.x1) / grid) * grid;
      const y = frame.y1 + Math.round((py + ny * out - frame.y1) / grid) * grid;
      const tone = noise(seed, k, cycle, 3);
      const blink = life < 0.06 || (life > 0.32 && life < 0.36) ? 0.35 : 1;
      ctx.globalAlpha = a * (large ? 0.3 + 0.4 * tone : 0.3 + 0.6 * tone) * blink;
      const left = Math.round(x - size / 2);
      const top = Math.round(y - size / 2);
      if ((tone < 0.26 || (large && tone < 0.78)) && size >= 3) ctx.strokeRect(left + 0.5, top + 0.5, size, size);
      else ctx.fillRect(left, top, size, size);
    }
    for (let j = 0; j < 2; j++) {
      const head = (pulse * 0.42 * s.speed + j * 0.5) * perimeter;
      for (let i = 0; i < 4; i++) {
        const [x, y] = perimeterPoint(head - i * 6 * k0, w, h);
        const size = i === 0 ? 2 : 1.5;
        ctx.globalAlpha = a * [0.95, 0.55, 0.32, 0.16][i];
        ctx.fillRect(Math.round(x - size / 2), Math.round(y - size / 2), size, size);
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawFrame() {
    const glyph = glyphs[frame.index];
    if (!glyph || frame.alpha < 0.01) return;
    const a = frame.alpha;
    const x1 = crisp(frame.x1);
    const y1 = crisp(frame.y1);
    const x2 = crisp(frame.x2);
    const y2 = crisp(frame.y2);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineWidth = 1;

    const moved = Math.hypot(glyph.offset.x, glyph.offset.y);
    if (moved > 1) {
      const hx = (glyph.box.x1 + glyph.box.x2) / 2;
      const hy = (glyph.box.y1 + glyph.box.y2) / 2;
      ctx.beginPath();
      ctx.moveTo(hx, hy);
      ctx.lineTo(hx + glyph.offset.x, hy + glyph.offset.y);
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = colors.accent;
      ctx.globalAlpha = 0.45 * a;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 0.7 * a;
      ctx.fillStyle = colors.accent;
      ctx.fillRect(Math.round(hx) - 1.5, Math.round(hy) - 1.5, 3, 3);
    }

    ctx.beginPath();
    ctx.rect(x1, y1, x2 - x1, y2 - y1);
    ctx.strokeStyle = colors.accent;
    ctx.globalAlpha = 0.5 * a;
    ctx.stroke();

    const c = metrics.corner;
    ctx.beginPath();
    for (const [px, py] of [
      [x1, y1],
      [x2, y1],
      [x2, y2],
      [x1, y2]
    ]) {
      ctx.rect(Math.round(px - c / 2), Math.round(py - c / 2), c, c);
    }
    ctx.fillStyle = colors.accent;
    ctx.globalAlpha = 0.95 * a;
    ctx.fill();
    ctx.globalAlpha = 1;

    if (s.specks > 0 && !reduced()) drawSpecks(a);

    if (!metrics.labels) return;
    ctx.font = `500 ${metrics.labelSize}px ${LABEL_FAMILY}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.fillStyle = colors.label;
    ctx.globalAlpha = colors.labelAlpha * a;
    const label =
      moved > 1
        ? `${signed(Math.round(glyph.offset.x))}, ${signed(Math.round(-glyph.offset.y))}`
        : `${glyph.char}  ${Math.round(glyph.box.x2 - glyph.box.x1)} × ${Math.round(glyph.box.y2 - glyph.box.y1)}`;
    const ly = Math.round(frame.y1) - Math.max(3, Math.round(metrics.pad));
    // 选框上方放不下（越出画布或视口顶）就不画标注
    if (ly - metrics.labelSize >= 0 && canvasTop0 + ly - metrics.labelSize >= 0) ctx.fillText(label, Math.round(frame.x1), ly);
    ctx.globalAlpha = 1;
  }

  function clampOffset(g, ox, oy) {
    return [clamp(ox, -g.box.x1, cw - g.box.x2), clamp(oy, -g.box.y1, ch - g.box.y2)];
  }

  const interacting = () => pointer.inside || dragging >= 0;

  /** 推进一步状态；返回是否还需要下一帧 */
  function step(dt) {
    const rm = reduced();
    const view = textBounds();
    let sweeping = false;
    if (s.sweep && !rm && !pointer.inside && dragging < 0 && glyphs.length) {
      sweeping = s.sweep === "loop" || !sweepDone;
    }
    let targetX = pointer.x;
    let targetY = pointer.y;
    if (sweeping) {
      if (s.sweep === "loop") {
        // 上游轨迹：扫描点在文字上左右往复，选框一个字一个字地跳
        clock += dt * s.speed;
        targetX = view.left + (view.right - view.left) * (0.5 - 0.5 * Math.cos(clock * 0.45));
        targetY = view.top + (view.bottom - view.top) * (0.45 + 0.1 * Math.sin(clock * 0.8));
      } else {
        sweepClock += (dt * s.speed) / 1.8;
        const u = Math.min(1, sweepClock);
        const e = u * u * (3 - 2 * u);
        targetX = view.left + (view.right - view.left) * e;
        targetY = view.top + (view.bottom - view.top) * 0.5;
        if (u >= 1) sweepDone = true;
      }
    }
    pulse += dt;
    const active = pointer.inside || sweeping || dragging >= 0;
    if (active && !placed) {
      lens.x = targetX;
      lens.y = targetY;
    }
    if (active) {
      const lag = rm ? 0 : pointer.inside ? 0.05 : 0.22;
      lens.x = approach(lens.x, targetX, dt, lag);
      lens.y = approach(lens.y, targetY, dt, lag);
    }
    placed = active;
    const presenceTarget = s.reveal === "area" && active && dragging < 0 ? 1 : 0;
    presence = approach(presence, presenceTarget, dt, rm ? 0 : 0.16);
    if (Math.abs(presence - presenceTarget) < 0.002) presence = presenceTarget;

    let moving = false;
    glyphs.forEach((g, i) => {
      if (i === dragging) {
        const [tx, ty] = clampOffset(g, pointer.x - grab.x, pointer.y - grab.y);
        g.offset.x = approach(g.offset.x, tx, dt, rm ? 0 : 0.03);
        g.offset.y = approach(g.offset.y, ty, dt, rm ? 0 : 0.03);
        g.velocity.x = 0;
        g.velocity.y = 0;
        moving = true;
        return;
      }
      const { offset, velocity } = g;
      if (rm || (Math.abs(offset.x) < 0.05 && Math.abs(offset.y) < 0.05 && Math.hypot(velocity.x, velocity.y) < 0.5)) {
        offset.x = 0;
        offset.y = 0;
        velocity.x = 0;
        velocity.y = 0;
        return;
      }
      velocity.x += (-SPRING * offset.x - DAMPING * velocity.x) * dt;
      velocity.y += (-SPRING * offset.y - DAMPING * velocity.y) * dt;
      offset.x += velocity.x * dt;
      offset.y += velocity.y * dt;
      moving = true;
    });

    focus = s.reveal === "off" && dragging < 0 ? -1 : dragging >= 0 ? dragging : active ? glyphAt(lens.x, lens.y) : -1;
    if (focus >= 0 && s.selection) {
      const g = glyphs[focus];
      const p = metrics.pad;
      const bx1 = g.box.x1 + g.offset.x - p;
      const by1 = g.box.y1 + g.offset.y - p;
      const bx2 = g.box.x2 + g.offset.x + p;
      const by2 = g.box.y2 + g.offset.y + p;
      if (frame.index < 0 || frame.alpha < 0.02) {
        frame.x1 = bx1;
        frame.y1 = by1;
        frame.x2 = bx2;
        frame.y2 = by2;
      }
      const glide = rm ? 0 : focus === dragging ? 0.02 : 0.08;
      frame.x1 = approach(frame.x1, bx1, dt, glide);
      frame.y1 = approach(frame.y1, by1, dt, glide);
      frame.x2 = approach(frame.x2, bx2, dt, glide);
      frame.y2 = approach(frame.y2, by2, dt, glide);
      frame.index = focus;
    }
    const frameTarget = focus >= 0 && s.selection ? 1 : 0;
    frame.alpha = approach(frame.alpha, frameTarget, dt, rm ? 0 : 0.1);
    if (Math.abs(frame.alpha - frameTarget) < 0.01) frame.alpha = frameTarget;

    glyphs.forEach((g, i) => {
      const target = s.reveal === "letter" && i === focus && i !== dragging ? 1 : 0;
      g.outline = approach(g.outline, target, dt, rm ? 0 : 0.09);
      if (Math.abs(g.outline - target) > 0.002) moving = true;
      else g.outline = target;
    });

    if (s.draggable) el.style.cursor = dragging >= 0 ? "grabbing" : focus >= 0 && pointer.inside ? "grab" : savedCursor;

    const settling = moving || presence !== presenceTarget || frame.alpha !== frameTarget;
    const lensMoving = Math.hypot(lens.x - targetX, lens.y - targetY) > 0.3;
    // 选框在（specks 一直闪）/ 在扫描 / 在收敛：继续；reduced-motion 下悬停只画静态帧
    return settling || (active && !rm && (focus >= 0 || sweeping || lensMoving));
  }

  function paint() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const g of glyphs) {
      const moved = Math.hypot(g.offset.x, g.offset.y);
      if (moved > 1) {
        // 被拖走的字母在原位留一个虚线「影子」
        ctx.globalAlpha = Math.min(1, moved / (fontPx * 0.8)) * 0.55;
        blit(ctx, g.dashes, 0, 0, 0, 0);
        ctx.globalAlpha = 1;
      }
    }
    for (const g of glyphs) {
      if (g.outline < 0.999) {
        ctx.globalAlpha = 1 - g.outline;
        blit(ctx, g.fill, g.offset.x, g.offset.y, 0, 0);
      }
      if (g.outline > 0.001) {
        ctx.globalAlpha = g.outline;
        blit(ctx, g.dashes, g.offset.x, g.offset.y, 0, 0);
      }
      ctx.globalAlpha = 1;
    }
    if (presence > 0.001) drawReveal();
    drawFrame();
  }

  /**
   * 同步画一帧（不推进时间）。渲染 bug 的修法就在这里：
   * 旧版挂载时同步把原文字设成透明，第一次 layout + 绘制却要等 rAF，且 rAF 只在
   * document.visibilityState === "visible" 且 IntersectionObserver 报可见时才排——
   * 页面在后台标签 / 隐藏的预览窗格里加载（visibilityState 为 hidden）时 wake() 直接返回，
   * 画布一直是默认的 300×150、什么都没画，原文字又已透明 → 整段空白；只有之后
   * 收到 IO 回调（滚进视口）且恰好可见的那个才画出来。
   * 现在：layout + 静态帧同步画（不依赖 rAF / 可见性），画成功后才隐藏原文字；
   * rAF 只用来跑动画，浏览器在隐藏标签里本来就会暂停 rAF。
   */
  function render() {
    if (!alive || !enabled) return false;
    if (layoutDirty && !layout()) {
      if (hidden) showText();
      return false;
    }
    if (!glyphs.length) return false;
    paint();
    if (!hidden) hideText();
    return true;
  }

  /** 共享时钟每帧调用；返回 false = 这一实例停下来 */
  function frameTick(now) {
    if (!alive || !enabled || !visible) return false;
    // 无交互时限 30fps（扫描 / specks 不需要 60fps）
    if (!interacting() && now - lastPaint < IDLE_FRAME_MS - 1) return true;
    const dt = clamp((now - last) / 1000, 0.001, 0.05);
    last = now;
    lastPaint = now;
    if (layoutDirty && !render()) return false;
    const more = step(dt);
    paint();
    return more;
  }
  const inst = { frame: frameTick };

  function wake() {
    if (!alive || !enabled || !visible || running.has(inst)) return;
    last = performance.now();
    lastPaint = 0;
    startLoop(inst);
  }

  // 布局失效：合并到一个微任务里同步重画（不等 rAF），然后唤醒动画
  let renderQueued = false;
  function invalidate(colorsToo = false) {
    layoutDirty = true;
    if (colorsToo) colorsDirty = true;
    if (renderQueued || !alive || !enabled) return;
    renderQueued = true;
    queueMicrotask(() => {
      renderQueued = false;
      if (render()) wake();
    });
  }

  /* ---------- 指针 ---------- */
  const savedCursor = el.style.cursor;
  const locate = (e) => {
    const r = canvas.getBoundingClientRect();
    pointer.x = e.clientX - r.left;
    pointer.y = e.clientY - r.top;
  };
  const hoverable = (e) => e.pointerType !== "touch" && mqFine.matches && s.reveal !== "off";
  function onMove(e) {
    if (dragging >= 0) {
      locate(e);
      wake();
      return;
    }
    if (!hoverable(e)) return;
    locate(e);
    pointer.inside = true;
    wake();
  }
  function onLeave() {
    if (dragging >= 0) return;
    pointer.inside = false;
    wake();
  }
  let downAt = null;
  function onDown(e) {
    if (!s.draggable || (e.pointerType === "mouse" && e.button !== 0) || !enabled) return;
    if (layoutDirty) render();
    if (!glyphs.length) return;
    locate(e);
    const index = glyphAt(pointer.x, pointer.y);
    if (index < 0) return;
    dragging = index;
    downAt = { x: e.clientX, y: e.clientY };
    grab.x = pointer.x - glyphs[index].offset.x;
    grab.y = pointer.y - glyphs[index].offset.y;
    // 鼠标抓字母时不要开始选中文字 / 拖动链接；触屏不拦（纵向滚动交给浏览器）
    if (e.pointerType === "mouse") e.preventDefault();
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      /* 无所谓 */
    }
    if (hoverable(e)) pointer.inside = true;
    wake();
  }
  let suppressClick = false;
  function onUp(e) {
    if (dragging < 0) return;
    dragging = -1;
    try {
      el.releasePointerCapture(e.pointerId);
    } catch {
      /* 已释放 */
    }
    if (downAt && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 4) {
      suppressClick = true;
      // 没有后续 click（例如松手在元素外）时别把下一次正常点击吞掉
      setTimeout(() => (suppressClick = false), 400);
    }
    downAt = null;
    const r = el.getBoundingClientRect();
    pointer.inside =
      hoverable(e) && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    wake();
  }
  function onClick(e) {
    // 拖拽结束后的那次 click 不触发（元素在链接里时不误跳转）
    if (suppressClick) {
      suppressClick = false;
      e.preventDefault();
      e.stopPropagation();
    }
  }
  function onDragStart(e) {
    // 元素在 <a> 里：抓字母时不要触发浏览器原生的链接拖拽
    if (dragging >= 0) e.preventDefault();
  }

  /* ---------- 观察者 ---------- */
  const textObserver = new MutationObserver((records) => {
    const ours = (n) => n === canvas;
    const relevant = records.some(
      (r) =>
        r.type === "characterData" ||
        Array.from(r.addedNodes).some((n) => !ours(n)) ||
        Array.from(r.removedNodes).some((n) => !ours(n))
    );
    if (canvas.parentNode !== el && enabled) el.appendChild(canvas);
    if (relevant) invalidate(true);
  });
  const resizeObserver = new ResizeObserver(() => invalidate());
  const intersection = new IntersectionObserver((entries) => {
    visible = entries[entries.length - 1].isIntersecting;
    if (visible) {
      if (layoutDirty) render();
      wake();
    } else stopLoop(inst);
  });
  const themeObserver = new MutationObserver(() => invalidate(true));
  const onScheme = () => invalidate(true);
  const onWindowResize = () => invalidate();
  const onVisibility = () => {
    if (document.visibilityState === "hidden") return; // rAF 由浏览器暂停
    if (layoutDirty) render();
    wake();
  };
  const onReduced = () => {
    if (!enabled) return;
    step(0);
    paint();
    wake();
  };
  const onFonts = () => invalidate();
  const onForced = () => {
    if (mqForced.matches) disable();
    else enable();
  };
  const onBeforePrint = () => disable();
  const onAfterPrint = () => {
    if (!mqForced.matches) enable();
  };

  function enable() {
    if (enabled || !alive) return;
    enabled = true;
    applyBase();
    colorsDirty = true;
    layoutDirty = true;
    if (render()) wake();
  }
  function disable() {
    enabled = false;
    stopLoop(inst);
    canvas.remove();
    restoreAll();
    el.classList.remove("tech-text");
    hidden = false;
    based = false;
    el.style.cursor = savedCursor;
    textObserver.takeRecords();
  }

  el.addEventListener("pointermove", onMove, { passive: true });
  el.addEventListener("pointerenter", onMove, { passive: true });
  el.addEventListener("pointerleave", onLeave, { passive: true });
  el.addEventListener("pointerdown", onDown);
  el.addEventListener("pointerup", onUp, { passive: true });
  el.addEventListener("pointercancel", onUp, { passive: true });
  el.addEventListener("click", onClick, true);
  el.addEventListener("dragstart", onDragStart);
  textObserver.observe(el, { childList: true, characterData: true, subtree: true });
  resizeObserver.observe(el);
  intersection.observe(el);
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme", "data-palette", "data-scheme", "style", "class"]
  });
  mqDark.addEventListener("change", onScheme);
  mqForced.addEventListener("change", onForced);
  mqReduced.addEventListener("change", onReduced);
  window.addEventListener("resize", onWindowResize);
  window.addEventListener("beforeprint", onBeforePrint);
  window.addEventListener("afterprint", onAfterPrint);
  document.addEventListener("visibilitychange", onVisibility);
  if (document.fonts) {
    document.fonts.ready.then(onFonts, onFonts);
    document.fonts.addEventListener?.("loadingdone", onFonts);
  }

  const handle = {
    /** 重新读颜色、重新量 DOM（文字 / 尺寸 / 主题 / 字体变化都会自动处理，一般不需要） */
    refresh() {
      invalidate(true);
    },
    destroy() {
      if (!alive) return;
      disable();
      alive = false;
      textObserver.disconnect();
      resizeObserver.disconnect();
      intersection.disconnect();
      themeObserver.disconnect();
      mqDark.removeEventListener("change", onScheme);
      mqForced.removeEventListener("change", onForced);
      mqReduced.removeEventListener("change", onReduced);
      window.removeEventListener("resize", onWindowResize);
      window.removeEventListener("beforeprint", onBeforePrint);
      window.removeEventListener("afterprint", onAfterPrint);
      document.removeEventListener("visibilitychange", onVisibility);
      document.fonts?.removeEventListener?.("loadingdone", onFonts);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerenter", onMove);
      el.removeEventListener("pointerleave", onLeave);
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      el.removeEventListener("click", onClick, true);
      el.removeEventListener("dragstart", onDragStart);
      registry.delete(el);
    }
  };
  registry.set(el, handle);

  if (!mqForced.matches) enable();
  return handle;
}

/** 当前在跑动画的实例数（调试 / 测试用） */
export const runningCount = () => running.size;

/**
 * 批量增强：选择器（缺省 ".app-title"）、单个元素或元素列表。返回 handle 数组（已增强的元素返回原 handle）。
 */
export function enhanceTechText(selectorOrRoot = ".app-title", options = {}) {
  let els;
  if (typeof selectorOrRoot === "string") els = document.querySelectorAll(selectorOrRoot);
  else if (selectorOrRoot instanceof Element) els = [selectorOrRoot];
  else els = selectorOrRoot || [];
  return Array.from(els, (el) => mountTechText(el, options));
}
