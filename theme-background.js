/* ============================================================
   @szyyw/design · theme-background.js
   可插拔背景主题的运行时（v0.19.0）：在 .bg-layer 上挂「当前主题」的背景，
   html[data-theme] 变化时销毁旧背景、挂新背景（不刷新页面），每个主题的参数分别持久化。

   - 主题模块接口见 themes/types.d.ts；注册表见 themes/index.js（只加载当前主题）。
   - nebula（缺省）静态引入：首帧同步挂上，旧代码拿 field（DotField 句柄）也不必等。
   - 参数存储：nebula 沿用旧键 szyyw:dotfield（与 restoreDotFieldSettings 同一份），
     其余主题 `${storagePrefix}<id>`（缺省 szyyw:theme-params:<id>）。
     只存「被动过的键」：没动过的继续跟缺省 / 主题走（与旧背景参数面板同一语义）。
   - 主题加载失败（文件缺失 / 网络 / 不合规）：不抛错，标记 failed，保留当前背景（首挂失败则回退 nebula）。
   模块顶层不碰 DOM：SSR 时被求值也不会炸。
   ============================================================ */

import { resolveTokenColor } from "./dotfield.js";
import * as nebula from "./themes/nebula.js";
import { THEME_REGISTRY, loadTheme, themeEntry } from "./themes/index.js";
import { normalizeAppearance } from "./appearance-data.js";

const DEFAULT_STORAGE_KEY = "szyyw:dotfield";
const DEFAULT_STORAGE_PREFIX = "szyyw:theme-params:";

/* ---------- 颜色 ---------- */

let probeCtx = null;

/** 浏览器算好的颜色字符串 → [r, g, b, a]（r/g/b 0–255，a 0–1）；解析不了返回 null */
export function parseCssColor(text) {
  const s = (text || "").trim();
  let m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)\s*(?:[,/]\s*([\d.]+%?)\s*)?\)$/i.exec(s);
  if (m) {
    const a = m[4] === undefined ? 1 : m[4].endsWith("%") ? parseFloat(m[4]) / 100 : +m[4];
    return [+m[1], +m[2], +m[3], a];
  }
  // color-mix() 的计算值是 color(srgb r g b / a)，分量 0–1
  m = /^color\(\s*srgb\s+([\d.e-]+)\s+([\d.e-]+)\s+([\d.e-]+)\s*(?:\/\s*([\d.]+%?)\s*)?\)$/i.exec(s);
  if (m) {
    const a = m[4] === undefined ? 1 : m[4].endsWith("%") ? parseFloat(m[4]) / 100 : +m[4];
    return [m[1] * 255, m[2] * 255, m[3] * 255, a].map((v, i) => (i < 3 ? Math.round(Math.min(255, Math.max(0, v))) : v));
  }
  m = /^#([0-9a-f]{6})$/i.exec(s);
  if (m) {
    const n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }
  // 其余写法（oklch() 等）交给 canvas 换算
  if (typeof document === "undefined" || !s) return null;
  try {
    probeCtx ??= document.createElement("canvas").getContext("2d", { willReadFrequently: true });
    probeCtx.clearRect(0, 0, 1, 1);
    probeCtx.fillStyle = "rgba(0,0,0,0)";
    probeCtx.fillStyle = s;
    probeCtx.fillRect(0, 0, 1, 1);
    const d = probeCtx.getImageData(0, 0, 1, 1).data;
    if (d[3] === 0) return null;
    return [d[0], d[1], d[2], d[3] / 255];
  } catch {
    return null;
  }
}

/** 读解析后的颜色 token → [r, g, b, a]；取不到返回 [0, 0, 0, 0] */
export function tokenColor(name) {
  return parseCssColor(resolveTokenColor(name)) ?? [0, 0, 0, 0];
}

/** 主题 / 配色 / 明暗 / 行内 token 变化 → cb（同一帧合并一次）。返回退订函数 */
function watchColors(cb) {
  let queued = 0;
  const fire = () => {
    if (queued) return;
    queued = requestAnimationFrame(() => {
      queued = 0;
      cb();
    });
  };
  const mo = new MutationObserver(fire);
  mo.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme", "data-palette", "data-scheme", "style"]
  });
  const mql = window.matchMedia("(prefers-color-scheme: dark)");
  mql.addEventListener("change", fire);
  return () => {
    cancelAnimationFrame(queued);
    mo.disconnect();
    mql.removeEventListener("change", fire);
  };
}

/** 给主题模块的 ctx（接口见 themes/types.d.ts 的 ThemeContext） */
export function createThemeContext(overrides = {}) {
  const rm = window.matchMedia("(prefers-reduced-motion: reduce)");
  const fine = window.matchMedia("(pointer: fine)");
  return {
    reducedMotion: () => rm.matches,
    finePointer: () => fine.matches,
    color: tokenColor,
    onColorsChange: watchColors,
    overrides: { ...overrides }
  };
}

/* ---------- 参数表 ---------- */

/** meta.params → 缺省参数对象 */
export function themeDefaults(meta) {
  const out = {};
  for (const p of meta?.params ?? []) out[p.key] = p.default ?? null;
  return out;
}

/** 任意对象 → 只留 meta 里登记过、取值合法的键（范围夹紧、选项校验） */
export function sanitizeThemeParams(meta, raw) {
  const out = {};
  if (!raw || typeof raw !== "object") return out;
  for (const p of meta?.params ?? []) {
    const v = raw[p.key];
    if (v === undefined || v === null) continue;
    if (p.type === "range") {
      const n = Number(v);
      if (Number.isFinite(n)) out[p.key] = Math.min(p.max, Math.max(p.min, n));
    } else if (p.type === "toggle") {
      out[p.key] = !!v;
    } else if (p.type === "select" || p.type === "token") {
      if (p.options.some((o) => o.value === v)) out[p.key] = v;
    } else if (p.type === "color") {
      if (typeof v === "string" && v.trim()) out[p.key] = v.trim();
    }
  }
  return out;
}

function applyColorParams(meta, values) {
  const root = document.documentElement;
  for (const p of meta?.params ?? []) {
    if (p.type !== "color") continue;
    if (values[p.key]) root.style.setProperty(p.token, values[p.key]);
    else root.style.removeProperty(p.token);
  }
}

function clearColorParams(meta) {
  for (const p of meta?.params ?? []) if (p.type === "color") document.documentElement.style.removeProperty(p.token);
}

/* ---------- 存储 ---------- */

function storage({ persist = "localStorage", storageKey = DEFAULT_STORAGE_KEY, storagePrefix = DEFAULT_STORAGE_PREFIX } = {}) {
  const keyOf = (id) => (id === "nebula" ? storageKey : `${storagePrefix}${id}`);
  const mem = new Map();
  return {
    keyOf,
    read(id) {
      if (mem.has(id)) return mem.get(id);
      let v = {};
      if (persist === "localStorage") {
        try {
          const raw = JSON.parse(localStorage.getItem(keyOf(id)) || "null");
          if (raw && typeof raw === "object") v = raw;
        } catch {
          // 坏 JSON / 隐私模式——当没存过
        }
      }
      mem.set(id, v);
      return v;
    },
    write(id, values) {
      mem.set(id, values);
      if (persist !== "localStorage") return;
      try {
        localStorage.setItem(keyOf(id), JSON.stringify(values));
      } catch {
        // 存不了——照常用，只是刷新后回到缺省
      }
    }
  };
}

/** 读某主题存过的参数（只含动过的键；未校验）。nebula 读 szyyw:dotfield */
export function readThemeParams(id, { storageKey = DEFAULT_STORAGE_KEY, storagePrefix = DEFAULT_STORAGE_PREFIX } = {}) {
  return { ...storage({ storageKey, storagePrefix }).read(id) };
}

/* ---------- 背景管理器 ---------- */

/**
 * 在容器（通常 .bg-layer）上挂当前主题的背景。
 *
 * @param container      背景容器
 * @param options.theme  初始主题；缺省读 html[data-theme]（未知回退 nebula）
 * @param options.follow 跟随 html[data-theme] 变化自动切换（缺省 true）
 * @param options.persist / storageKey / storagePrefix  参数持久化（见文件头）
 */
export function mountThemeBackground(container, options = {}) {
  if (!container) throw new Error("mountThemeBackground 需要背景容器（如 .bg-layer）");
  const { theme: initialTheme = null, follow = true } = options;
  const store = storage(options);
  const status = new Map([["nebula", "ready"]]);
  const loaded = new Map([["nebula", nebula]]);
  const listeners = new Set();

  let current = null; // { id, mod, meta, inst }
  let requested = null;
  let seq = 0;
  let destroyed = false;

  const emit = (ev) => {
    for (const fn of listeners) {
      try {
        fn(ev);
      } catch {
        // 订阅方出错不影响背景
      }
    }
  };
  const setStatus = (id, s) => {
    if (status.get(id) === s) return;
    status.set(id, s);
    emit({ type: "status", id, status: s });
  };

  const overridesOf = (id, meta) => sanitizeThemeParams(meta, store.read(id));
  const fullOf = (meta, ov) => ({ ...themeDefaults(meta), ...ov });

  function unmountCurrent() {
    if (!current) return;
    try {
      current.inst?.destroy();
    } catch {
      // 坏主题的 destroy 不拖垮切换
    }
    clearColorParams(current.meta);
    current = null;
  }

  function mountNow(id, mod) {
    unmountCurrent();
    const meta = mod.meta;
    const ov = overridesOf(id, meta);
    applyColorParams(meta, ov);
    let inst = null;
    try {
      inst = mod.mount(container, fullOf(meta, ov), createThemeContext(ov));
    } catch (err) {
      clearColorParams(meta);
      setStatus(id, "failed");
      if (id !== "nebula") return mountNow("nebula", nebula);
      throw err;
    }
    current = { id, mod, meta, inst };
    setStatus(id, "ready");
    emit({ type: "theme", id });
    return true;
  }

  /** 切到某主题；返回 Promise<是否成功挂上该主题> */
  function setTheme(next) {
    if (destroyed) return Promise.resolve(false);
    const id = themeEntry(next) ? next : normalizeAppearance({ theme: next }).theme;
    requested = id;
    if (current?.id === id) return Promise.resolve(true);
    const token = ++seq;
    const mod = loaded.get(id);
    if (mod) return Promise.resolve(mountNow(id, mod) && current?.id === id);
    setStatus(id, "loading");
    return loadTheme(id).then(
      (m) => {
        loaded.set(id, m);
        if (destroyed || token !== seq) return false;
        mountNow(id, m);
        return current?.id === id;
      },
      () => {
        setStatus(id, "failed");
        if (destroyed || token !== seq) return false;
        // 保留当前背景；一个都没有时回退 nebula
        if (!current) mountNow("nebula", nebula);
        return false;
      }
    );
  }

  const root = document.documentElement;
  let ready = setTheme(initialTheme ?? normalizeAppearance({ theme: root.dataset.theme }).theme);

  let mo = null;
  if (follow) {
    mo = new MutationObserver(() => {
      const id = normalizeAppearance({ theme: root.dataset.theme }).theme;
      if (id !== requested) ready = setTheme(id);
    });
    mo.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
  }

  const handle = {
    /** 当前挂着的主题 id（加载中 / 失败时是上一个） */
    get theme() {
      return current?.id ?? null;
    },
    /** 最近一次请求的主题 id */
    get requested() {
      return requested;
    },
    get meta() {
      return current?.meta ?? null;
    },
    /** 最近一次切换的 Promise（resolve 为是否挂上了所请求的主题） */
    get ready() {
      return ready;
    },
    /** nebula 时为底层 DotField 句柄，其余主题为 null */
    get field() {
      return current?.id === "nebula" ? current.inst?.field ?? null : null;
    },
    /** 可切换主题（旧 field 适配器为 false） */
    switchable: true,
    /** "ready" | "loading" | "failed" | "idle"（还没加载过） */
    status: (id) => status.get(id) ?? "idle",
    setTheme(id) {
      ready = setTheme(id);
      return ready;
    },
    /** 当前主题的完整参数（缺省值已合并） */
    params() {
      return current ? fullOf(current.meta, overridesOf(current.id, current.meta)) : {};
    },
    /** 某主题（缺省当前）被动过的参数 */
    overrides(id = current?.id) {
      if (!id) return {};
      const meta = loaded.get(id)?.meta;
      return meta ? overridesOf(id, meta) : { ...store.read(id) };
    },
    /** 所有存过参数的主题 → 动过的参数（给 onSave 一次存全） */
    allOverrides() {
      const out = {};
      for (const e of THEME_REGISTRY) {
        const ov = handle.overrides(e.id);
        if (Object.keys(ov).length) out[e.id] = ov;
      }
      return out;
    },
    /** 改当前主题的参数：持久化 + 热更新 */
    setParams(patch = {}) {
      if (!current) return {};
      const { id, meta, inst } = current;
      const clean = sanitizeThemeParams(meta, patch);
      // color 类传 null / "" = 撤销覆盖，交还 token
      for (const p of meta.params) if (p.type === "color" && p.key in patch && !patch[p.key]) clean[p.key] = null;
      const changed = Object.keys(clean);
      if (!changed.length) return handle.params();
      const ov = { ...overridesOf(id, meta), ...clean };
      for (const k of changed) if (ov[k] === null) delete ov[k];
      store.write(id, ov);
      if (meta.params.some((p) => p.type === "color" && changed.includes(p.key))) applyColorParams(meta, ov);
      const full = fullOf(meta, ov);
      try {
        inst.update(full, { changed, overrides: { ...ov } });
      } catch {
        // 热更新失败不打断面板
      }
      emit({ type: "params", id, changed });
      return full;
    },
    /** 当前主题恢复缺省：清掉存储与行内 token，控制权交还主题 */
    resetParams() {
      if (!current) return {};
      const { id, meta, inst } = current;
      store.write(id, {});
      clearColorParams(meta);
      const full = themeDefaults(meta);
      try {
        if (typeof inst.reset === "function") inst.reset(full);
        else inst.update(full, { changed: Object.keys(full), overrides: {} });
      } catch {
        // 同上
      }
      emit({ type: "params", id, changed: Object.keys(full), reset: true });
      return full;
    },
    /** 订阅 { type: "theme" | "status" | "params", id, ... }，返回退订函数 */
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    destroy() {
      destroyed = true;
      mo?.disconnect();
      unmountCurrent();
      listeners.clear();
    }
  };
  return handle;
}

/* ---------- 旧 field 适配（@internal）----------
   mountAppearancePanel({ field }) 的旧写法：应用自己 mountDotField 得到的句柄。
   包成与 mountThemeBackground 同形的对象（只有 nebula、不可切换），面板用同一套控件渲染，
   存储与「只存动过的键」语义和旧背景参数面板完全一致。 */

/** @internal */
export function createFieldThemeAdapter(field, options = {}) {
  const store = storage(options);
  const meta = nebula.meta;
  const listeners = new Set();
  const behavior = new Set(meta.params.filter((p) => p.type !== "color").map((p) => p.key));
  const ov = () => sanitizeThemeParams(meta, store.read("nebula"));
  const params = () => ({ ...themeDefaults(meta), ...field.getOptions(), ...ov() });
  const emit = (ev) => {
    for (const fn of listeners) fn(ev);
  };
  return {
    theme: "nebula",
    requested: "nebula",
    meta,
    ready: Promise.resolve(true),
    field,
    switchable: false,
    status: (id) => (id === "nebula" ? "ready" : "idle"),
    setTheme: () => Promise.resolve(false),
    params,
    overrides: (id = "nebula") => (id === "nebula" ? ov() : {}),
    allOverrides() {
      const o = ov();
      return Object.keys(o).length ? { nebula: o } : {};
    },
    setParams(patch = {}) {
      const clean = sanitizeThemeParams(meta, patch);
      for (const p of meta.params) if (p.type === "color" && p.key in patch && !patch[p.key]) clean[p.key] = null;
      const changed = Object.keys(clean);
      if (!changed.length) return params();
      const next = { ...ov(), ...clean };
      for (const k of changed) if (next[k] === null) delete next[k];
      store.write("nebula", next);
      applyColorParams(meta, next);
      const opts = {};
      for (const k of changed) if (behavior.has(k)) opts[k] = clean[k];
      field.setOptions(opts);
      emit({ type: "params", id: "nebula", changed });
      return params();
    },
    resetParams() {
      store.write("nebula", {});
      clearColorParams(meta);
      field.resetOptions();
      emit({ type: "params", id: "nebula", changed: [...behavior], reset: true });
      return params();
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    destroy() {
      listeners.clear();
    }
  };
}
