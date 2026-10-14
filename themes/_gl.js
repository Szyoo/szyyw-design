/* ============================================================
   @szyyw/design · themes/_gl.js
   WebGL 背景主题共用的极小工具（内部模块，零依赖）：
   - 画布：WebGL2 → WebGL1 降级、DPR 上限、ResizeObserver、上下文丢失恢复
   - 着色器：源码统一写 GLSL ES 1.00，WebGL2 下自动加 300 es 头（同 three.js 的宏做法）
   - 全屏三角形、uniform 位置缓存
   - 帧循环：fps 上限、标签页隐藏 / 视口外暂停、reduced-motion 只按需画一帧、空闲不空跑 rAF
   - 取色：ctx.color(token) → [r,g,b,a]（0–1）；没有 ctx 时自带一个读 CSS token 的实现
   ============================================================ */

import { resolveTokenColor } from "../dotfield.js";

/* ---------- 取色 ---------- */

function parseRgb(text) {
  const m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/i.exec((text || "").trim());
  if (!m) return null;
  let a = m[4] === undefined ? 1 : parseFloat(m[4]);
  if (m[4] && m[4].endsWith("%")) a /= 100;
  return [+m[1], +m[2], +m[3], a];
}

/**
 * 主题没拿到框架的 ctx 时用的缺省实现（单独挂载 / 手测页）。
 * 与外观框架约定一致：color() 返回 [r,g,b,a]，r/g/b 为 0–255、a 为 0–1。
 */
export function defaultThemeContext() {
  const mqlMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  return {
    reducedMotion: () => mqlMotion.matches,
    color: (name) => parseRgb(resolveTokenColor(name)) ?? [0, 0, 0, 0],
    onColorsChange(cb) {
      const mo = new MutationObserver(() => cb());
      mo.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-theme", "data-palette", "data-scheme", "style", "class"]
      });
      const mql = window.matchMedia("(prefers-color-scheme: dark)");
      mql.addEventListener("change", cb);
      return () => {
        mo.disconnect();
        mql.removeEventListener("change", cb);
      };
    }
  };
}

/** token → [r,g,b,a]，全部归一到 0–1（r/g/b 任一 > 1 视为 0–255 刻度） */
export function tokenColor(ctx, name) {
  const c = (ctx && ctx.color && ctx.color(name)) || null;
  if (!c || c.length < 3) return [0, 0, 0, 0];
  const big = c[0] > 1 || c[1] > 1 || c[2] > 1;
  const k = big ? 1 / 255 : 1;
  return [c[0] * k, c[1] * k, c[2] * k, c.length > 3 && Number.isFinite(c[3]) ? c[3] : 1];
}

/* ---------- 画布与上下文 ---------- */

/**
 * 在 container 里建一张铺满的 canvas 并取 WebGL 上下文（先 webgl2 后 webgl）。
 * 拿不到返回 null（调用方回退）。
 * 返回的 surface：{ canvas, gl, isGL2, width, height, dpr, resize(), setMaxDpr(), destroy() }
 * opts.onResize(surface) 尺寸变了时调；opts.onLost / opts.onRestored 上下文丢失 / 恢复时调。
 */
export function createSurface(container, opts = {}) {
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.cssText =
    "position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none;transform:translateZ(0);";
  const attrs = {
    alpha: true,
    premultipliedAlpha: true,
    antialias: !!opts.antialias,
    depth: false,
    stencil: false,
    preserveDrawingBuffer: false,
    powerPreference: opts.powerPreference || "default"
  };
  let gl = null;
  let isGL2 = false;
  try {
    gl = canvas.getContext("webgl2", attrs);
    isGL2 = !!gl;
    if (!gl) gl = canvas.getContext("webgl", attrs) || canvas.getContext("experimental-webgl", attrs);
  } catch {
    gl = null;
  }
  if (!gl) return null;

  container.appendChild(canvas);
  let maxDpr = opts.maxDpr ?? 1.5;
  const s = {
    canvas,
    gl,
    isGL2,
    width: 1,
    height: 1,
    cssWidth: 1,
    cssHeight: 1,
    dpr: 1,
    lost: false,
    resize,
    setMaxDpr(v) {
      if (v === maxDpr) return;
      maxDpr = v;
      resize();
    },
    destroy
  };

  function resize() {
    const rect = container.getBoundingClientRect();
    const cw = Math.max(1, Math.floor(rect.width));
    const ch = Math.max(1, Math.floor(rect.height));
    const dpr = Math.max(0.25, Math.min(window.devicePixelRatio || 1, maxDpr));
    const w = Math.max(1, Math.floor(cw * dpr));
    const h = Math.max(1, Math.floor(ch * dpr));
    s.cssWidth = cw;
    s.cssHeight = ch;
    if (w === canvas.width && h === canvas.height && dpr === s.dpr) return;
    canvas.width = w;
    canvas.height = h;
    s.width = w;
    s.height = h;
    s.dpr = dpr;
    opts.onResize?.(s);
  }

  const ro = new ResizeObserver(() => resize());
  ro.observe(container);
  // DPR 变化（拖到别的屏幕 / 浏览器缩放）ResizeObserver 不一定报
  window.addEventListener("resize", resize);

  function onLost(e) {
    e.preventDefault(); // 声明要恢复，浏览器才会发 webglcontextrestored
    s.lost = true;
    opts.onLost?.(s);
  }
  function onRestored() {
    s.lost = false;
    opts.onRestored?.(s);
  }
  canvas.addEventListener("webglcontextlost", onLost);
  canvas.addEventListener("webglcontextrestored", onRestored);

  function destroy() {
    ro.disconnect();
    window.removeEventListener("resize", resize);
    canvas.removeEventListener("webglcontextlost", onLost);
    canvas.removeEventListener("webglcontextrestored", onRestored);
    try {
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    } catch {
      /* 已丢失 */
    }
    canvas.remove();
  }

  resize();
  return s;
}

/* ---------- 着色器 ---------- */

const GL2_VERT = "#version 300 es\n#define attribute in\n#define varying out\n";
const GL2_FRAG =
  "#version 300 es\n#define varying in\nlayout(location = 0) out highp vec4 pc_fragColor;\n" +
  "#define gl_FragColor pc_fragColor\n#define texture2D texture\n";
const PRECISION =
  "#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\nprecision highp int;\n#else\n" +
  "precision mediump float;\nprecision mediump int;\n#endif\n";

/** 全屏三角形顶点着色器（输出 vUv，0–1） */
export const FULLSCREEN_VERT = `
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

function compileShader(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS) && !gl.isContextLost()) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error("[szyyw theme] shader compile failed: " + log);
  }
  return sh;
}

/**
 * 编译链接一个程序。vert / frag 用 GLSL ES 1.00 写（attribute / varying / gl_FragColor / texture2D），
 * WebGL2 下自动换成 300 es。opts.derivatives：片元着色器要用 fwidth / dFdx。
 * 返回 { program, use(), u(name) → location（缓存）, attrib(name) }
 */
export function createProgram(gl, isGL2, vert, frag, opts = {}) {
  let fragHead = isGL2 ? GL2_FRAG : "";
  if (!isGL2 && opts.derivatives) {
    gl.getExtension("OES_standard_derivatives");
    fragHead = "#extension GL_OES_standard_derivatives : enable\n";
  }
  const vs = compileShader(gl, gl.VERTEX_SHADER, (isGL2 ? GL2_VERT : "") + PRECISION + vert);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fragHead + PRECISION + frag);
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.bindAttribLocation(program, 0, "position");
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS) && !gl.isContextLost()) {
    throw new Error("[szyyw theme] program link failed: " + gl.getProgramInfoLog(program));
  }
  const locs = new Map();
  return {
    program,
    use() {
      gl.useProgram(program);
    },
    u(name) {
      let l = locs.get(name);
      if (l === undefined) {
        l = gl.getUniformLocation(program, name);
        locs.set(name, l);
      }
      return l;
    },
    dispose() {
      gl.deleteProgram(program);
    }
  };
}

/** 全屏三角形（一个 VBO，attribute 0 = position） */
export function createFullscreenTriangle(gl) {
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  return {
    draw() {
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    dispose() {
      gl.deleteBuffer(buf);
    }
  };
}

/** 渲染目标（RGBA8 纹理 + 帧缓冲，线性过滤、边缘夹紧——NPOT 在 WebGL1 也合法） */
export function createRenderTarget(gl) {
  const tex = gl.createTexture();
  const fbo = gl.createFramebuffer();
  let w = 0;
  let h = 0;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return {
    texture: tex,
    framebuffer: fbo,
    setSize(nw, nh) {
      if (nw === w && nh === h) return;
      w = nw;
      h = nh;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    },
    dispose() {
      gl.deleteFramebuffer(fbo);
      gl.deleteTexture(tex);
    }
  };
}

/* ---------- 帧循环 ---------- */

/**
 * 帧循环：opts.render(time 秒, dt 秒) 每帧调。
 * - fps 上限（缺省 30）；时间按真实间隔累加、单帧最多补 100ms，暂停恢复后不跳变
 * - 标签页隐藏时停；opts.pauseOffscreen() 为真且 container 不在视口时停
 * - static 模式（reduced-motion）：不进循环，只在 requestFrame() 时画一帧
 * - opts.idle() 返回 true 时也停（无动画的状态不空跑），有变化时 requestFrame() / wake()
 */
export function createLoop(container, opts) {
  let fps = opts.fps ?? 30;
  let isStatic = !!opts.static;
  let raf = 0;
  let last = 0;
  let time = opts.startTime ?? 0;
  let pageVisible = !document.hidden;
  let inView = true;
  let pending = false;
  let destroyed = false;

  const canRun = () =>
    !destroyed && pageVisible && (inView || !(opts.pauseOffscreen?.() ?? true)) && !isStatic && !opts.blocked?.();

  function frame(now) {
    raf = 0;
    if (destroyed || opts.blocked?.()) return;
    if (pending) {
      // 单次绘制（静态模式 / 参数变化 / 换色）
      pending = false;
      if (!last) last = now;
      opts.render(time, 0);
    }
    if (!canRun()) {
      last = 0;
      return;
    }
    if (!last) last = now;
    const interval = 1000 / Math.max(1, fps);
    const elapsed = now - last;
    if (elapsed >= interval - 1) {
      const dt = Math.min(elapsed, 100) / 1000;
      // 对齐到帧间隔，避免慢慢漂移成更低帧率
      last = now - (elapsed % interval);
      if (elapsed > 250) last = now;
      time += dt;
      opts.render(time, dt);
      if (opts.idle?.()) return;
    }
    raf = requestAnimationFrame(frame);
  }

  function kick() {
    if (!raf && !destroyed) raf = requestAnimationFrame(frame);
  }

  function onVisibility() {
    pageVisible = !document.hidden;
    if (pageVisible) kick();
  }
  document.addEventListener("visibilitychange", onVisibility);

  let io = null;
  if (typeof IntersectionObserver === "function") {
    io = new IntersectionObserver((entries) => {
      inView = entries[entries.length - 1].isIntersecting;
      if (inView) kick();
    });
    io.observe(container);
  }

  kick();

  return {
    get time() {
      return time;
    },
    /** 画一帧（静态模式 / 暂停中也会画） */
    requestFrame() {
      pending = true;
      kick();
    },
    /** 循环因 idle() 停下后重新开始 */
    wake() {
      kick();
    },
    setFps(v) {
      fps = v;
    },
    setStatic(v) {
      isStatic = !!v;
      pending = true;
      kick();
    },
    destroy() {
      destroyed = true;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      document.removeEventListener("visibilitychange", onVisibility);
      io?.disconnect();
    }
  };
}

/* ---------- 回退 ---------- */

/** WebGL 不可用：container 留纯色底，返回什么都不做的 handle（由框架决定是否换主题） */
export function fallbackHandle(container) {
  const prev = container.style.background;
  container.style.background = "var(--bg)";
  return {
    update() {},
    destroy() {
      container.style.background = prev;
    },
    webgl: false
  };
}

/** 指针交互是否可用：仅精确指针（鼠标 / 触控板） */
export function finePointer() {
  return window.matchMedia("(pointer: fine)").matches;
}

/** 合并缺省值：params 里缺的键从 meta.params 的 default 补 */
export function withDefaults(meta, params) {
  const out = {};
  for (const p of meta.params) out[p.key] = p.default;
  if (params) for (const k of Object.keys(params)) if (params[k] !== undefined) out[k] = params[k];
  return out;
}

/* ---------- 主题装配 ---------- */

/**
 * 三个 WebGL 主题共用的 mount 骨架：合并缺省参数、建画布、取色、帧循环、热更新、丢上下文恢复、回退。
 * factory(env) 返回主题实例：
 *   init()            建 GPU 资源（首次与上下文恢复后各调一次）
 *   render(t, dt)     画一帧（t 为累计秒数）
 *   update(changed)   参数热更新（changed：变化的键 Set）；env.p 已是新值
 *   resize()          画布像素尺寸变了
 *   dispose()         释放 GPU 资源
 *   destroy()         释放非 GPU 资源（指针监听等）
 *   idle()            可选：返回 true 时帧循环停下（无动画），有变化再 env.wake()
 *   pauseOffscreen()  可选：返回 false 时视口外也不停
 * env：{ gl, isGL2, surface, p, colors, ctx, reduced, interactive, requestFrame(), wake(), time }
 * opts.rebuildKeys：这些参数变了要重建上下文（如 antialias）。
 */
export function mountGLTheme(meta, container, params, ctx, factory, opts = {}) {
  ctx = ctx && typeof ctx.color === "function" ? ctx : defaultThemeContext();
  const p = withDefaults(meta, params);
  const tokenKeys = meta.params.filter((d) => d.type === "token").map((d) => d.key);
  const rebuildKeys = new Set(opts.rebuildKeys || []);
  const colors = {};
  let surface = null;
  let loop = null;
  let inst = null;
  let fallback = null;
  let gpuReady = false;
  let carriedTime = 0;
  let unsubColors = null;

  const readColors = () => {
    for (const k of tokenKeys) colors[k] = tokenColor(ctx, p[k]);
  };

  const env = {
    p,
    colors,
    ctx,
    reduced: !!ctx.reducedMotion?.(),
    interactive: false,
    get gl() {
      return surface && surface.gl;
    },
    get isGL2() {
      return !!(surface && surface.isGL2);
    },
    get surface() {
      return surface;
    },
    get time() {
      return loop ? loop.time : carriedTime;
    },
    requestFrame() {
      loop?.requestFrame();
    },
    wake() {
      loop?.wake();
    }
  };

  function build() {
    env.reduced = !!ctx.reducedMotion?.();
    env.interactive = finePointer() && !env.reduced;
    surface = createSurface(container, {
      antialias: !!p.antialias,
      maxDpr: p.maxDpr,
      powerPreference: opts.powerPreference,
      onResize() {
        if (!inst || !gpuReady) return;
        inst.resize?.();
        loop?.requestFrame();
      },
      onLost() {
        gpuReady = false;
      },
      onRestored() {
        try {
          inst.init();
          gpuReady = true;
          inst.resize?.();
          loop?.requestFrame();
          loop?.wake();
        } catch (e) {
          console.warn(e);
        }
      }
    });
    if (!surface) {
      fallback = fallbackHandle(container);
      return false;
    }
    inst = factory(env);
    try {
      inst.init();
      gpuReady = true;
      inst.resize?.();
    } catch (e) {
      // 编译失败等：按 WebGL 不可用处理
      console.warn(e);
      inst.destroy?.();
      surface.destroy();
      surface = null;
      inst = null;
      fallback = fallbackHandle(container);
      return false;
    }
    loop = createLoop(container, {
      fps: p.fps,
      static: env.reduced,
      startTime: carriedTime,
      render(t, dt) {
        if (gpuReady && surface && !surface.lost) inst.render(t, dt);
      },
      idle: inst.idle ? () => inst.idle() : undefined,
      pauseOffscreen: () => (inst.pauseOffscreen ? inst.pauseOffscreen() : true),
      blocked: () => !surface || surface.lost
    });
    loop.requestFrame();
    return true;
  }

  function teardown() {
    if (loop) carriedTime = loop.time;
    loop?.destroy();
    loop = null;
    if (inst) {
      if (gpuReady && surface && !surface.lost) inst.dispose?.();
      inst.destroy?.();
    }
    inst = null;
    gpuReady = false;
    surface?.destroy();
    surface = null;
    fallback?.destroy();
    fallback = null;
  }

  readColors();
  build();
  unsubColors =
    ctx.onColorsChange?.(() => {
      readColors();
      inst?.update?.(new Set(tokenKeys));
      loop?.requestFrame();
    }) || null;

  return {
    get webgl() {
      return !!surface;
    },
    update(next) {
      if (!next) return;
      const changed = new Set();
      for (const k of Object.keys(next)) {
        if (next[k] === undefined || next[k] === p[k]) continue;
        p[k] = next[k];
        changed.add(k);
      }
      const reduced = !!ctx.reducedMotion?.();
      if (!changed.size && reduced === env.reduced) return;
      if (reduced !== env.reduced || [...changed].some((k) => rebuildKeys.has(k))) {
        teardown();
        readColors();
        build();
        return;
      }
      if (!surface) return;
      if (changed.has("fps")) loop.setFps(p.fps);
      if (changed.has("maxDpr")) surface.setMaxDpr(p.maxDpr);
      if (tokenKeys.some((k) => changed.has(k))) readColors();
      if (gpuReady) inst.update?.(changed);
      loop.requestFrame();
      loop.wake();
    },
    destroy() {
      unsubColors?.();
      unsubColors = null;
      teardown();
    }
  };
}

/* ---------- 参数描述的公共片段 ---------- */

const COMMON_TOKENS = [
  ["--accent", "强调色", "アクセント", "Accent"],
  ["--accent2", "第二强调色", "アクセント 2", "Accent 2"],
  ["--df-from", "点阵起始色", "ドット 始点色", "Dot field from"],
  ["--df-to", "点阵终止色", "ドット 終点色", "Dot field to"],
  ["--text", "文字色", "文字色", "Text"],
  ["--text-dim", "次要文字色", "サブ文字色", "Dim text"]
];

/**
 * token 型参数的 options：主题自有 token 在前（[name, zh, ja, en]），后接通用 token。
 */
export function tokenOptions(own) {
  return [...own, ...COMMON_TOKENS].map(([value, zh, ja, en]) => ({ value, labels: { zh, ja, en } }));
}

/** 每个 WebGL 主题都带的性能参数：fps 上限、DPR 上限 */
export const PERF_PARAMS = [
  { key: "fps", type: "range", min: 10, max: 60, step: 5, default: 30,
    labels: { zh: "帧率上限", ja: "フレームレート上限", en: "FPS cap" } },
  { key: "maxDpr", type: "range", min: 0.5, max: 2, step: 0.25, default: 1.5,
    labels: { zh: "像素密度上限", ja: "解像度上限 (DPR)", en: "Max pixel ratio" } }
];
