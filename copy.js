/* ============================================================
   @szyyw/design · copy.js（v0.30.0）
   一键复制：写剪贴板（不可用时退回隐藏 textarea + execCommand），按钮短暂换成勾（data-copied），读屏播报「已复制」。
   框架无关；模块顶层不碰 DOM（SSR 可 import）。

     <dd class="copyable"><span>ABC-123</span><button type="button" class="btn-icon xs" data-copy aria-label="复制"></button></dd>

     import { copyText, mountCopy, enhanceCopyButtons } from "@szyyw/design/copy";
     await copyText("ABC-123");                          // → Promise<boolean>
     mountCopy(button, { text: () => row.id });          // → { copy(), destroy() }
     const undo = enhanceCopyButtons();                  // 处理 root 里所有 [data-copy] 按钮

   要复制的文字依次取：options.text → 按钮 data-copy 的值（非空时）→ data-copy-target 选择器指向的元素 →
   按钮前一个兄弟元素 → 父元素（去掉按钮本身）的 textContent，首尾空白去掉。
   空按钮的 copy / 勾图标由 components.css 画（.btn-icon[data-copy]:empty），也可以自己放 ./icons 图标。
   ============================================================ */

export const COPY_TEXTS = {
  zh: { copied: "已复制", failed: "复制失败" },
  ja: { copied: "コピーしました", failed: "コピーできませんでした" },
  en: { copied: "Copied", failed: "Copy failed" }
};

const registry = new WeakMap();
let live = null;

function announce(msg) {
  if (!live || !live.isConnected) {
    live = document.createElement("div");
    live.setAttribute("aria-live", "polite");
    live.setAttribute("role", "status");
    live.style.cssText = "position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0";
    document.body.append(live);
  }
  live.textContent = "";
  // 换一帧再写，同样的文字连续两次也会播报
  requestAnimationFrame(() => { if (live) live.textContent = msg; });
}

/**
 * 写剪贴板；成功 true。
 * @param {string} text
 * @returns {Promise<boolean>}
 */
export async function copyText(text) {
  if (typeof document === "undefined") return false;
  const value = String(text ?? "");
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    /* 被拒或不可用：走下面的兜底 */
  }
  const ta = document.createElement("textarea");
  ta.value = value;
  ta.setAttribute("readonly", "");
  ta.style.cssText = "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none";
  const active = document.activeElement;
  document.body.append(ta);
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  ta.remove();
  if (active && typeof active.focus === "function") active.focus({ preventScroll: true });
  return ok;
}

function resolveText(button, text) {
  if (typeof text === "function") return text();
  if (typeof text === "string") return text;
  const attr = button.getAttribute("data-copy");
  if (attr) return attr;
  const sel = button.getAttribute("data-copy-target");
  if (sel) {
    const el = document.querySelector(sel);
    if (el) return "value" in el && typeof el.value === "string" ? el.value : el.textContent || "";
  }
  const prev = button.previousElementSibling;
  if (prev) return prev.textContent || "";
  const parent = button.parentElement;
  if (!parent) return "";
  const clone = parent.cloneNode(true);
  for (const b of clone.querySelectorAll("[data-copy]")) b.remove();
  return clone.textContent || "";
}

/**
 * @param {HTMLElement} button
 * @param {{ text?: string | (() => string), timeout?: number, locale?: string, labels?: object,
 *           onCopy?: (ok: boolean, text: string) => void }} [options]
 */
export function mountCopy(button, options = {}) {
  const noop = { copy: async () => false, destroy() {} };
  if (typeof document === "undefined" || !button) return noop;
  const existing = registry.get(button);
  if (existing) return existing;

  const { timeout = 1500, onCopy } = options;
  const texts = { ...(COPY_TEXTS[options.locale] || COPY_TEXTS.zh), ...(options.labels || {}) };
  let timer = 0;

  async function copy() {
    const text = String(resolveText(button, options.text) ?? "").trim();
    const ok = await copyText(text);
    clearTimeout(timer);
    if (ok) {
      button.setAttribute("data-copied", "");
      timer = setTimeout(() => button.removeAttribute("data-copied"), timeout);
    }
    announce(ok ? texts.copied : texts.failed);
    onCopy?.(ok, text);
    return ok;
  }

  const onClick = (e) => {
    if (button.disabled || button.getAttribute("aria-disabled") === "true") return;
    e.preventDefault();
    void copy();
  };
  button.addEventListener("click", onClick);

  const handle = {
    copy,
    destroy() {
      clearTimeout(timer);
      button.removeEventListener("click", onClick);
      button.removeAttribute("data-copied");
      registry.delete(button);
    }
  };
  registry.set(button, handle);
  return handle;
}

/**
 * 处理 root（缺省 document）里所有 [data-copy] 按钮，返回撤销函数。
 * @param {ParentNode} [root]
 * @param {Omit<Parameters<typeof mountCopy>[1], "text">} [options]
 */
export function enhanceCopyButtons(root, options) {
  if (typeof document === "undefined") return () => {};
  const scope = root || document;
  const handles = [...scope.querySelectorAll("[data-copy]")].map((b) => mountCopy(b, options));
  return () => handles.forEach((h) => h.destroy());
}
