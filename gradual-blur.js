/* ============================================================
   @szyyw/design · gradual-blur.js（v0.19.0）
   Gradual Blur：在滚动容器 / 页面的上、下（也可左、右）边缘叠一条「渐进模糊」带——
   越靠外缘越糊，内容滑出 / 滑入时像被雾化。多层 backdrop-filter + 渐变遮罩叠出平滑过渡。
   可选组件：不会默认开到任何页面，需要的地方自己挂。

   出处与许可：React Bits「Gradual Blur」（https://reactbits.dev/animations/gradual-blur），
   Copyright (c) 2026 David Haz，MIT + Commons Clause License Condition v1.0。
   本移植由包作者知情决定随个人站点的设计包一起发布；使用者请自行留意上游许可
   （Commons Clause：不得出售 / 再许可组件本身）。上游原件存于 reference/reactbits/（不进 package files）。

     import { mountGradualBlur, enhanceGradualBlur } from "@szyyw/design/gradual-blur";

     // 滚动容器：上下各一条，贴着容器自己的可视边缘（不随内容滚走）
     const h = mountGradualBlur(document.querySelector(".scroller"), { position: "both", height: "4rem" });
     // 页面级：固定在视口上 / 下边缘
     mountGradualBlur(window, { position: "bottom", preset: "page-footer" });
     // 声明式：<div class="scroller" data-gradual-blur="both" data-gradual-blur-height="4rem">
     const group = enhanceGradualBlur();          // 批量挂载 root 内所有 [data-gradual-blur]
     h.update({ strength: 3 }); h.destroy(); group.destroy();

   对照上游（参数全部保留，名字不变）：
     position  上游 top|bottom|left|right；这里另加 "both"（= top + bottom）
     strength / height / width / divCount / exponential / zIndex / animated(false|true|"scroll") /
     duration / easing / opacity / curve / responsive + mobile|tablet|desktop Height|Width /
     preset / hoverIntensity / onAnimationComplete / className / style
     target    上游 "parent"|"page"；这里由 mountGradualBlur 的第一个参数决定（元素 = parent，window / document = page）；
               presets 里的 target 字段因此被忽略
   新增：
     edgeFade  px，缺省 64：滚动容器 / 页面「离开该边缘」多远时模糊带才完全显现——
               已经在顶端就不叠顶部那条，往下滚时渐渐浮现（底部同理）；0 = 常驻
     outside   v0.22.0，缺省 false：仅元素目标。模糊带改为元素自己的子节点、贴在该边**外侧**
               （bottom = 元素下沿往下一条），随元素移动（吸顶标题、固定栏）；越靠近元素越糊。
               元素须是定位元素（sticky / relative / absolute / fixed），且自身不要带 backdrop-filter
               （否则成为 backdrop root，带子糊不到外面的内容）。edgeFade 此时按页面滚动计
   与上游的差异：
   - 框架无关：React → 挂载函数；无 backdrop-filter 的浏览器退回半透明 --bg 色带（颜色取自 token）
   - 滚动容器的模糊带是容器的兄弟节点（定位到容器可视区的边缘，ResizeObserver 跟随尺寸），
     不往容器里塞子节点，容器内容与滚动完全不受影响
   - reduced-motion：不做过渡动画
   模块顶层不碰 DOM：SSR 时被求值也不会炸。
   ============================================================ */

export const DEFAULTS = {
  /** "top" | "bottom" | "both" | "left" | "right" */
  position: "bottom",
  /** 模糊强度系数 */
  strength: 2,
  /** 带高（竖向）/ 宽（横向，缺省取 height），CSS 长度 */
  height: "6rem",
  width: undefined,
  /** 叠多少层 */
  divCount: 5,
  /** 指数递增的模糊半径（更集中在外缘） */
  exponential: false,
  zIndex: 1000,
  /** false | true（强度 / 透明度变化走过渡）| "scroll"（进入视口时淡入） */
  animated: false,
  duration: "0.3s",
  easing: "ease-out",
  opacity: 1,
  /** "linear" | "bezier" | "ease-in" | "ease-out" | "ease-in-out" */
  curve: "linear",
  responsive: false,
  mobileHeight: undefined,
  tabletHeight: undefined,
  desktopHeight: undefined,
  mobileWidth: undefined,
  tabletWidth: undefined,
  desktopWidth: undefined,
  preset: undefined,
  /** 悬停时强度倍数（设了才响应指针，带会接管指针事件） */
  hoverIntensity: undefined,
  onAnimationComplete: undefined,
  className: "",
  style: {},
  /** 见文件头：离开边缘多远才完全显现；0 = 常驻 */
  edgeFade: 64,
  /** v0.22.0，见文件头：模糊带贴在元素该边外侧、作为子节点随元素移动（仅元素目标） */
  outside: false,
};

export const PRESETS = {
  top: { position: "top", height: "6rem" },
  bottom: { position: "bottom", height: "6rem" },
  left: { position: "left", height: "6rem" },
  right: { position: "right", height: "6rem" },
  subtle: { height: "4rem", strength: 1, opacity: 0.8, divCount: 3 },
  intense: { height: "10rem", strength: 4, divCount: 8, exponential: true },
  smooth: { height: "8rem", curve: "bezier", divCount: 10 },
  sharp: { height: "5rem", curve: "linear", divCount: 4 },
  header: { position: "top", height: "8rem", curve: "ease-out" },
  footer: { position: "bottom", height: "8rem", curve: "ease-out" },
  sidebar: { position: "left", height: "6rem", strength: 2.5 },
  "page-header": { position: "top", height: "10rem", strength: 3 },
  "page-footer": { position: "bottom", height: "10rem", strength: 3 },
};

export const CURVE_FUNCTIONS = {
  linear: (p) => p,
  bezier: (p) => p * p * (3 - 2 * p),
  "ease-in": (p) => p * p,
  "ease-out": (p) => 1 - Math.pow(1 - p, 2),
  "ease-in-out": (p) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2),
};

const DIRECTIONS = { top: "to top", bottom: "to bottom", left: "to left", right: "to right" };
const OPPOSITE = { top: "bottom", bottom: "top", left: "right", right: "left" };
const clamp01 = (n) => Math.max(0, Math.min(1, n));
const isPageTarget = (t) =>
  t === "page" ||
  (typeof Window !== "undefined" && t instanceof Window) ||
  (typeof Document !== "undefined" && t instanceof Document) ||
  (typeof document !== "undefined" && (t === document.body || t === document.documentElement));

function mergeConfig(opts) {
  const preset = opts?.preset && PRESETS[opts.preset] ? PRESETS[opts.preset] : {};
  const defined = Object.fromEntries(Object.entries(opts || {}).filter(([, v]) => v !== undefined));
  const { target: _t, ...presetRest } = preset;
  return { ...DEFAULTS, ...presetRest, ...defined };
}

function positionsOf(position) {
  if (position === "both") return ["top", "bottom"];
  return DIRECTIONS[position] ? [position] : ["bottom"];
}

const reducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

function responsiveValue(cfg, key) {
  if (!cfg.responsive) return cfg[key];
  const w = window.innerWidth;
  const k = key[0].toUpperCase() + key.slice(1);
  if (w <= 480 && cfg["mobile" + k]) return cfg["mobile" + k];
  if (w <= 768 && cfg["tablet" + k]) return cfg["tablet" + k];
  if (w <= 1024 && cfg["desktop" + k]) return cfg["desktop" + k];
  return cfg[key];
}

function layerValues(cfg, mult) {
  const strength = cfg.strength * mult;
  const curve = CURVE_FUNCTIONS[cfg.curve] || CURVE_FUNCTIONS.linear;
  const n = Math.max(1, Math.round(cfg.divCount));
  const blurs = [];
  for (let i = 1; i <= n; i++) {
    const progress = curve(i / n);
    blurs.push(
      cfg.exponential
        ? Math.pow(2, progress * 4) * 0.0625 * strength
        : 0.0625 * (progress * n + 1) * strength
    );
  }
  return blurs;
}

const SUPPORTS_BACKDROP =
  typeof CSS !== "undefined" && typeof CSS.supports === "function" &&
  (CSS.supports("backdrop-filter", "blur(1px)") || CSS.supports("-webkit-backdrop-filter", "blur(1px)"));

/**
 * 挂载渐进模糊。
 * @param {Element|Window|Document|string} target 滚动容器（元素或选择器）；window / document / body / "page" = 页面级
 * @param {object} [options]
 * @returns {{ update(options?: object): void, destroy(): void }}
 */
export function mountGradualBlur(target, options = {}) {
  if (typeof window === "undefined" || typeof document === "undefined") return { update() {}, destroy() {} };
  const page = isPageTarget(target);
  const el = page ? null : typeof target === "string" ? document.querySelector(target) : target;
  if (!page && !(el instanceof Element)) return { update() {}, destroy() {} };
  // outside 在挂载时定型（决定节点挂在哪、监听谁），update 里改它不生效
  const outside = !page && !!options.outside;

  let opts = { ...options };
  let cfg = mergeConfig(opts);
  let bars = []; // { pos, bar, layers }
  let hoverMult = 1;
  let visible = cfg.animated !== "scroll";
  let completeTimer = 0;
  let raf = 0;
  let destroyed = false;
  const cleanups = [];

  const scroller = () => (page || outside ? document.scrollingElement || document.documentElement : el);

  function barOpacity(pos) {
    if (!visible) return 0;
    const sc = scroller();
    const fade = cfg.edgeFade;
    if (!fade || fade <= 0 || !sc) return 1;
    const vertical = pos === "top" || pos === "bottom";
    const size = vertical ? sc.scrollHeight - sc.clientHeight : sc.scrollWidth - sc.clientWidth;
    if (size <= 1) return 0; // 内容没溢出：没东西可糊
    const at = vertical ? sc.scrollTop : sc.scrollLeft;
    const fromStart = Math.max(0, at);
    const fromEnd = Math.max(0, size - at);
    const dist = pos === "top" || pos === "left" ? fromStart : fromEnd;
    return clamp01(dist / fade);
  }

  function applyOpacity() {
    for (const b of bars) b.bar.style.opacity = String(barOpacity(b.pos));
  }

  function applyBlur() {
    const blurs = layerValues(cfg, hoverMult);
    for (const b of bars) {
      b.layers.forEach((layer, i) => {
        const v = `blur(${blurs[i].toFixed(3)}rem)`;
        layer.style.backdropFilter = v;
        layer.style.webkitBackdropFilter = v;
      });
    }
  }

  function geometry() {
    const height = responsiveValue(cfg, "height");
    const width = responsiveValue(cfg, "width");
    const transition = cfg.animated && !reducedMotion() ? `opacity ${cfg.duration} ${cfg.easing}` : "";
    for (const b of bars) {
      const s = b.bar.style;
      const vertical = b.pos === "top" || b.pos === "bottom";
      s.transition = transition;
      s.zIndex = String(page ? Number(cfg.zIndex) + 100 : cfg.zIndex);
      if (page) {
        s.position = "fixed";
        s.inset = "";
        if (vertical) {
          s.left = "0";
          s.right = "0";
          s.height = height;
          s.width = width || "";
          s[b.pos] = "0";
        } else {
          s.top = "0";
          s.bottom = "0";
          s.width = width || height;
          s.height = "";
          s[b.pos] = "0";
        }
        continue;
      }
      if (outside) {
        // 贴在元素该边外侧：纯 CSS 百分比定位，元素怎么动（sticky / 尺寸变化）都跟着，不用量
        s.position = "absolute";
        s.inset = "";
        s[b.pos] = "";
        s[OPPOSITE[b.pos]] = "100%";
        if (vertical) {
          s.left = "0";
          s.right = "0";
          s.width = "";
          s.height = height;
        } else {
          s.top = "0";
          s.bottom = "0";
          s.height = "";
          s.width = width || height;
        }
        continue;
      }
      // 滚动容器：定位到容器可视区边缘。先归零量出本节点的坐标原点，再按容器矩形摆放，
      // 与包含块 / 边距 / 偏移父节点无关
      s.position = "absolute";
      s.left = "0";
      s.top = "0";
      s.right = "";
      s.bottom = "";
      s.width = "0";
      s.height = "0";
      const origin = b.bar.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      const cw = el.clientWidth;
      const ch = el.clientHeight;
      const left = r.left - origin.left + el.clientLeft;
      const top = r.top - origin.top + el.clientTop;
      // 第一次用 CSS 长度算不出像素：让浏览器量一下
      b.bar.style[vertical ? "height" : "width"] = vertical ? height : width || height;
      const thick = vertical ? b.bar.offsetHeight : b.bar.offsetWidth;
      if (vertical) {
        s.left = `${left}px`;
        s.width = `${cw}px`;
        s.top = `${b.pos === "top" ? top : top + ch - thick}px`;
      } else {
        s.top = `${top}px`;
        s.height = `${ch}px`;
        s.left = `${b.pos === "left" ? left : left + cw - thick}px`;
      }
    }
  }

  function build() {
    for (const b of bars) b.bar.remove();
    bars = [];
    const n = Math.max(1, Math.round(cfg.divCount));
    const increment = 100 / n;
    const hostNode = page ? document.body : outside ? el : el.parentNode;
    for (const pos of positionsOf(cfg.position)) {
      // outside：越靠近元素越糊，渐变方向与「贴在容器内缘」相反
      const dir = DIRECTIONS[outside ? OPPOSITE[pos] : pos];
      const bar = document.createElement("div");
      bar.className = `gradual-blur ${page ? "gradual-blur-page" : "gradual-blur-parent"}${cfg.className ? " " + cfg.className : ""}`;
      bar.dataset.position = pos;
      bar.setAttribute("aria-hidden", "true");
      bar.style.pointerEvents = cfg.hoverIntensity ? "auto" : "none";
      bar.style.isolation = "isolate";
      Object.assign(bar.style, cfg.style || {});
      const inner = document.createElement("div");
      inner.style.cssText = "position:relative;width:100%;height:100%;pointer-events:none";
      const layers = [];
      for (let i = 1; i <= n; i++) {
        const p1 = Math.round((increment * i - increment) * 10) / 10;
        const p2 = Math.round(increment * i * 10) / 10;
        const p3 = Math.round((increment * i + increment) * 10) / 10;
        const p4 = Math.round((increment * i + increment * 2) * 10) / 10;
        let gradient = `transparent ${p1}%, black ${p2}%`;
        if (p3 <= 100) gradient += `, black ${p3}%`;
        if (p4 <= 100) gradient += `, transparent ${p4}%`;
        const mask = `linear-gradient(${dir}, ${gradient})`;
        const layer = document.createElement("div");
        layer.style.cssText = "position:absolute;inset:0";
        layer.style.maskImage = mask;
        layer.style.webkitMaskImage = mask;
        layer.style.opacity = String(cfg.opacity);
        if (cfg.animated && cfg.animated !== "scroll" && !reducedMotion()) {
          layer.style.transition = `backdrop-filter ${cfg.duration} ${cfg.easing}, -webkit-backdrop-filter ${cfg.duration} ${cfg.easing}`;
        }
        if (!SUPPORTS_BACKDROP) {
          layer.style.background = "color-mix(in srgb, var(--bg) 40%, transparent)";
          layer.style.opacity = String(cfg.opacity * 0.5);
        }
        inner.append(layer);
        layers.push(layer);
      }
      bar.append(inner);
      if (cfg.hoverIntensity) {
        bar.addEventListener("mouseenter", () => {
          hoverMult = cfg.hoverIntensity;
          applyBlur();
        });
        bar.addEventListener("mouseleave", () => {
          hoverMult = 1;
          applyBlur();
        });
      }
      // 页面级放 body 末尾；outside 放进元素末尾；滚动容器放在容器后面（兄弟节点）
      if (page || outside) hostNode.append(bar);
      else hostNode.insertBefore(bar, el.nextSibling);
      bars.push({ pos, bar, layers });
    }
    applyBlur();
    geometry();
    applyOpacity();
  }

  function schedule() {
    if (raf || destroyed) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      if (destroyed) return;
      applyOpacity();
    });
  }

  function relayout() {
    if (destroyed) return;
    geometry();
    applyOpacity();
  }

  // 监听：滚动（模糊带随离开边缘的距离浮现）、尺寸变化、窗口缩放
  const scrollTarget = page || outside ? window : el;
  scrollTarget.addEventListener("scroll", schedule, { passive: true });
  cleanups.push(() => scrollTarget.removeEventListener("scroll", schedule));
  let debounce = 0;
  const onResize = () => {
    clearTimeout(debounce);
    debounce = setTimeout(relayout, cfg.responsive ? 100 : 0);
  };
  window.addEventListener("resize", onResize);
  cleanups.push(() => {
    clearTimeout(debounce);
    window.removeEventListener("resize", onResize);
  });
  // outside 的几何全是 CSS 百分比，不需要跟尺寸
  if (typeof ResizeObserver === "function" && !outside) {
    const ro = new ResizeObserver(() => relayout());
    if (page) ro.observe(document.documentElement);
    else {
      ro.observe(el);
      if (el.parentElement) ro.observe(el.parentElement);
      for (const child of el.children) ro.observe(child);
    }
    cleanups.push(() => ro.disconnect());
  }

  // animated: "scroll" —— 目标进入视口时淡入
  let io = null;
  function setupObserver() {
    io?.disconnect();
    io = null;
    if (cfg.animated !== "scroll" || page || outside || typeof IntersectionObserver !== "function") {
      if (!visible) {
        visible = true;
        applyOpacity();
      }
      return;
    }
    io = new IntersectionObserver(
      ([entry]) => {
        const now = entry.isIntersecting;
        if (now === visible) return;
        visible = now;
        applyOpacity();
        clearTimeout(completeTimer);
        if (now && cfg.onAnimationComplete) {
          completeTimer = setTimeout(() => cfg.onAnimationComplete(), parseFloat(cfg.duration) * 1000 || 0);
        }
      },
      { threshold: 0.1 }
    );
    io.observe(el);
  }
  cleanups.push(() => {
    io?.disconnect();
    clearTimeout(completeTimer);
  });

  build();
  setupObserver();
  // 首帧后字体 / 布局可能再变：补量一次
  requestAnimationFrame(() => !destroyed && relayout());

  return {
    update(next = {}) {
      if (destroyed) return;
      opts = { ...opts, ...next };
      cfg = mergeConfig(opts);
      visible = cfg.animated !== "scroll";
      hoverMult = 1;
      build();
      setupObserver();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      cancelAnimationFrame(raf);
      for (const fn of cleanups) fn();
      for (const b of bars) b.bar.remove();
      bars = [];
    },
  };
}

const camel = (s) => s[0].toUpperCase() + s.slice(1);
function coerce(v) {
  if (v === "" || v === "true") return true;
  if (v === "false") return false;
  if (v !== "" && !Number.isNaN(Number(v)) && /^-?[\d.]+$/.test(v)) return Number(v);
  return v;
}

/**
 * 声明式：为 root 内所有 [data-gradual-blur] 元素挂渐进模糊。
 * data-gradual-blur="top|bottom|both|left|right"（空值 = bottom）；
 * 其余参数用 data-gradual-blur-<参数名，短横线写法>，如 data-gradual-blur-div-count="8"、data-gradual-blur-preset="smooth"。
 * 已挂载过的元素不会重复挂载。
 * @param {ParentNode} [root]
 * @returns {{ destroy(): void }}
 */
export function enhanceGradualBlur(root) {
  if (typeof document === "undefined") return { destroy() {} };
  const scope = root || document;
  const handles = [];
  for (const node of scope.querySelectorAll("[data-gradual-blur]")) {
    if (mounted.has(node)) continue;
    const options = { position: node.dataset.gradualBlur || "bottom" };
    for (const key of Object.keys(DEFAULTS)) {
      if (key === "position" || key === "style" || key === "onAnimationComplete") continue;
      const raw = node.dataset["gradualBlur" + camel(key)];
      if (raw !== undefined) options[key] = coerce(raw);
    }
    const h = mountGradualBlur(node, options);
    mounted.set(node, h);
    handles.push([node, h]);
  }
  return {
    destroy() {
      for (const [node, h] of handles) {
        h.destroy();
        mounted.delete(node);
      }
      handles.length = 0;
    },
  };
}

const mounted = new WeakMap();
