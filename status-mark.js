/* ============================================================
   @szyyw/design · status-mark.js
   状态标记：空心虚线圈 → 进度弧 → 勾 / 叉，可带文字（完成时划掉）。
   出处：React Bits Status Mark（David Haz），MIT + Commons Clause；motion 动画改为内置补间 + Web Animations。

     import { mountStatusMark, enhanceStatusMarks } from "@szyyw/design/status-mark";
     const m = mountStatusMark(el, { status: "running", progress: 0.4, label: "同步中" });
     m.set({ progress: 0.8 });  m.set({ status: "done" });  m.destroy();

     <span class="status-mark" data-status="running" data-progress="0.4" data-label="同步中"></span>
     enhanceStatusMarks();     // 声明式：data-* 变化会自动同步

   status：上游五态 "pending" | "running" | "done" | "failed" | "cancelled"；另接受别名
     "idle"（= pending）、"error"（= failed）。running 且无 progress = 不定进度（弧转圈，reduced-motion 下改呼吸）；
     running 且 progress 为 0–1 的数 = 定进度弧。
   选项（上游全部保留）：
     status / progress / label（字符串或 Node）
     color（缺省 currentColor）/ doneColor（缺省 --ok）/ errorColor（缺省 --err）：CSS 颜色或 token 名
     size 20 / strokeWidth 2 / dashes 8（待定态的虚线段数）/ fontSize 14
     spinDuration 1100ms / arcLength 0.68（不定进度弧占整圈比例）/ drawDuration 240ms（勾 / 叉描画）
     fillOpacity 0.06（完成 / 失败的圈内淡底）/ strike true（完成时划掉文字）/ strikeDelay 60ms
     texts：读屏文字覆盖，如 { running: "进行中" }
   声明式 data-*：status progress label size stroke-width dashes font-size spin-duration arc-length
     draw-duration fill-opacity strike（"false" 关）strike-delay color done-color error-color；
     挂载后只监听 data-status / data-progress / data-label 的变化。
   颜色只从 token：done = --ok，error = --err，随主题 / 配色 / 明暗换色。
   模块顶层不碰 DOM。
   ============================================================ */

const SVG_NS = "http://www.w3.org/2000/svg";
const CHECK = "M7.5 12.25 10.5 15.25 16.75 8.75";
const CROSS = "M8.5 8.5 15.5 15.5M15.5 8.5 8.5 15.5";
const TEXT = { pending: "Pending", running: "In progress", done: "Completed", failed: "Failed", cancelled: "Cancelled" };
const ALIAS = { idle: "pending", error: "failed" };
const IDLE_DASH = 0.3;
const DEFAULTS = {
  status: "pending",
  progress: undefined,
  label: undefined,
  color: undefined,
  doneColor: undefined,
  errorColor: undefined,
  size: 20,
  strokeWidth: 2,
  dashes: 8,
  fontSize: 14,
  spinDuration: 1100,
  arcLength: 0.68,
  drawDuration: 240,
  fillOpacity: 0.06,
  strike: true,
  strikeDelay: 60,
  texts: undefined
};

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const colorOf = (v) => (typeof v === "string" && v.startsWith("--") ? `var(${v})` : v);
const norm = (s) => ALIAS[s] ?? (TEXT[s] ? s : "pending");

// 三次贝塞尔缓动（CSS cubic-bezier 同款）
function bezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const X = (t) => ((ax * t + bx) * t + cx) * t;
  const Y = (t) => ((ay * t + by) * t + cy) * t;
  return (x) => {
    let t = x;
    for (let i = 0; i < 8; i++) {
      const d = (3 * ax * t + 2 * bx) * t + cx;
      if (Math.abs(d) < 1e-6) break;
      t -= (X(t) - x) / d;
    }
    return Y(Math.min(1, Math.max(0, t)));
  };
}
const MORPH = bezier(0.77, 0, 0.175, 1);
const SETTLE = bezier(0.22, 1, 0.36, 1);

function channel(initial, onUpdate) {
  let value = initial;
  let raf = 0;
  return {
    get: () => value,
    jump(v) {
      cancelAnimationFrame(raf);
      value = v;
      onUpdate();
    },
    to(v, ms, ease, done) {
      cancelAnimationFrame(raf);
      const from = value;
      if (from === v || ms <= 0) {
        value = v;
        onUpdate();
        done?.();
        return;
      }
      const t0 = performance.now();
      const tick = (now) => {
        const p = Math.min(1, (now - t0) / ms);
        value = from + (v - from) * ease(p);
        onUpdate();
        if (p < 1) raf = requestAnimationFrame(tick);
        else done?.();
      };
      raf = requestAnimationFrame(tick);
    },
    stop() {
      cancelAnimationFrame(raf);
    }
  };
}

const marks = new WeakMap();

export function mountStatusMark(el, options = {}) {
  if (typeof document === "undefined" || !el) return { set() {}, destroy() {} };
  marks.get(el)?.destroy();
  const mq = typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null;
  let o = { ...DEFAULTS };
  const hadClass = el.classList.contains("status-mark");
  el.classList.add("status-mark");
  el.textContent = "";

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "status-mark__glyph");
  svg.setAttribute("viewBox", "0 0 24 24");
  const mk = (tag, cls, attrs) => {
    const n = document.createElementNS(SVG_NS, tag);
    n.setAttribute("class", cls);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  };
  const track = mk("circle", "status-mark__track", { cx: 12, cy: 12, transform: "rotate(-90 12 12)" });
  const ring = mk("circle", "status-mark__ring", { cx: 12, cy: 12, transform: "rotate(-90 12 12)" });
  const check = mk("path", "status-mark__check", { d: CHECK, pathLength: 1 });
  const cross = mk("path", "status-mark__cross", { d: CROSS, pathLength: 1 });
  svg.append(track, ring, check, cross);
  const sr = document.createElement("span");
  sr.className = "status-mark__sr";
  const labelEl = document.createElement("span");
  labelEl.className = "status-mark__label";
  const textEl = document.createElement("span");
  const strike = document.createElement("span");
  strike.className = "status-mark__strike";
  strike.setAttribute("aria-hidden", "true");
  labelEl.append(textEl, strike);
  el.append(svg, sr, labelEl);

  let C = 0;
  let P = 0;
  const writeDash = () => {
    const m = mode.get();
    const a = arc.get();
    const dash = IDLE_DASH * P + (a * C - IDLE_DASH * P) * m;
    const gap = (1 - IDLE_DASH) * P + ((1 - a) * C - (1 - IDLE_DASH) * P) * m;
    ring.setAttribute("stroke-dasharray", `${Math.max(0, dash)} ${Math.max(0, gap)}`);
  };
  const mode = channel(0, writeDash);
  const arc = channel(1, writeDash);
  const travel = channel(0, () => ring.setAttribute("stroke-dashoffset", String(travel.get())));
  let spin = null;
  let destroyed = false;
  let first = true;
  let prev = { solid: false, indeterminate: false, determinate: false, target: 1 };

  function stopSpin() {
    if (!spin) return;
    const cur = parseFloat(getComputedStyle(ring).strokeDashoffset) || 0;
    spin.cancel();
    spin = null;
    travel.jump(cur);
  }

  function render() {
    const status = norm(o.status);
    const determinate = status === "running" && typeof o.progress === "number" && Number.isFinite(o.progress);
    const indeterminate = status === "running" && !determinate;
    const solid = status === "running" || status === "done" || status === "failed";
    const target = indeterminate ? o.arcLength : determinate ? clamp01(o.progress) : 1;
    const r = 10 - o.strokeWidth / 2;
    const geoChanged = first || C !== 2 * Math.PI * r || P !== C / Math.max(1, o.dashes);
    C = 2 * Math.PI * r;
    P = C / Math.max(1, o.dashes);
    track.setAttribute("r", r);
    ring.setAttribute("r", r);
    if (geoChanged) writeDash();

    el.dataset.status = status;
    if (indeterminate) el.dataset.indeterminate = "";
    else delete el.dataset.indeterminate;
    if (o.strike) el.dataset.struck = "";
    else delete el.dataset.struck;

    const s = el.style;
    s.setProperty("--sm-size", `${o.size}px`);
    s.setProperty("--sm-stroke", String(o.strokeWidth));
    s.setProperty("--sm-fill", String(o.fillOpacity));
    s.setProperty("--sm-font", `${o.fontSize}px`);
    s.setProperty("--sm-draw", `${o.drawDuration}ms`);
    s.setProperty("--sm-strike-delay", `${120 + o.strikeDelay}ms`);
    for (const [k, v] of [["--sm-color", o.color], ["--sm-done", o.doneColor], ["--sm-error", o.errorColor]]) {
      if (v) s.setProperty(k, colorOf(v));
      else s.removeProperty(k);
    }
    svg.setAttribute("width", o.size);
    svg.setAttribute("height", o.size);

    const hasLabel = o.label !== undefined && o.label !== null && o.label !== "";
    const texts = { ...TEXT, ...(o.texts || {}) };
    const spoken = texts[status] + (determinate ? `, ${Math.round(clamp01(o.progress) * 100)}%` : "");
    if (hasLabel) {
      svg.removeAttribute("role");
      svg.removeAttribute("aria-label");
      svg.setAttribute("aria-hidden", "true");
      sr.textContent = `${spoken}: `;
      sr.hidden = false;
      labelEl.hidden = false;
      if (o.label instanceof Node) textEl.replaceChildren(o.label);
      else textEl.textContent = String(o.label);
    } else {
      svg.removeAttribute("aria-hidden");
      svg.setAttribute("role", "img");
      svg.setAttribute("aria-label", spoken);
      sr.hidden = true;
      labelEl.hidden = true;
    }

    // ---- 动画 ----
    const reduce = !!mq?.matches;
    if (reduce) {
      stopSpin();
      mode.jump(solid ? 1 : 0);
      arc.jump(target);
      travel.jump(0);
    } else {
      if (mode.get() === 0 || first) arc.jump(target);
      mode.to(solid ? 1 : 0, 300, MORPH);
      arc.to(target, 300, SETTLE);
      if (indeterminate) {
        if (!prev.indeterminate || !spin) {
          stopSpin();
          const t0 = travel.get();
          travel.stop();
          spin = ring.animate([{ strokeDashoffset: `${t0}px` }, { strokeDashoffset: `${t0 - C}px` }], {
            duration: o.spinDuration,
            iterations: Infinity,
            easing: "linear"
          });
        }
      } else if (prev.indeterminate || spin) {
        stopSpin();
        const unit = determinate ? C : P;
        const to = Math.floor(travel.get() / unit) * unit;
        travel.to(to, 300, SETTLE, () => travel.jump(0));
      } else if (determinate !== prev.determinate) {
        const unit = determinate ? C : P;
        const to = Math.floor(travel.get() / unit) * unit;
        travel.to(to, 300, SETTLE, () => travel.jump(0));
      }
    }
    if (first) ring.setAttribute("stroke-dashoffset", String(travel.get()));
    prev = { solid, indeterminate, determinate, target };
    first = false;
  }

  function set(partial = {}) {
    if (destroyed) return;
    o = { ...o, ...partial };
    render();
  }
  set(options);

  const handle = {
    set,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      mode.stop();
      arc.stop();
      travel.stop();
      spin?.cancel();
      el.textContent = "";
      if (!hadClass) el.classList.remove("status-mark");
      for (const k of ["status", "indeterminate", "struck"]) delete el.dataset[k];
      for (const k of ["--sm-size", "--sm-stroke", "--sm-fill", "--sm-font", "--sm-draw", "--sm-strike-delay", "--sm-color", "--sm-done", "--sm-error"])
        el.style.removeProperty(k);
      marks.delete(el);
    }
  };
  marks.set(el, handle);
  return handle;
}

const num = (v) => (v === undefined || v === "" || Number.isNaN(Number(v)) ? undefined : Number(v));
function readData(el, withOptions) {
  const d = el.dataset;
  const text = el.dataset.label ?? undefined;
  const out = { status: d.status ?? "pending", progress: num(d.progress), label: text };
  if (!withOptions) return out;
  const map = { size: "size", strokeWidth: "strokeWidth", dashes: "dashes", fontSize: "fontSize", spinDuration: "spinDuration", arcLength: "arcLength", drawDuration: "drawDuration", fillOpacity: "fillOpacity", strikeDelay: "strikeDelay" };
  for (const k in map) {
    const v = num(d[k]);
    if (v !== undefined) out[map[k]] = v;
  }
  if (d.strike !== undefined) out.strike = !(d.strike === "false" || d.strike === "0");
  if (d.color) out.color = d.color;
  if (d.doneColor) out.doneColor = d.doneColor;
  if (d.errorColor) out.errorColor = d.errorColor;
  return out;
}

/**
 * 处理 root（缺省 document）里所有 .status-mark[data-status]：用 data-* 挂载，并监听 data-status /
 * data-progress / data-label 的变化。元素原有文字（无 data-label 时）当作文字标签。已挂过的跳过。
 * @returns {() => void}
 */
export function enhanceStatusMarks(root = document) {
  if (typeof document === "undefined") return () => {};
  const scope = root || document;
  const picks = [];
  if (scope.matches?.(".status-mark[data-status]")) picks.push(scope);
  picks.push(...scope.querySelectorAll(".status-mark[data-status]"));
  const offs = [];
  for (const el of picks) {
    if (marks.has(el)) continue;
    const opts = readData(el, true);
    if (opts.label === undefined) {
      const t = el.textContent.trim();
      if (t) opts.label = t;
    }
    const h = mountStatusMark(el, opts);
    // 只在输入真的变了时才 set：挂载会把 data-status 写成规范值（idle → pending），不能因此回环
    let last = { status: norm(opts.status), progress: opts.progress, label: opts.label };
    const mo = new MutationObserver(() => {
      const d = readData(el, false);
      const status = norm(d.status);
      if (status === last.status && d.progress === last.progress && d.label === last.label) return;
      last = { status, progress: d.progress, label: d.label };
      h.set({ status, progress: d.progress, ...(d.label !== undefined ? { label: d.label } : {}) });
    });
    mo.observe(el, { attributes: true, attributeFilter: ["data-status", "data-progress", "data-label"] });
    offs.push(() => {
      mo.disconnect();
      h.destroy();
    });
  }
  return () => offs.forEach((f) => f());
}
