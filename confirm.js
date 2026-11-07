/* ============================================================
   @szyyw/design · confirm.js（v0.29.0）
   破坏性操作的二次确认，两种形态（DESIGN.md §16.3）。框架无关；模块顶层不碰 DOM（SSR 可 import）。

   (a) 按钮版：第一次点 → 按钮进入 .armed（变红、文字换成「再点一次确认」），再点才执行；
       失焦 / 点别处 / Esc / 超时复原。
     import { armConfirm } from "@szyyw/design/confirm";
     const h = armConfirm(btn, { onConfirm: () => del(id), timeout: 3000 });
     h.disarm(); h.destroy();
     不给 onConfirm 时，第二次点击照常冒泡（交给应用自己的点击委托处理）；第一次点击被拦下（preventDefault + 停止传播）。
     .btn-icon（或没有文字的按钮）不换内容，只换 aria-label / title。

   (b) 对话框版：用 .overlay + .sheet.confirm（mountOverlay 处理 Esc / 点遮罩），焦点困在弹层里、
       初始焦点在「取消」（有输入框时在输入框），关闭后焦点还原。
     import { confirm } from "@szyyw/design/confirm";
     if (await confirm({ title: "删除项目？", message: "不可撤销", confirmLabel: "删除", danger: true })) …
     const name = await confirm({ title: "重命名", input: { value: old, placeholder: "新名字" } });  // string | null
     await confirm({ title: "重置节点？", danger: true, ack: "我明白这会断开所有连接" });       // v0.30.0：勾选后确认键才可用

   文案 zh / ja / en（locale，缺省 "zh"），labels 覆盖任意一条。
   ============================================================ */

import { mountOverlay } from "./overlay.js";

export const CONFIRM_TEXTS = {
  zh: { confirm: "确定", cancel: "取消", armed: "再点一次确认", dialog: "确认" },
  ja: { confirm: "OK", cancel: "キャンセル", armed: "もう一度押して確定", dialog: "確認" },
  en: { confirm: "Confirm", cancel: "Cancel", armed: "Click again to confirm", dialog: "Confirm" }
};

const textsFor = (locale, labels) => ({ ...(CONFIRM_TEXTS[locale] || CONFIRM_TEXTS.zh), ...(labels || {}) });

/* ---------- (a) 按钮版 ---------- */

const armedRegistry = new WeakMap();

/**
 * @param {HTMLElement} button
 * @param {{ onConfirm?: (e: MouseEvent) => void, timeout?: number, label?: string, locale?: string, labels?: object,
 *           onArm?: () => void, onDisarm?: (reason: string) => void }} [options]
 */
export function armConfirm(button, options = {}) {
  if (typeof document === "undefined" || !button) return { disarm() {}, destroy() {}, get armed() { return false; } };
  const prev = armedRegistry.get(button);
  if (prev) prev.destroy();

  const { onConfirm, timeout = 3000, onArm, onDisarm } = options;
  const t = textsFor(options.locale, options.labels);
  const label = options.label ?? t.armed;
  const iconOnly = button.classList.contains("btn-icon") || !button.textContent.trim();

  let armed = false;
  let timer = 0;
  let saved = null; // { nodes, ariaLabel, title, minWidth }
  let destroyed = false;

  function arm() {
    armed = true;
    saved = {
      nodes: [...button.childNodes],
      ariaLabel: button.getAttribute("aria-label"),
      title: button.getAttribute("title"),
      minWidth: button.style.minWidth
    };
    // 锁住当前宽度：换成更短的文字时按钮不缩，避免第二下点空
    button.style.minWidth = `${button.getBoundingClientRect().width}px`;
    if (iconOnly) {
      button.setAttribute("aria-label", label);
      button.setAttribute("title", label);
    } else {
      button.textContent = label;
    }
    button.classList.add("armed");
    button.dataset.armed = "";
    clearTimeout(timer);
    if (timeout > 0) timer = setTimeout(() => disarm("timeout"), timeout);
    document.addEventListener("pointerdown", onOutside, true);
    document.addEventListener("keydown", onKey, true);
    onArm?.();
  }

  function disarm(reason = "manual") {
    if (!armed) return;
    armed = false;
    clearTimeout(timer);
    document.removeEventListener("pointerdown", onOutside, true);
    document.removeEventListener("keydown", onKey, true);
    button.classList.remove("armed");
    delete button.dataset.armed;
    if (saved) {
      if (!iconOnly) button.replaceChildren(...saved.nodes);
      if (saved.ariaLabel === null) button.removeAttribute("aria-label");
      else button.setAttribute("aria-label", saved.ariaLabel);
      if (saved.title === null) button.removeAttribute("title");
      else button.setAttribute("title", saved.title);
      button.style.minWidth = saved.minWidth;
      saved = null;
    }
    onDisarm?.(reason);
  }

  function onClick(e) {
    if (button.disabled || button.getAttribute("aria-disabled") === "true") return;
    if (!armed) {
      e.preventDefault();
      e.stopImmediatePropagation();
      arm();
      return;
    }
    disarm("confirm");
    if (onConfirm) {
      e.preventDefault();
      onConfirm(e);
    }
  }
  function onOutside(e) {
    if (!button.contains(e.target)) disarm("outside");
  }
  function onKey(e) {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      disarm("escape");
    }
  }
  function onBlur() {
    // 点按钮本身时部分浏览器（Safari）不给按钮焦点，blur 只在真正移走焦点时才有
    disarm("blur");
  }

  button.addEventListener("click", onClick);
  button.addEventListener("blur", onBlur);

  const handle = {
    disarm: () => disarm("manual"),
    destroy() {
      if (destroyed) return;
      destroyed = true;
      disarm("destroy");
      button.removeEventListener("click", onClick);
      button.removeEventListener("blur", onBlur);
      armedRegistry.delete(button);
    },
    get armed() {
      return armed;
    }
  };
  armedRegistry.set(button, handle);
  return handle;
}

/* ---------- (b) 对话框版 ---------- */

let uid = 0;
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function setContent(el, content) {
  if (content == null) return;
  if (typeof content === "string") el.textContent = content;
  else el.append(content);
}

/**
 * @param {object} [options]
 * @returns {Promise<boolean | string | null>}
 */
export function confirm(options = {}) {
  if (typeof document === "undefined") return Promise.resolve(options.input ? null : false);
  const t = textsFor(options.locale, options.labels);
  const { title, message, danger = false, input } = options;
  const id = `szyyw-confirm-${++uid}`;

  return new Promise((resolve) => {
    const prevFocus = document.activeElement;

    const overlay = document.createElement("div");
    overlay.className = "overlay";
    const sheet = document.createElement("div");
    sheet.className = "sheet confirm" + (options.className ? ` ${options.className}` : "");
    sheet.setAttribute("role", danger ? "alertdialog" : "dialog");
    sheet.setAttribute("aria-modal", "true");

    if (title) {
      const head = document.createElement("div");
      head.className = "sheet-head";
      const h = document.createElement("h2");
      h.className = "sheet-title";
      h.id = `${id}-title`;
      setContent(h, title);
      head.append(h);
      sheet.append(head);
      sheet.setAttribute("aria-labelledby", h.id);
    } else {
      sheet.setAttribute("aria-label", t.dialog);
    }

    const body = document.createElement("div");
    body.className = "sheet-body";
    if (message != null) {
      const p = document.createElement("p");
      p.className = "confirm-message";
      p.id = `${id}-msg`;
      setContent(p, message);
      body.append(p);
      sheet.setAttribute("aria-describedby", p.id);
    }

    let field = null;
    let msg = null;
    if (input) {
      field = document.createElement("input");
      field.className = "field";
      field.type = input.type || "text";
      field.value = input.value ?? "";
      if (input.placeholder) field.placeholder = input.placeholder;
      if (input.maxLength) field.maxLength = input.maxLength;
      field.setAttribute("aria-label", input.label || title || t.dialog);
      field.autocomplete = "off";
      body.append(field);
      msg = document.createElement("p");
      msg.className = "field-msg err";
      msg.id = `${id}-err`;
      msg.hidden = true;
      body.append(msg);
      field.setAttribute("aria-describedby", msg.id);
    }
    // 勾选确认（v0.30.0）：勾上之前确认键禁用
    let ackBox = null;
    if (options.ack != null && options.ack !== false) {
      const label = document.createElement("label");
      label.className = "confirm-ack";
      ackBox = document.createElement("input");
      ackBox.type = "checkbox";
      const span = document.createElement("span");
      setContent(span, options.ack);
      label.append(ackBox, span);
      body.append(label);
    }
    if (body.childNodes.length) sheet.append(body);

    const foot = document.createElement("div");
    foot.className = "sheet-foot";
    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "btn-ghost";
    cancelBtn.textContent = options.cancelLabel ?? t.cancel;
    const okBtn = document.createElement("button");
    okBtn.type = "button";
    okBtn.className = "btn" + (danger ? " danger" : "");
    okBtn.textContent = options.confirmLabel ?? t.confirm;
    if (ackBox) okBtn.disabled = true;
    foot.append(cancelBtn, okBtn);
    sheet.append(foot);
    overlay.append(sheet);
    document.body.append(overlay);

    let done = false;
    const ov = mountOverlay(overlay, { onClose: () => finish(false) });

    function finish(ok) {
      if (done) return;
      if (ok && ackBox && !ackBox.checked) {
        ackBox.focus();
        return;
      }
      let result;
      if (field) {
        if (ok) {
          const v = field.value;
          let err = null;
          if (input.required && !v.trim()) err = input.requiredMessage ?? "";
          else if (input.validate) err = input.validate(v) || null;
          if (err !== null) {
            field.setAttribute("aria-invalid", "true");
            msg.textContent = err;
            msg.hidden = !err;
            field.focus();
            return;
          }
          result = v;
        } else result = null;
      } else result = !!ok;
      done = true;
      ov.destroy();
      sheet.removeEventListener("keydown", onKeydown);
      overlay.remove();
      if (prevFocus && prevFocus.isConnected && typeof prevFocus.focus === "function") prevFocus.focus({ preventScroll: true });
      resolve(result);
    }

    function onKeydown(e) {
      if (e.key === "Tab") {
        const list = [...sheet.querySelectorAll(FOCUSABLE)].filter((el) => !el.hidden && el.offsetParent !== null);
        if (!list.length) return;
        const first = list[0];
        const last = list[list.length - 1];
        if (e.shiftKey && (document.activeElement === first || !sheet.contains(document.activeElement))) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && (document.activeElement === last || !sheet.contains(document.activeElement))) {
          e.preventDefault();
          first.focus();
        }
      } else if (e.key === "Enter" && field && e.target === field && !e.isComposing) {
        e.preventDefault();
        finish(true);
      }
    }
    sheet.addEventListener("keydown", onKeydown);
    cancelBtn.addEventListener("click", () => finish(false));
    okBtn.addEventListener("click", () => finish(true));
    ackBox?.addEventListener("change", () => { okBtn.disabled = !ackBox.checked; });
    field?.addEventListener("input", () => {
      if (field.getAttribute("aria-invalid") === "true") {
        field.removeAttribute("aria-invalid");
        msg.hidden = true;
      }
    });

    if (options.signal) {
      if (options.signal.aborted) finish(false);
      else options.signal.addEventListener("abort", () => finish(false), { once: true });
    }

    if (field) {
      field.focus();
      field.select();
    } else cancelBtn.focus();
  });
}
