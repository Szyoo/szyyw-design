/* ============================================================
   @szyyw/design · disclosure.js（v0.29.0）
   非 <details> 写法的折叠区块：按钮的 aria-expanded / aria-controls 与内容区的 hidden 同步，展开收起带高度动画
   （--dur-base / --ease，reduced-motion 下无动画）。<details class="disclosure"> 不需要本模块。
   框架无关；模块顶层不碰 DOM（SSR 可 import）。

     <div class="disclosure">
       <button type="button" class="disclosure-summary" aria-expanded="false" aria-controls="p1">高级选项</button>
       <div class="disclosure-body" id="p1" hidden>…</div>
     </div>

     import { mountDisclosure, enhanceDisclosures } from "@szyyw/design/disclosure";
     const d = mountDisclosure(button, { onToggle: (open) => … });   // → { open(), close(), toggle(force?), expanded, destroy() }
     const undo = enhanceDisclosures();                                // 处理 root 里所有 .disclosure-summary[aria-controls]

   内容区缺省取 aria-controls 指向的元素（也可传 panel）；初始状态取按钮的 aria-expanded（也可传 open）。
   ============================================================ */

const registry = new WeakMap();

function cssTime(el, name, fallback) {
  const v = getComputedStyle(el).getPropertyValue(name).trim();
  if (!v) return fallback;
  const n = parseFloat(v);
  if (Number.isNaN(n)) return fallback;
  return v.endsWith("ms") ? n : n * 1000;
}

/**
 * @param {HTMLElement} trigger
 * @param {{ panel?: HTMLElement, open?: boolean, animate?: boolean, onToggle?: (open: boolean) => void }} [options]
 */
export function mountDisclosure(trigger, options = {}) {
  const noop = { open() {}, close() {}, toggle() {}, get expanded() { return false; }, destroy() {} };
  if (typeof document === "undefined" || !trigger) return noop;
  const existing = registry.get(trigger);
  if (existing) return existing;

  const id = trigger.getAttribute("aria-controls");
  const panel = options.panel || (id ? document.getElementById(id) : null);
  if (!panel) return noop;
  if (!panel.id) panel.id = `disclosure-${Math.random().toString(36).slice(2, 9)}`;
  trigger.setAttribute("aria-controls", panel.id);

  const { animate = true, onToggle } = options;
  let expanded = options.open ?? trigger.getAttribute("aria-expanded") === "true";
  let anim = null;
  let destroyed = false;

  const reduced = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

  function paint() {
    trigger.setAttribute("aria-expanded", String(expanded));
    panel.hidden = !expanded;
  }

  function set(next, emit = true) {
    next = !!next;
    if (next === expanded || destroyed) return;
    expanded = next;
    anim?.cancel();
    anim = null;
    trigger.setAttribute("aria-expanded", String(expanded));
    const canAnimate = animate && !reduced() && typeof panel.animate === "function";
    if (!canAnimate) {
      panel.hidden = !expanded;
    } else {
      const from = expanded ? 0 : panel.getBoundingClientRect().height;
      panel.hidden = false;
      const to = expanded ? panel.scrollHeight : 0;
      const duration = cssTime(panel, "--dur-base", 250);
      const easing = getComputedStyle(panel).getPropertyValue("--ease").trim() || "ease";
      panel.style.overflow = "clip";
      anim = panel.animate([{ height: `${from}px` }, { height: `${to}px` }], { duration, easing });
      const done = () => {
        panel.style.overflow = "";
        if (!expanded) panel.hidden = true;
        anim = null;
      };
      anim.onfinish = done;
      anim.oncancel = () => { panel.style.overflow = ""; };
    }
    if (emit) onToggle?.(expanded);
  }

  const onClick = (e) => {
    if (trigger.disabled || trigger.getAttribute("aria-disabled") === "true") return;
    e.preventDefault();
    set(!expanded);
  };
  trigger.addEventListener("click", onClick);
  paint();

  const handle = {
    open: () => set(true),
    close: () => set(false),
    toggle: (force) => set(force === undefined ? !expanded : force),
    get expanded() {
      return expanded;
    },
    destroy() {
      if (destroyed) return;
      anim?.cancel();
      destroyed = true;
      trigger.removeEventListener("click", onClick);
      registry.delete(trigger);
    }
  };
  registry.set(trigger, handle);
  return handle;
}

/**
 * 处理 root（缺省 document）里所有 .disclosure-summary[aria-controls]。已处理的跳过。
 * @returns {() => void} 撤销本次处理的全部
 */
export function enhanceDisclosures(root, options = {}) {
  if (typeof document === "undefined") return () => {};
  const scope = root || document;
  const sel = ".disclosure-summary[aria-controls]";
  const picks = [];
  if (scope.matches?.(sel)) picks.push(scope);
  picks.push(...scope.querySelectorAll(sel));
  const hs = [];
  for (const el of picks) {
    if (registry.has(el)) continue;
    hs.push(mountDisclosure(el, options));
  }
  return () => hs.forEach((h) => h.destroy());
}
