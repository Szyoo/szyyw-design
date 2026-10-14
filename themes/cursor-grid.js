/* ============================================================
   @szyyw/design · themes/cursor-grid.js
   背景主题「光标网格」（v0.19.0）：指针经过处的格子亮起、停留后淡出，点击发出一圈扩散脉冲。
   出处：React Bits CursorGrid（David Haz），MIT + Commons Clause。

   移植说明：React 组件 → 框架无关 ESM（Canvas 2D）。参数全部保留、名字不变；
   color 改为 token 选择（缺省 --accent），配色 / 明暗切换即时换色。与上游的差异：
   - 指针在 window 上监听（背景层不接事件、不拦截页面点击），只在 pointer: fine 下启用；
   - gridOpacity 缺省 0.08（上游 0）：触屏 / 减少动效时背景也不至于全空；
   - 新增 fps 上限（缺省 30）；空闲（无亮格、无脉冲）时不跑 rAF；标签页隐藏时停；
   - prefers-reduced-motion：只画静态网格，不做亮起 / 脉冲动画。
   ============================================================ */

const L = (zh, ja, en) => ({ zh, ja, en });

const COLOR_TOKENS = [
  { value: "--accent", labels: L("主色", "アクセント", "Accent") },
  { value: "--accent2", labels: L("辅色", "アクセント 2", "Accent 2") },
  { value: "--df-from", labels: L("点阵色 A", "ドット色 A", "Dot color A") },
  { value: "--df-to", labels: L("点阵色 B", "ドット色 B", "Dot color B") },
  { value: "--text", labels: L("文字色", "文字色", "Text") },
  { value: "--text-dim", labels: L("次要文字色", "補助文字色", "Dim text") }
];

export const meta = {
  id: "cursor-grid",
  labels: L("光标网格", "カーソルグリッド", "Cursor Grid"),
  params: [
    { key: "color", type: "token", default: "--accent", options: COLOR_TOKENS, labels: L("颜色", "色", "Color") },
    { key: "cellSize", type: "range", min: 20, max: 160, step: 1, default: 70, labels: L("格子大小", "セルサイズ", "Cell size") },
    { key: "radius", type: "range", min: 20, max: 480, step: 10, default: 140, labels: L("点亮半径", "点灯半径", "Radius") },
    {
      key: "falloff",
      type: "select",
      default: "smooth",
      options: [
        { value: "linear", labels: L("线性", "リニア", "Linear") },
        { value: "smooth", labels: L("平滑", "スムーズ", "Smooth") },
        { value: "sharp", labels: L("锐利", "シャープ", "Sharp") }
      ],
      labels: L("衰减曲线", "減衰カーブ", "Falloff")
    },
    { key: "holdTime", type: "range", min: 0, max: 2000, step: 50, default: 400, labels: L("停留时长（ms）", "保持時間（ms）", "Hold time (ms)") },
    {
      key: "fadeDuration",
      type: "range",
      min: 100,
      max: 3000,
      step: 50,
      default: 800,
      labels: L("淡出时长（ms）", "フェード時間（ms）", "Fade duration (ms)")
    },
    { key: "lineWidth", type: "range", min: 0.5, max: 4, step: 0.1, default: 1.2, labels: L("线宽", "線幅", "Line width") },
    { key: "maxOpacity", type: "range", min: 0.1, max: 1, step: 0.05, default: 1, labels: L("最大不透明度", "最大不透明度", "Max opacity") },
    { key: "fillOpacity", type: "range", min: 0, max: 1, step: 0.05, default: 0, labels: L("填充不透明度", "塗りの不透明度", "Fill opacity") },
    { key: "gridOpacity", type: "range", min: 0, max: 0.5, step: 0.01, default: 0.08, labels: L("底网格不透明度", "グリッドの不透明度", "Grid opacity") },
    { key: "cellRadius", type: "range", min: 0, max: 24, step: 1, default: 0, labels: L("格子圆角", "セルの角丸", "Cell radius") },
    { key: "clickPulse", type: "toggle", default: true, labels: L("点击脉冲", "クリックでパルス", "Click pulse") },
    {
      key: "pulseSpeed",
      type: "range",
      min: 100,
      max: 2000,
      step: 50,
      default: 600,
      labels: L("脉冲速度（px/s）", "パルス速度（px/s）", "Pulse speed (px/s)"),
      visibleWhen: { key: "clickPulse", equals: true }
    },
    { key: "fps", type: "range", min: 15, max: 60, step: 5, default: 30, labels: L("帧率上限", "フレームレート上限", "Frame-rate cap") }
  ]
};

const FALLOFF_CURVES = {
  linear: (t) => t,
  smooth: (t) => t * t * (3 - 2 * t),
  sharp: (t) => t * t * t
};

function defaults() {
  const o = {};
  for (const p of meta.params) o[p.key] = p.default;
  return o;
}

const fallbackColor = (name) => {
  if (typeof document === "undefined") return [128, 128, 128, 1];
  const probe = document.createElement("span");
  probe.style.cssText = `position:absolute;visibility:hidden;color:var(${name})`;
  document.documentElement.appendChild(probe);
  const m = /(\d+(?:\.\d+)?)\D+(\d+(?:\.\d+)?)\D+(\d+(?:\.\d+)?)/.exec(getComputedStyle(probe).color);
  probe.remove();
  return m ? [+m[1], +m[2], +m[3], 1] : [128, 128, 128, 1];
};

export function mount(container, params = {}, ctx = {}) {
  const p = { ...defaults(), ...params };
  const reduced = () => (ctx.reducedMotion ? ctx.reducedMotion() : matchMedia("(prefers-reduced-motion: reduce)").matches);
  const fine = ctx.finePointer ? ctx.finePointer() : matchMedia("(pointer: fine)").matches;
  const readColor = ctx.color ?? fallbackColor;

  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none;";
  container.appendChild(canvas);
  const g = canvas.getContext("2d");

  let rgb = [0, 0, 0];
  const refreshColor = () => {
    const c = readColor(p.color);
    rgb = [Math.round(c[0]), Math.round(c[1]), Math.round(c[2])];
  };
  refreshColor();

  // 每格一对「亮度 + 最近触碰时间」，行优先
  let cols = 0;
  let rows = 0;
  let offX = 0;
  let offY = 0;
  let alphas = new Float32Array(0);
  let touched = new Float64Array(0);
  let w = 0;
  let h = 0;
  const pulses = [];
  let raf = 0;
  let running = false;
  let lastFrame = 0;
  let lastDraw = 0;
  let destroyed = false;

  function rebuild() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = container.clientWidth;
    h = container.clientHeight;
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    cols = Math.ceil(w / p.cellSize) + 1;
    rows = Math.ceil(h / p.cellSize) + 1;
    // 网格居中，两侧边缘格裁得一样多
    offX = (w - cols * p.cellSize) / 2;
    offY = (h - rows * p.cellSize) / 2;
    alphas = new Float32Array(cols * rows);
    touched = new Float64Array(cols * rows);
  }

  const cellX = (i) => offX + (i % cols) * p.cellSize + p.cellSize / 2;
  const cellY = (i) => offY + Math.floor(i / cols) * p.cellSize + p.cellSize / 2;

  // 半径内的格子按衰减曲线点亮
  function energize(x, y) {
    const r = Math.max(p.radius, 1);
    const ease = FALLOFF_CURVES[p.falloff] ?? FALLOFF_CURVES.linear;
    const now = performance.now();
    const minCol = Math.max(0, Math.floor((x - r - offX) / p.cellSize));
    const maxCol = Math.min(cols - 1, Math.floor((x + r - offX) / p.cellSize));
    const minRow = Math.max(0, Math.floor((y - r - offY) / p.cellSize));
    const maxRow = Math.min(rows - 1, Math.floor((y + r - offY) / p.cellSize));
    for (let cRow = minRow; cRow <= maxRow; cRow++) {
      for (let cCol = minCol; cCol <= maxCol; cCol++) {
        const i = cRow * cols + cCol;
        const dist = Math.hypot(cellX(i) - x, cellY(i) - y);
        if (dist > r) continue;
        const level = ease(1 - dist / r) * p.maxOpacity;
        if (level > alphas[i]) {
          alphas[i] = level;
          touched[i] = now;
        } else if (level > 0) {
          touched[i] = now;
        }
      }
    }
  }

  function drawLattice() {
    const op = reduced() ? Math.max(p.gridOpacity, 0.06) : p.gridOpacity;
    if (op <= 0) return;
    g.strokeStyle = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${op})`;
    g.lineWidth = 1;
    g.beginPath();
    for (let c = 0; c <= cols; c++) {
      const x = Math.round(offX + c * p.cellSize) + 0.5;
      g.moveTo(x, 0);
      g.lineTo(x, h);
    }
    for (let r = 0; r <= rows; r++) {
      const y = Math.round(offY + r * p.cellSize) + 0.5;
      g.moveTo(0, y);
      g.lineTo(w, y);
    }
    g.stroke();
  }

  /** 画一帧；返回是否还有东西在动 */
  function paint(now, dt) {
    g.clearRect(0, 0, w, h);
    drawLattice();
    const [cr, cg, cb] = rgb;

    // 扩散脉冲：环经过的格子被点亮到最大
    for (let pi = pulses.length - 1; pi >= 0; pi--) {
      const pulse = pulses[pi];
      const ringR = ((now - pulse.t0) / 1000) * p.pulseSpeed;
      if (ringR > Math.hypot(w, h)) {
        pulses.splice(pi, 1);
        continue;
      }
      const band = p.cellSize;
      const minCol = Math.max(0, Math.floor((pulse.x - ringR - band - offX) / p.cellSize));
      const maxCol = Math.min(cols - 1, Math.floor((pulse.x + ringR + band - offX) / p.cellSize));
      const minRow = Math.max(0, Math.floor((pulse.y - ringR - band - offY) / p.cellSize));
      const maxRow = Math.min(rows - 1, Math.floor((pulse.y + ringR + band - offY) / p.cellSize));
      for (let cRow = minRow; cRow <= maxRow; cRow++) {
        for (let cCol = minCol; cCol <= maxCol; cCol++) {
          const i = cRow * cols + cCol;
          const dist = Math.hypot(cellX(i) - pulse.x, cellY(i) - pulse.y);
          if (Math.abs(dist - ringR) < band / 2 && p.maxOpacity > alphas[i]) {
            alphas[i] = p.maxOpacity;
            touched[i] = now;
          }
        }
      }
    }

    let anyVisible = pulses.length > 0;
    const fadeStep = dt / Math.max(p.fadeDuration, 16);
    const half = p.cellSize / 2;
    for (let i = 0; i < alphas.length; i++) {
      let a = alphas[i];
      if (a <= 0) continue;
      if (now - touched[i] > p.holdTime) {
        a = Math.max(0, a - fadeStep);
        alphas[i] = a;
        if (a <= 0) continue;
      }
      anyVisible = true;
      const cx = cellX(i);
      const cy = cellY(i);
      const grad = g.createRadialGradient(cx, cy, half * 0.1, cx, cy, p.cellSize);
      grad.addColorStop(0, `rgba(${cr}, ${cg}, ${cb}, ${a})`);
      grad.addColorStop(1, `rgba(${cr}, ${cg}, ${cb}, 0)`);
      const x = cx - half + 0.5;
      const y = cy - half + 0.5;
      const s = p.cellSize - 1;
      g.beginPath();
      if (p.cellRadius > 0 && g.roundRect) g.roundRect(x, y, s, s, p.cellRadius);
      else g.rect(x, y, s, s);
      if (p.fillOpacity > 0) {
        g.fillStyle = `rgba(${cr}, ${cg}, ${cb}, ${a * p.fillOpacity})`;
        g.fill();
      }
      g.strokeStyle = grad;
      g.lineWidth = p.lineWidth;
      g.stroke();
    }
    return anyVisible;
  }

  function frame(now) {
    raf = 0;
    if (destroyed || document.hidden) {
      running = false;
      return;
    }
    // fps 上限：没到间隔就等下一帧
    if (now - lastDraw < 1000 / p.fps - 1) {
      raf = requestAnimationFrame(frame);
      return;
    }
    const dt = Math.min(now - lastFrame, 100);
    lastFrame = now;
    lastDraw = now;
    if (paint(now, dt)) raf = requestAnimationFrame(frame);
    else running = false;
  }

  function wake() {
    if (running || destroyed || document.hidden) return;
    running = true;
    lastFrame = performance.now();
    lastDraw = 0;
    raf = requestAnimationFrame(frame);
  }

  /** 静止时重画一帧（换色 / 改参数 / 尺寸变化后） */
  function repaint() {
    if (running) return;
    const now = performance.now();
    paint(now, 0);
  }

  function onMove(e) {
    const rect = container.getBoundingClientRect();
    energize(e.clientX - rect.left, e.clientY - rect.top);
    wake();
  }
  function onDown(e) {
    if (!p.clickPulse) return;
    const rect = container.getBoundingClientRect();
    pulses.push({ x: e.clientX - rect.left, y: e.clientY - rect.top, t0: performance.now() });
    if (pulses.length > 8) pulses.shift();
    wake();
  }
  function onVisibility() {
    if (!document.hidden) {
      lastFrame = performance.now();
      // 隐藏期间的淡出按真实时间续上
      wake();
    }
  }

  const interactive = fine && !reduced();
  if (interactive) {
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
  }
  document.addEventListener("visibilitychange", onVisibility);
  const ro = new ResizeObserver(() => {
    rebuild();
    repaint();
  });
  ro.observe(container);
  const offColors = ctx.onColorsChange
    ? ctx.onColorsChange(() => {
        refreshColor();
        repaint();
      })
    : () => {};

  rebuild();
  repaint();

  return {
    update(next) {
      const prevCell = p.cellSize;
      Object.assign(p, next);
      refreshColor();
      if (p.cellSize !== prevCell) rebuild();
      repaint();
    },
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      offColors();
      document.removeEventListener("visibilitychange", onVisibility);
      if (interactive) {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerdown", onDown);
      }
      canvas.remove();
    }
  };
}
