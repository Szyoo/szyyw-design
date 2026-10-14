/* ============================================================
   @szyyw/design · appearance.js
   外观（主题 → 配色 → 明暗，+ 鼠标效果）的客户端状态与统一「外观」弹层。

   状态唯一存放处是 <html data-theme / data-palette / data-scheme / data-cursor>（SSR 渲染的属性是真相）。
   - 明暗仍归 scheme.js 管：这里只转调 setScheme，持久化由 configureScheme 决定；
     🌗 按钮改明暗时也会转成一次 "szyyw:appearancechange"（changed = ["scheme"]），
     应用只在 onAppearanceChange / mountAppearancePanel({ onChange }) 一处收账。
   - 主题 / 配色 / 鼠标效果由 configureAppearance 决定写 cookie / localStorage / 不存。
   - 选项表与服务端读法在 appearance-data.js（零 DOM，服务端可 import）。
   - v0.19.0：主题可插拔。背景由 theme-background.js 的 mountThemeBackground 管（跟随 data-theme 切换，
     不刷新页面）；弹层的「主题参数」段按当前主题 meta.params 自动生成控件。
     鼠标效果 "target" 时按需 import("./target-cursor.js") 并 mountTargetCursor()，选回默认即销毁。
   - v0.21.0：主题缺省 "random"。存储里存 "random" 本身；按时间段（缺省 1 天，randomEvery）从真实主题里
     均匀抽一个，连同抽取时间存在 localStorage（`${主题键}_random`），同一时间段内所有页面 / 标签页一致，
     换段时重抽且避开上一次抽中的。
     <html> 上 data-theme = 实际抽到的主题、data-theme-mode="random"。抽到的主题加载失败就排除它再抽，全失败回退 nebula。
     一次性迁移：没有「显式选择」标记（`${主题键}_set`）时，存着的 nebula / 缺省 / 非法值视为 random
     （v0.19.0 之前 nebula 是唯一主题）；在面板里显式选任何主题（含 nebula、含随机）就写入标记。

   mountAppearancePanel 是 mountDotFieldSettings 的上位替代：同一枚调色板按钮（order 20）。两者二选一。
   模块顶层不碰 DOM：SSR 时被求值也不会炸。
   ============================================================ */

import {
  getScheme,
  setScheme,
  onSchemeChange,
  refreshThemeColor,
  configureScheme,
  mountSchemeToggle
} from "./scheme.js";
import { mountCornerTool, CORNER_ORDER } from "./corner.js";
import {
  renderUpdateSection,
  createPaletteToggle,
  createCornerPanel,
  bindCornerPanel,
  splitColor,
  joinColor,
  formatValue
} from "./settings.js";
import { attachSpot, resolveTokenColor } from "./dotfield.js";
import { mountThemeBackground, createFieldThemeAdapter } from "./theme-background.js";
import { THEME_REGISTRY, pickLabel } from "./themes/index.js";
import {
  THEMES,
  PALETTES,
  SCHEMES,
  CURSORS,
  APPEARANCE_COOKIES,
  RANDOM_THEME,
  FALLBACK_THEME,
  normalizeAppearance,
  appearanceCookieNames,
  resolveThemeChoice,
  isRealTheme,
  pickRandomTheme
} from "./appearance-data.js";
import { appearanceText } from "./appearance-text.js";

const EVENT = "szyyw:appearancechange";

const config = {
  /** "cookie" | "localStorage" | "none"。SSR 项目用 cookie，服务端要读它（与 configureScheme 同构） */
  persist: "cookie",
  storageKeys: {
    theme: APPEARANCE_COOKIES.theme,
    palette: APPEARANCE_COOKIES.palette,
    cursor: APPEARANCE_COOKIES.cursor
    // themeSet（v0.21.0）：显式选择标记；不给时按 `${theme}_set` 推出
  },
  cookieDays: 365,
  /** 随机主题的轮换周期（v0.21.0）："day"（缺省）/ "week" / 毫秒数 */
  randomEvery: "day"
};

/** 存储键名；themeSet 缺省 `${theme}_set`（与服务端 readAppearanceFromCookies 同一推法） */
function keyName(key) {
  if (key === "themeSet") return config.storageKeys.themeSet || `${config.storageKeys.theme}_set`;
  return config.storageKeys[key];
}

function readStored(key) {
  const name = keyName(key);
  if (!name) return null;
  try {
    if (config.persist === "cookie") {
      const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${esc}=([^;]*)`));
      return m ? decodeURIComponent(m[1]) : null;
    }
    if (config.persist === "localStorage") return localStorage.getItem(name);
  } catch {
    // 隐私模式 / 坏编码——当没存过
  }
  return null;
}

function writeStored(key, value) {
  const name = keyName(key);
  if (!name) return;
  try {
    if (config.persist === "cookie") {
      document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${
        60 * 60 * 24 * config.cookieDays
      }; samesite=lax`;
    } else if (config.persist === "localStorage") {
      localStorage.setItem(name, value);
    }
  } catch {
    // 存不了——功能照常，只是刷新后回到缺省
  }
}

/* ---------- 随机主题（v0.21.0）----------
   按时间段轮换：抽中的主题与抽取时间一起存在 localStorage（`${主题键}_random`，如 fl_theme_random，
   值为 JSON { id, at }）；localStorage 不可用时退回同名 cookie，都不可用则每次加载重抽。
   同一时间段内所有页面、所有标签页都用同一个；时间段到了再打开时重抽，且避开上一次抽中的主题。 */

/** 本页里加载失败过的主题：重抽时排除 */
const randomFailed = new Set();

/** 抽中主题的存储键（带应用前缀：fl_theme → fl_theme_random） */
const drawKey = () => `${config.storageKeys.theme}_random`;

function parseDraw(raw) {
  try {
    const v = JSON.parse(raw || "null");
    if (v && isRealTheme(v.id) && Number.isFinite(v.at)) return { id: v.id, at: v.at };
  } catch {
    // 坏 JSON：当没抽过
  }
  return null;
}

function readDraw() {
  const name = drawKey();
  try {
    const v = localStorage.getItem(name);
    if (v !== null) return parseDraw(v);
  } catch {
    // localStorage 不可用：看 cookie
  }
  try {
    const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${esc}=([^;]*)`));
    return m ? parseDraw(decodeURIComponent(m[1])) : null;
  } catch {
    return null;
  }
}

function writeDraw(draw) {
  const name = drawKey();
  const raw = JSON.stringify(draw);
  try {
    localStorage.setItem(name, raw);
    return;
  } catch {
    // 退回 cookie
  }
  try {
    document.cookie = `${name}=${encodeURIComponent(raw)}; path=/; max-age=${60 * 60 * 24 * config.cookieDays}; samesite=lax`;
  } catch {
    // 都存不了：每次加载重抽
  }
}

const DAY = 24 * 60 * 60 * 1000;

/** 本地日期的「第几天」（按本地 0 点换日） */
function localDay(t) {
  const d = new Date(t);
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY);
}

/**
 * 上次抽取（at）到现在（now）是否已进入新的时间段。
 * every："day"（缺省，本地 0 点换日）/ "week"（本地周一 0 点换周）/ 毫秒数（距上次抽取满这么久）。
 */
export function randomPeriodExpired(at, now = Date.now(), every = "day") {
  if (!Number.isFinite(at) || at > now) return true;
  if (typeof every === "number" && every > 0) return now - at >= every;
  const a = localDay(at);
  const b = localDay(now);
  // 1970-01-01 是周四：+3 让周一成为每周第 0 天
  if (every === "week") return Math.floor((a + 3) / 7) !== Math.floor((b + 3) / 7);
  return a !== b;
}

/**
 * 取当前时间段的主题。fresh = 立即开始新的时间段（面板里切到「随机」时）；
 * 新抽时避开上一次抽中的主题（及本页加载失败过的），主题只剩一个时不避。
 */
function drawTheme({ fresh = false } = {}) {
  const prev = readDraw();
  const now = Date.now();
  if (!fresh && prev && !randomFailed.has(prev.id) && !randomPeriodExpired(prev.at, now, config.randomEvery)) {
    return prev.id;
  }
  const exclude = [...randomFailed];
  let id = prev ? pickRandomTheme([...exclude, prev.id]) : pickRandomTheme(exclude);
  // 排除上一次后无主题可抽：放开再抽
  if (prev && (randomFailed.has(id) || id === prev.id)) id = pickRandomTheme(exclude);
  writeDraw({ id, at: now });
  return id;
}

/**
 * 随机模式下当前主题加载失败 → 排除它重抽（全失败回退 nebula）。返回新抽到的 id；不在随机模式返回 null。
 * 外观弹层挂着时自动调用；只用 mountThemeBackground、不挂弹层的应用可在 status 事件里自己调。
 */
export function rerollRandomTheme(failedId = null) {
  if (typeof document === "undefined") return null;
  const root = document.documentElement;
  if (root.dataset.themeMode !== RANDOM_THEME) return null;
  if (failedId) randomFailed.add(failedId);
  const id = drawTheme({ fresh: true });
  if (root.dataset.theme !== id) root.dataset.theme = id;
  return id;
}

function emit(appearance, changed) {
  document.dispatchEvent(new CustomEvent(EVENT, { detail: { appearance, changed } }));
}

/* 🌗 / 任何 setScheme 调用 → appearancechange(["scheme"])。
   懒绑一次（模块顶层不碰 document）；setAppearance 自己改明暗时先压住，
   最后合成一次事件，免得同一次改动广播两遍。 */
let bridged = false;
let muteScheme = false;

function ensureBridge() {
  if (bridged || typeof document === "undefined") return;
  bridged = true;
  onSchemeChange(() => {
    if (!muteScheme) emit(getAppearance(), ["scheme"]);
  });
}

function writeAttrs(theme, resolved, palette, cursor) {
  const root = document.documentElement;
  // data-theme 永远是实际挂的主题；随机模式另加 data-theme-mode="random"
  root.dataset.theme = resolved;
  if (theme === RANDOM_THEME) root.dataset.themeMode = RANDOM_THEME;
  else root.removeAttribute("data-theme-mode");
  // default 配色 = tokens.css 的 :root 基础块，不写属性（与 appearanceAttrs 一致）
  if (palette === "default") root.removeAttribute("data-palette");
  else root.dataset.palette = palette;
  if (cursor === "default") root.removeAttribute("data-cursor");
  else root.dataset.cursor = cursor;
}

/**
 * 读 <html> 当前外观（SSR 渲染的属性是真相；缺省项按 DEFAULT_APPEARANCE 兜底）。
 * v0.21.0：theme 是「选择」（随机模式为 "random"），resolvedTheme 是实际挂着的主题（data-theme；还没抽时为 null）。
 */
export function getAppearance() {
  const ds = document.documentElement.dataset;
  const theme = ds.themeMode === RANDOM_THEME ? RANDOM_THEME : ds.theme;
  const a = normalizeAppearance({ theme, palette: ds.palette, scheme: getScheme(), cursor: ds.cursor });
  a.resolvedTheme = isRealTheme(ds.theme) ? ds.theme : null;
  return a;
}

/**
 * 改外观。主题 / 配色 / 鼠标效果写 <html> 并按 configureAppearance 持久化；明暗转交 setScheme。
 * 随后重算 theme-color，有变化才广播一次 "szyyw:appearancechange"。
 * v0.21.0：patch 里带 theme 且 persist 时同时写「显式选择」标记；theme = "random" 时按本标签页的抽取挂主题
 * （从显式主题切到随机时立即重抽一个、尽量不同于当前）。
 */
export function setAppearance(patch = {}, { persist = true } = {}) {
  return applyAppearance(patch, { persist });
}

function applyAppearance(patch, { persist = true, resolved = null } = {}) {
  ensureBridge();
  patch = patch || {};
  const cur = getAppearance();
  const next = normalizeAppearance({ ...cur, ...patch });
  const changed = [];
  if (next.theme !== cur.theme) changed.push("theme");
  if (next.palette !== cur.palette) changed.push("palette");
  if (next.cursor !== cur.cursor) changed.push("cursor");

  let actual = next.theme;
  if (next.theme === RANDOM_THEME) {
    if (isRealTheme(resolved)) actual = resolved;
    else if (cur.theme === RANDOM_THEME && cur.resolvedTheme) actual = cur.resolvedTheme;
    else if (persist && "theme" in patch) actual = drawTheme({ fresh: true });
    else actual = drawTheme();
  }

  writeAttrs(next.theme, actual, next.palette, next.cursor);
  if (persist) {
    writeStored("theme", next.theme);
    if ("theme" in patch) writeStored("themeSet", "1");
    writeStored("palette", next.palette);
    // 鼠标效果只在动过时落盘：旧应用没配 cursor 键名时不多写一个 cookie
    if (changed.includes("cursor") || "cursor" in (patch || {})) writeStored("cursor", next.cursor);
  }

  if (next.scheme !== cur.scheme) {
    changed.push("scheme");
    muteScheme = true;
    try {
      setScheme(next.scheme, { persist });
    } finally {
      muteScheme = false;
    }
  }

  // 配色变了底色就变；setScheme 只在明暗变化时会算
  refreshThemeColor();
  const result = getAppearance();
  if (changed.length) emit(result, changed);
  return result;
}

/** 订阅外观变化（含 🌗 改明暗），返回解绑函数 */
export function onAppearanceChange(handler) {
  ensureBridge();
  const listener = (e) => handler(e.detail.appearance, e.detail.changed);
  document.addEventListener(EVENT, listener);
  return () => document.removeEventListener(EVENT, listener);
}

/**
 * 配置主题 / 配色 / 鼠标效果的持久化并对齐初始状态（与 configureScheme 同构；明暗的键走 configureScheme）。
 * <html> 上已有合法属性（SSR 渲染 / <head> 内联脚本写好）的项不覆盖；
 * 没有的项从存储恢复（静态页）。
 */
export function configureAppearance(options = {}) {
  const { storageKeys, ...rest } = options || {};
  Object.assign(config, rest);
  if (storageKeys) config.storageKeys = { ...config.storageKeys, ...storageKeys };
  ensureBridge();

  const ds = document.documentElement.dataset;
  const patch = {};
  // 主题（v0.21.0）：存储（含显式标记）优先；没存过就看 <html>——data-theme-mode="random" 即随机，
  // 写死 / 旧片段写进来的 data-theme 按同一条迁移规则（nebula / 缺省 → random）。随后总是走一遍，
  // 让随机模式抽定主题写进 data-theme（背景再按它挂）
  const storedTheme = readStored("theme");
  const marker = readStored("themeSet");
  if (storedTheme != null || marker != null) patch.theme = resolveThemeChoice(storedTheme, marker);
  else if (ds.themeMode === RANDOM_THEME) patch.theme = RANDOM_THEME;
  else patch.theme = resolveThemeChoice(ds.theme, false);
  if (ds.palette !== undefined && !PALETTES.some((p) => p.id === ds.palette)) {
    // 已移除的配色（如 aurora）：回到存储值或缺省
    patch.palette = readStored("palette") ?? "default";
  } else if (ds.palette === undefined) {
    const stored = readStored("palette");
    if (stored) patch.palette = stored;
  }
  if (!CURSORS.includes(ds.cursor)) {
    const stored = readStored("cursor");
    if (stored) patch.cursor = stored;
  }
  applyAppearance(patch, { persist: false });
  return getAppearance();
}

/* ---------- 鼠标效果（v0.19.0）----------
   "target" → 按需 import target-cursor.js 并 mountTargetCursor()；选回 "default" → destroy()。
   只在 pointer: fine 下生效。引用计数：弹层（或 mountCursorEffect）挂着时才工作，
   setLocale 重挂弹层的「先拆后装」在同一轮里完成，不会让指针闪一下。 */

const cursorFx = {
  load: () => import("./target-cursor.js"),
  options: {},
  refs: 0,
  off: null,
  handle: null,
  pending: null,
  failed: false,
  listeners: new Set()
};

const finePointer = () => typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches;

function cursorNotify() {
  for (const fn of cursorFx.listeners) fn();
}

function cursorWanted() {
  return cursorFx.refs > 0 && finePointer() && getAppearance().cursor === "target";
}

function cursorApply() {
  if (cursorWanted()) {
    if (cursorFx.handle || cursorFx.pending || cursorFx.failed) return;
    cursorFx.pending = Promise.resolve()
      .then(() => cursorFx.load())
      .then((mod) => {
        cursorFx.pending = null;
        if (typeof mod?.mountTargetCursor !== "function") throw new Error("target-cursor: missing mountTargetCursor");
        if (cursorWanted()) cursorFx.handle = mod.mountTargetCursor({ ...cursorFx.options });
        cursorNotify();
      })
      .catch(() => {
        cursorFx.pending = null;
        cursorFx.failed = true;
        cursorNotify();
      });
    cursorNotify();
  } else if (cursorFx.handle) {
    try {
      cursorFx.handle.destroy();
    } catch {
      // 坏实现的 destroy 不拖垮外观
    }
    cursorFx.handle = null;
    cursorNotify();
  }
}

/**
 * 鼠标效果的加载器与选项（v0.19.0）。缺省 load = () => import("./target-cursor.js")，
 * options 原样传给 mountTargetCursor(options)。改完立即按当前 data-cursor 重新生效。
 */
export function configureCursorEffect({ load, options } = {}) {
  const reload = typeof load === "function" || options !== undefined;
  if (typeof load === "function") {
    cursorFx.load = load;
    cursorFx.failed = false;
  }
  if (options !== undefined) cursorFx.options = options || {};
  if (reload && cursorFx.handle) {
    cursorFx.handle.destroy();
    cursorFx.handle = null;
  }
  if (typeof document !== "undefined") cursorApply();
  cursorNotify();
}

/** 鼠标效果状态："off"（不适用 / 默认）| "loading" | "active" | "failed" */
export function getCursorEffectStatus() {
  if (cursorFx.failed) return "failed";
  if (cursorFx.pending) return "loading";
  if (cursorFx.handle) return "active";
  return "off";
}

/**
 * 让 data-cursor 生效（弹层挂载时会自动调；不挂弹层、只靠 SSR 属性时手动调一次）。返回释放函数。
 */
export function mountCursorEffect() {
  ensureBridge();
  cursorFx.refs++;
  if (cursorFx.refs === 1) cursorFx.off = onAppearanceChange((_a, changed) => changed.includes("cursor") && cursorApply());
  cursorApply();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    cursorFx.refs--;
    // 同一轮里又被重新 retain（setLocale 重挂弹层）就什么都不做
    queueMicrotask(() => {
      if (cursorFx.refs > 0) return;
      cursorFx.off?.();
      cursorFx.off = null;
      cursorApply();
    });
  };
}

/* ---------- 外观弹层 ---------- */

/** 最近一次 mountAppearancePanel 的句柄，给 openAppearancePanel 用 */
let current = null;

/**
 * 打开最近一次 mountAppearancePanel 挂出的面板（如设置页里的「打开外观」按钮）。
 * 没挂过返回 false（no-op）。
 */
export function openAppearancePanel() {
  if (!current) return false;
  current.open();
  return true;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

let rowSeq = 0;

/** 一行 chip：.ctl.appearance-row > .ctl-label + .chip-row > button.chip (+ .ctl-hint 状态行) */
function chipRow(key, label, options, onPick) {
  const row = el("div", "ctl appearance-row");
  row.dataset.key = key;
  const id = `szyyw-appearance-${key}-${++rowSeq}`;
  const title = el("span", "ctl-label", label);
  title.id = id;
  const chips = el("div", "chip-row");
  chips.setAttribute("role", "group");
  chips.setAttribute("aria-labelledby", id);
  const buttons = options.map(({ value, text }) => {
    const b = el("button", "chip", text);
    b.type = "button";
    b.dataset.value = value;
    b.addEventListener("click", () => onPick(value));
    chips.append(b);
    return b;
  });
  const hint = el("span", "ctl-hint appearance-status");
  hint.hidden = true;
  row.append(title, chips, hint);
  return {
    row,
    buttons,
    render(active) {
      for (const b of buttons) {
        const on = b.dataset.value === active;
        b.classList.toggle("active", on);
        b.setAttribute("aria-pressed", String(on));
      }
    },
    /** 某个选项不可用：禁用 + title 提示 */
    disable(value, why) {
      const b = buttons.find((x) => x.dataset.value === value);
      if (!b) return;
      b.disabled = true;
      b.title = why;
      b.dataset.unavailable = "";
    },
    status(textOrEmpty) {
      hint.textContent = textOrEmpty || "";
      hint.hidden = !textOrEmpty;
    }
  };
}

const isVisible = (param, values) => {
  const w = param.visibleWhen;
  if (!w) return true;
  if ("equals" in w) return values[w.key] === w.equals;
  if ("notEquals" in w) return values[w.key] !== w.notEquals;
  return true;
};

/**
 * 按当前主题 meta.params 生成参数控件（range / toggle / select / token / color）到 body。
 * 控件改动 → bg.setParams；返回 { sync }（外部改了参数 / 换了配色后让控件跟上）。
 */
function renderThemeParamControls({ bg, body, text, locale, custom }) {
  body.textContent = "";
  const meta = bg.meta;
  if (!meta) return { sync() {} };
  const name = (p) => custom?.[p.key] ?? pickLabel(p.labels, locale, p.key);
  const hintOf = (p) => custom?.[`${p.key}Hint`] ?? (p.hints ? pickLabel(p.hints, locale, "") : "");
  const valuesNow = () => {
    const v = bg.params();
    for (const p of meta.params) {
      if (p.type === "color" && !v[p.key]) v[p.key] = resolveTokenColor(p.token) ?? "#000000";
    }
    return v;
  };
  if (!meta.params.length) {
    body.append(el("span", "ctl-hint", text.noParams));
    return { sync() {} };
  }

  const renders = [];
  const set = (key, value) => bg.setParams({ [key]: value });

  for (const p of meta.params) {
    let row;
    let render;
    if (p.type === "toggle") {
      row = el("label", "ctl ctl-toggle");
      const col = el("div");
      col.append(el("span", "ctl-label", name(p)));
      const h = hintOf(p);
      if (h) col.append(el("span", "ctl-hint", h));
      const input = el("input", "switch");
      input.type = "checkbox";
      input.addEventListener("change", () => set(p.key, input.checked));
      row.append(col, input);
      render = (v) => {
        input.checked = !!v[p.key];
      };
    } else if (p.type === "range") {
      row = el("label", "ctl");
      const line = el("div", "ctl-row");
      const value = el("span", "ctl-value num");
      line.append(el("span", "ctl-label", name(p)), value);
      const input = el("input");
      input.type = "range";
      input.min = p.min;
      input.max = p.max;
      input.step = p.step;
      input.addEventListener("input", () => set(p.key, Number(input.value)));
      row.append(line, input);
      const h = hintOf(p);
      if (h) row.append(el("span", "ctl-hint", h));
      render = (v) => {
        input.value = v[p.key];
        value.textContent = formatValue(v[p.key], p.step);
      };
    } else if (p.type === "select" || p.type === "token") {
      const r = chipRow(
        `param-${p.key}`,
        name(p),
        p.options.map((o) => ({ value: o.value, text: pickLabel(o.labels, locale, o.value) })),
        (val) => set(p.key, val)
      );
      row = r.row;
      row.classList.remove("appearance-row");
      row.classList.add("theme-param-choice");
      const h = hintOf(p);
      if (h) r.status(h);
      render = (v) => r.render(v[p.key]);
    } else if (p.type === "color") {
      row = el("label", "ctl");
      const line = el("div", "ctl-row");
      const swatch = el("input");
      swatch.type = "color";
      line.append(el("span", "ctl-label", name(p)), swatch);
      row.append(line);
      let alpha = null;
      let cur = "#000000";
      if (p.alpha) {
        alpha = el("input");
        alpha.type = "range";
        alpha.min = 0.05;
        alpha.max = 1;
        alpha.step = 0.05;
        alpha.addEventListener("input", () => set(p.key, joinColor(splitColor(cur).hex, Number(alpha.value), true)));
        row.append(alpha);
      }
      swatch.addEventListener("input", () => set(p.key, joinColor(swatch.value, splitColor(cur).alpha, !!p.alpha)));
      render = (v) => {
        cur = v[p.key];
        const parsed = splitColor(cur);
        swatch.value = parsed.hex;
        if (alpha) alpha.value = parsed.alpha;
      };
    } else {
      continue;
    }
    row.dataset.param = p.key;
    body.append(row);
    renders.push((v) => {
      const show = isVisible(p, v);
      row.hidden = !show;
      if (show) render(v);
    });
  }

  const sync = () => {
    const v = valuesNow();
    for (const fn of renders) fn(v);
  };
  sync();
  return { sync };
}

/**
 * 统一「外观」弹层，挂进右上角工具位（缺省 order 20，调色板图标，.settings-toggle）。
 * 面板：（给了 background）主题行 → 配色行 → 明暗行 →（pointer: fine）鼠标效果行 →
 * （给了 background / field）折叠「主题参数」→（dotField.update !== false）版本行。
 * 与 mountDotFieldSettings 二选一。
 */
export function mountAppearancePanel({
  background = null,
  field = null,
  title = null,
  order = CORNER_ORDER.settings,
  onChange = null,
  dotField = {},
  labels = {},
  locale = "zh",
  cursor = true
} = {}) {
  if (field && !field.setOptions) throw new Error("mountAppearancePanel 的 field 需要 mountDotField() 返回的实例");
  ensureBridge();

  const {
    persist = "localStorage",
    storageKey = "szyyw:dotfield",
    storagePrefix = undefined,
    onSave = null,
    note = "",
    update = {}
  } = dotField || {};

  // 背景来源：新写法 background = mountThemeBackground() 的句柄；旧写法 field = DotField 句柄（只有 nebula）
  const bg = background ?? (field ? createFieldThemeAdapter(field, { persist, storageKey, storagePrefix }) : null);
  const ownsAdapter = !background && !!bg;

  // 内置文案（locale）打底，labels 逐键覆盖；open 跟着标题走，除非单独给了
  const text = appearanceText(locale, labels);
  title = title ?? labels.title ?? text.title;
  if (!labels.open) text.open = title;

  const btn = createPaletteToggle(text.open);
  const { panel, closeBtn, body } = createCornerPanel({
    className: "settings-panel appearance-panel",
    title,
    closeLabel: text.close,
    withFoot: false
  });

  /* ---------- 主题 / 配色 / 明暗 / 鼠标效果 ---------- */

  const rows = [];
  const themeName = (id) => labels.themes?.[id] ?? pickLabel(THEME_REGISTRY.find((e) => e.id === id)?.labels, locale, text.themes[id] ?? id);

  let themeRow = null;
  let pendingTheme = null;
  let prevChoice = null;
  let failedNote = false;
  if (bg?.switchable) {
    // 「随机」排第一，其余按注册表
    const options = [{ value: RANDOM_THEME, text: themeName(RANDOM_THEME) }].concat(
      THEME_REGISTRY.filter((e) => THEMES.some((t) => t.id === e.id)).map((e) => ({ value: e.id, text: themeName(e.id) }))
    );
    themeRow = chipRow("theme", text.theme, options, (v) => {
      prevChoice = getAppearance().theme;
      pendingTheme = v;
      failedNote = false;
      setAppearance({ theme: v });
    });
    rows.push(["theme", themeRow]);
    body.append(themeRow.row);
  }

  // 只有一种配色时不出这一栏（v0.21.0）；以后加回配色自动出现
  if (PALETTES.length > 1) {
    const paletteRow = chipRow(
      "palette",
      text.palette,
      PALETTES.map((p) => ({ value: p.id, text: text.palettes[p.id] ?? p.id })),
      (v) => setAppearance({ palette: v })
    );
    rows.push(["palette", paletteRow]);
    body.append(paletteRow.row);
  }

  const schemeRow = chipRow(
    "scheme",
    text.scheme,
    SCHEMES.map((s) => ({ value: s, text: text.schemes[s] ?? s })),
    (v) => setAppearance({ scheme: v })
  );
  rows.push(["scheme", schemeRow]);
  body.append(schemeRow.row);

  // 鼠标效果只对精确指针有意义：触屏设备上整行不出现
  let cursorRow = null;
  let releaseCursor = null;
  if (cursor !== false && finePointer()) {
    cursorRow = chipRow(
      "cursor",
      text.cursor,
      CURSORS.map((c) => ({ value: c, text: text.cursors[c] ?? c })),
      (v) => setAppearance({ cursor: v })
    );
    rows.push(["cursor", cursorRow]);
    body.append(cursorRow.row);
    releaseCursor = mountCursorEffect();
  }

  const renderStatus = () => {
    if (themeRow) {
      for (const b of themeRow.buttons) {
        if (bg.status(b.dataset.value) === "failed" && !b.disabled) themeRow.disable(b.dataset.value, text.unavailable);
      }
      const req = bg.requested;
      const st = req ? bg.status(req) : "ready";
      const a = getAppearance();
      // 随机模式：提示本次抽到的主题
      const now = a.theme === RANDOM_THEME && bg.theme ? `${text.randomNow}${themeName(bg.theme)}` : "";
      themeRow.status(st === "loading" ? text.loading : st === "failed" || failedNote ? text.themeFailed : now);
    }
    if (cursorRow) {
      const st = getCursorEffectStatus();
      if (st === "failed") cursorRow.disable("target", text.unavailable);
      cursorRow.status(st === "failed" ? text.cursorFailed : st === "loading" ? text.loading : "");
    }
  };

  const renderRows = () => {
    const a = getAppearance();
    for (const [key, r] of rows) r.render(a[key]);
    renderStatus();
  };

  /* ---------- 主题参数（折叠） ---------- */

  let params = null;
  let advBody = null;
  let details = null;
  const custom = labels.controls || null;
  const renderParams = () => {
    if (!advBody) return;
    params = renderThemeParamControls({ bg, body: advBody, text, locale, custom });
    details.dataset.theme = bg.theme ?? "";
  };
  if (bg) {
    details = el("details", "appearance-advanced");
    details.append(el("summary", "ctl-label", labels.themeParams ?? labels.background ?? text.themeParams));
    advBody = el("div", "appearance-advanced-body");
    const advFoot = el("div", "appearance-advanced-foot");
    details.append(advBody, advFoot);
    body.append(details);
    renderParams();

    const resetBtn = el("button", "btn btn-ghost", text.reset);
    resetBtn.type = "button";
    resetBtn.addEventListener("click", () => bg.resetParams());
    advFoot.append(resetBtn);

    if (onSave) {
      const saveBtn = el("button", "btn", text.save);
      saveBtn.type = "button";
      saveBtn.addEventListener("click", async () => {
        saveBtn.disabled = true;
        saveBtn.textContent = text.saving;
        let ok = true;
        try {
          // 第一个参数与旧版相同：当前主题动过的键（nebula 时即旧 szyyw:dotfield 的那份）；
          // 第二个参数（v0.19.0）带主题 id 与全部主题的参数，服务端想按主题存就用它
          const values = bg.overrides();
          await onSave(values, { theme: bg.theme, params: values, all: bg.allOverrides() });
        } catch {
          ok = false;
        }
        saveBtn.textContent = ok ? text.saved : text.error;
        setTimeout(() => {
          saveBtn.disabled = false;
          saveBtn.textContent = text.save;
        }, 1600);
      });
      advFoot.append(saveBtn);
    } else if (note) {
      const noteText = note === true ? text.localOnly ?? appearanceText("zh").localOnly : note;
      advFoot.append(el("span", "guest-note", noteText));
    }
  }

  /* ---------- 版本行 ---------- */

  const runCheck = update !== false ? renderUpdateSection({ body, btn, text, update }) : null;

  /* ---------- 同步与开合 ---------- */

  const refresh = () => {
    renderRows();
    params?.sync();
  };

  /** 给 onChange 的外观对象：四项外观 + 当前主题动过的参数（v0.19.0，有背景时） */
  const withParams = (a) => (bg ? { ...a, themeParams: bg.overrides() } : a);
  const callOnChange = (a, changed) => {
    if (!onChange) return;
    try {
      const r = onChange(withParams(a), changed);
      if (r && typeof r.catch === "function") r.catch(() => {});
    } catch {
      // 应用侧存储失败不打断界面
    }
  };

  // 外观任何来源的变化（面板 / 🌗 / setAppearance）都让面板跟上，并转给应用存账号级偏好
  const off = onAppearanceChange((a, changed) => {
    refresh();
    callOnChange(a, changed);
  });

  // 背景事件：换了主题 → 重建参数段；加载状态 → 主题行提示；参数变化 → 控件跟上 + 去抖通知应用
  let paramTimer = 0;
  const offBg = bg
    ? bg.subscribe((ev) => {
        if (ev.type === "theme") {
          renderParams();
          renderRows();
        } else if (ev.type === "status") {
          const a = getAppearance();
          if (ev.status === "failed" && pendingTheme === ev.id && a.theme === ev.id) {
            // 用户刚点的主题加载失败：选择退回之前的选择（之前是随机就回到随机、保留当前背景），chip 置灰
            pendingTheme = null;
            failedNote = true;
            const back = prevChoice === RANDOM_THEME ? RANDOM_THEME : bg.theme ?? FALLBACK_THEME;
            applyAppearance({ theme: back }, { resolved: bg.theme });
          } else if (ev.status === "failed" && a.theme === RANDOM_THEME && a.resolvedTheme === ev.id) {
            // 随机抽到的主题加载失败：排除它再抽
            rerollRandomTheme(ev.id);
          }
          renderRows();
        } else if (ev.type === "params") {
          params?.sync();
          clearTimeout(paramTimer);
          paramTimer = setTimeout(() => callOnChange(getAppearance(), ["themeParams"]), 600);
        }
      })
    : null;

  // 鼠标效果加载状态（加载中 / 失败）→ 鼠标效果行提示
  const offCursor = (() => {
    const fn = () => renderStatus();
    cursorFx.listeners.add(fn);
    return () => cursorFx.listeners.delete(fn);
  })();

  const ctl = bindCornerPanel({ btn, panel, closeBtn, onOpen: refresh });

  renderRows();
  document.body.append(panel);
  const unmount = mountCornerTool(btn, { order });

  const handle = {
    open: () => ctl.setOpen(true),
    close: () => ctl.setOpen(false),
    /** 外部改了外观 / 主题参数后让面板跟上 */
    sync: refresh,
    /** 手动触发一次强制检查（绕过缓存）；update: false 时 no-op */
    checkUpdate: () => runCheck?.(true),
    destroy() {
      clearTimeout(paramTimer);
      ctl.unbind();
      off();
      offBg?.();
      offCursor();
      releaseCursor?.();
      if (ownsAdapter) bg.destroy();
      unmount();
      panel.remove();
      if (current === handle) current = null;
    }
  };
  current = handle;
  return handle;
}

/* ---------- 一次挂齐 ---------- */

/**
 * 应用接外观的一站式入口（v0.12.0）：明暗持久化 + 🌗 按钮 + 主题 / 配色 / 鼠标效果持久化 +
 * （给了 background）主题背景与光斑 + 外观弹层，全部按同一个 locale、同一组存储键。
 * 等价于依次调 configureScheme / configureAppearance / mountThemeBackground / attachSpot /
 * mountSchemeToggle / mountAppearancePanel；需要细调时仍可分开调。
 *
 * 切语言用 handle.setLocale——只重挂按钮与弹层，背景画布不重建。
 */
export function mountAppearance({
  background = null,
  spot = true,
  persist = "cookie",
  cookiePrefix = "",
  locale = "zh",
  labels = {},
  onChange = null,
  dotField = {},
  cursorEffect = null,
  randomEvery = "day"
} = {}) {
  const keys = appearanceCookieNames(cookiePrefix);
  configureScheme({ persist, storageKey: keys.scheme });
  configureAppearance({
    persist,
    randomEvery,
    storageKeys: { theme: keys.theme, palette: keys.palette, cursor: keys.cursor, themeSet: keys.themeSet }
  });
  if (cursorEffect) configureCursorEffect(cursorEffect);

  // 当前主题的背景（nebula 同步挂上；其余主题按需加载），参数从各自的存储恢复
  const bg = background
    ? mountThemeBackground(background, {
        persist: dotField?.persist ?? "localStorage",
        storageKey: dotField?.storageKey,
        storagePrefix: dotField?.storagePrefix
      })
    : null;
  const detachSpot = background && spot ? attachSpot() : null;

  let toggle = null;
  let panel = null;
  const mountUi = (loc) => {
    toggle?.destroy();
    panel?.destroy();
    toggle = mountSchemeToggle({ locale: loc, labels: labels.schemes });
    panel = mountAppearancePanel({ background: bg, locale: loc, labels, onChange, dotField });
  };
  mountUi(locale);

  return {
    /** 主题背景句柄（mountThemeBackground），没给 background 时为 null */
    background: bg,
    /** 兼容旧代码：当前是 nebula 时为底层 DotField 句柄，其余主题 / 没背景时为 null */
    get field() {
      return bg?.field ?? null;
    },
    setLocale: mountUi,
    open: () => panel.open(),
    close: () => panel.close(),
    sync: () => panel.sync(),
    destroy() {
      toggle.destroy();
      panel.destroy();
      detachSpot?.();
      bg?.destroy();
    }
  };
}
