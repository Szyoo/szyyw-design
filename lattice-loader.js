/* ============================================================
   @szyyw/design · lattice-loader.js
   方格波浪加载器 + 实时秒表，完成 / 失败时方格拼成 ✓ / ✕ 定格。用来替代长任务的「加载中…」。
   出处：React Bits Lattice Loader（David Haz），MIT + Commons Clause。

     import { mountLatticeLoader } from "@szyyw/design/lattice-loader";
     const l = mountLatticeLoader(el, { label: "生成中", doneLabel: "完成，用时", errorLabel: "失败，用时" });
     l.set({ status: "done" });        // 秒表定格；也可 set({ status: "error" })
     l.destroy();

   选项（上游全部保留）：
     label "Thinking" / doneLabel "Done in" / errorLabel "Failed after"：三种状态的文字
     status "working"（缺省）| "done" | "error"（别名 "running" = working）
     pattern：命名图案 "orbit"（缺省）| "arrow" | "dots" | "ripple" | "snake" | "spiral" | "sweep" | "spin" | "rain" | "pulse"，
       或自定义 { cells: (number|null)[], loop?, scale?, lit?: 0.25|0.35|0.45|0.62 }（cells 为各格点亮的先后单位，null = 空洞）；
       命名图案没有当前 grid 的版本时回落到该 grid 的缺省图案
     grid 3 | 4（缺省 3）/ shape "round"（缺省）| "square" / cellSize 6 / gap 2 / fontSize 14
     step 90（波浪每步 ms）/ idleOpacity 0.15 / glow false / glowColor
     color（缺省 currentColor）/ doneColor（缺省 --ok）/ errorColor（缺省 --err）：CSS 颜色或 token 名
     showTimer true / elapsed（秒；给了就由外部控制秒表，不自走）
   秒表：working 时每 100ms 刷新（tabular-nums），切到 done / error 时定格；再切回 working 从 0 重新计时。
   读屏：role="status"，状态变化时播报「文字 + 用时」。
   reduced-motion：方格改慢速呼吸，无位移。
   模块顶层不碰 DOM。
   ============================================================ */

const PATTERNS = {
  arrow: { 3: { cells: [1, 2, 3, 0, 1, 2, 1, 2, 3], loop: 7.2, scale: 1 } },
  dots: { 3: { cells: [0, 1, 2, 0, 1, 2, 0, 1, 2], loop: 3, scale: 2.4 } },
  ripple: { 3: { cells: [2, 1, 2, 1, 0, 1, 2, 1, 2], loop: 4.8, scale: 1.5 } },
  spiral: { 3: { cells: [0, 1, 2, 7, 8, 3, 6, 5, 4], loop: 9, scale: 1.2, lit: 0.35 } },
  orbit: {
    3: { cells: [0, 1, 2, 7, null, 3, 6, 5, 4], loop: 8, scale: 1.2 },
    4: { cells: [0, 1, 2, 3, 11, null, null, 4, 10, null, null, 5, 9, 8, 7, 6], loop: 6, scale: 1.2, lit: 0.45 }
  },
  snake: {
    3: { cells: [0, 1, 2, 5, 4, 3, 6, 7, 8], loop: 9, scale: 1, lit: 0.35 },
    4: { cells: [0, 1, 2, 3, 7, 6, 5, 4, 8, 9, 10, 11, 15, 14, 13, 12], loop: 16, scale: 1, lit: 0.25 }
  },
  sweep: { 4: { cells: [0, 1, 2, 3, 1, 2, 3, 4, 2, 3, 4, 5, 3, 4, 5, 6], loop: 5, scale: 1, lit: 0.45 } },
  spin: { 4: { cells: [0, 0, 1, 1, 0, 0, 1, 1, 3, 3, 2, 2, 3, 3, 2, 2], loop: 4, scale: 1.6, lit: 0.35 } },
  rain: { 4: { cells: [0, 2, 1, 3, 1, 3, 2, 4, 2, 4, 3, 5, 3, 5, 4, 6], loop: 4, scale: 1.2, lit: 0.35 } },
  pulse: { 4: { cells: [2, 1, 1, 2, 1, 0, 0, 1, 1, 0, 0, 1, 2, 1, 1, 2], loop: 2.4, scale: 2.5, lit: 0.45 } }
};
const DEFAULT_PATTERN = { 3: "orbit", 4: "sweep" };
const MARKS = {
  3: { done: [2, 3, 5, 7], error: [0, 2, 4, 6, 8] },
  4: { done: [7, 8, 10, 13], error: [0, 3, 5, 6, 9, 10, 12, 15] }
};
const DEFAULTS = {
  label: "Thinking",
  doneLabel: "Done in",
  errorLabel: "Failed after",
  status: "working",
  pattern: "orbit",
  grid: 3,
  shape: "round",
  color: undefined,
  doneColor: undefined,
  errorColor: undefined,
  cellSize: 6,
  gap: 2,
  fontSize: 14,
  step: 90,
  idleOpacity: 0.15,
  glow: false,
  glowColor: undefined,
  showTimer: true,
  elapsed: undefined
};

const colorOf = (v) => (typeof v === "string" && v.startsWith("--") ? `var(${v})` : v);
const normStatus = (s) => (s === "done" || s === "error" ? s : "working");

function resolvePattern(pattern, grid) {
  if (typeof pattern === "string") {
    const named = PATTERNS[pattern];
    return (named && named[grid]) || PATTERNS[DEFAULT_PATTERN[grid]][grid];
  }
  const cells = Array.from({ length: grid * grid }, (_, i) => pattern.cells?.[i] ?? null);
  const max = Math.max(0, ...cells.filter((v) => v != null));
  return { cells, loop: pattern.loop ?? max + 4.2, scale: pattern.scale ?? 1, lit: pattern.lit ?? 0.62 };
}
const fmt = (ds) => (ds < 600 ? `${(ds / 10).toFixed(1)}s` : `${Math.floor(ds / 600)}m ${((ds % 600) / 10).toFixed(1)}s`);

export function mountLatticeLoader(el, options = {}) {
  if (typeof document === "undefined" || !el) return { set() {}, destroy() {} };
  let o = { ...DEFAULTS };
  const hadClass = el.classList.contains("lattice-loader");
  const hadRole = el.getAttribute("role");
  el.classList.add("lattice-loader");
  el.setAttribute("role", "status");
  el.textContent = "";

  const gridEl = document.createElement("span");
  gridEl.className = "lattice-loader__grid";
  gridEl.setAttribute("aria-hidden", "true");
  const run = document.createElement("span");
  run.className = "lattice-loader__layer lattice-loader__run";
  const markL = document.createElement("span");
  markL.className = "lattice-loader__layer lattice-loader__mark";
  gridEl.append(run, markL);
  const labelWrap = document.createElement("span");
  labelWrap.className = "lattice-loader__label";
  labelWrap.setAttribute("aria-hidden", "true");
  const texts = {};
  for (const k of ["working", "done", "error"]) {
    const t = document.createElement("span");
    t.className = "lattice-loader__text";
    labelWrap.appendChild(t);
    texts[k] = t;
  }
  const timer = document.createElement("span");
  timer.className = "lattice-loader__timer";
  timer.setAttribute("aria-hidden", "true");
  const sr = document.createElement("span");
  sr.className = "lattice-loader__sr";
  el.append(gridEl, labelWrap, timer, sr);

  let ds = 0;
  let startedAt = 0;
  let iv = 0;
  let markKind = "done";
  let gridKey = "";
  let lastStatus = null;
  let destroyed = false;

  const paint = (v) => {
    ds = v;
    const t = fmt(v);
    if (timer.textContent !== t) timer.textContent = t;
  };
  const stopTimer = () => {
    clearInterval(iv);
    iv = 0;
  };

  function build(pat, n) {
    run.textContent = "";
    markL.textContent = "";
    const d = o.step * pat.scale;
    pat.cells.forEach((unit) => {
      const c = document.createElement("span");
      c.className = "lattice-loader__cell";
      if (unit == null) c.dataset.hole = "";
      else c.style.animationDelay = `${Math.round(unit * d)}ms`;
      if (unit != null && pat.lit && pat.lit !== 0.62) c.dataset.lit = String(Math.round(pat.lit * 100));
      run.appendChild(c);
      const m = document.createElement("span");
      m.className = "lattice-loader__cell";
      markL.appendChild(m);
    });
    void n;
  }

  function render() {
    const n = o.grid === 4 ? 4 : 3;
    const status = normStatus(o.status);
    const pat = resolvePattern(o.pattern, n);
    const d = o.step * pat.scale;
    const cycle = Math.round(pat.loop * d);
    const key = JSON.stringify([n, pat, o.step]);
    if (key !== gridKey) {
      gridKey = key;
      build(pat, n);
    }
    if (status !== "working") markKind = status;
    [...markL.children].forEach((c, i) => {
      if (MARKS[n][markKind].includes(i)) c.dataset.on = "";
      else delete c.dataset.on;
    });

    el.dataset.status = status;
    el.dataset.shape = o.shape;
    if (o.glow) el.dataset.glow = "";
    else delete el.dataset.glow;
    const s = el.style;
    s.setProperty("--ll-n", String(n));
    s.setProperty("--ll-cell", `${o.cellSize}px`);
    s.setProperty("--ll-gap", `${o.gap}px`);
    s.setProperty("--ll-font", `${o.fontSize}px`);
    s.setProperty("--ll-idle", String(o.idleOpacity));
    s.setProperty("--ll-cycle", `${cycle}ms`);
    for (const [k, v] of [["--ll-color", o.color], ["--ll-done", o.doneColor], ["--ll-error", o.errorColor], ["--ll-glow", o.glowColor]]) {
      if (v) s.setProperty(k, colorOf(v));
      else s.removeProperty(k);
    }

    texts.working.textContent = o.label;
    texts.done.textContent = o.doneLabel;
    texts.error.textContent = o.errorLabel;
    for (const k in texts) {
      if (k === status) texts[k].dataset.active = "";
      else delete texts[k].dataset.active;
    }
    timer.hidden = !o.showTimer;

    // 秒表
    stopTimer();
    if (o.elapsed != null) paint(Math.round(o.elapsed * 10));
    else if (status === "working") {
      if (lastStatus !== "working") {
        startedAt = performance.now();
        paint(0);
      }
      iv = setInterval(() => paint(Math.floor((performance.now() - startedAt) / 100)), 100);
    } else if (lastStatus === "working") paint(Math.floor((performance.now() - startedAt) / 100));
    else if (lastStatus === null) paint(0);

    if (status !== lastStatus) {
      const spoken = ds < 600 ? `${(ds / 10).toFixed(1)}` + " s" : `${Math.floor(ds / 600)} min ${((ds % 600) / 10).toFixed(1)} s`;
      sr.textContent = status === "working" ? `${o.label}…` : `${status === "done" ? o.doneLabel : o.errorLabel}${o.showTimer ? ` ${spoken}` : ""}`;
    }
    lastStatus = status;
  }

  function set(partial = {}) {
    if (destroyed) return;
    o = { ...o, ...partial };
    render();
  }
  set(options);

  return {
    set,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      stopTimer();
      el.textContent = "";
      if (!hadClass) el.classList.remove("lattice-loader");
      if (hadRole === null) el.removeAttribute("role");
      else el.setAttribute("role", hadRole);
      for (const k of ["status", "shape", "glow"]) delete el.dataset[k];
      for (const k of ["--ll-n", "--ll-cell", "--ll-gap", "--ll-font", "--ll-idle", "--ll-cycle", "--ll-color", "--ll-done", "--ll-error", "--ll-glow"])
        el.style.removeProperty(k);
    }
  };
}
