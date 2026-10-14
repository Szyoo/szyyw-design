/* ============================================================
   @szyyw/design · pager.js（v0.20.0）
   分页器：总数与当前范围、每页条数、首页 / 上一页 / 页码（带省略）/ 下一页 / 末页、跳页（左：总数；右：页码、每页条数、跳页），
   方向键翻页；窄屏收成「‹ 3 / 25 ›」。只管界面，取数由调用方在 onChange 里做。

     import { mountPager } from "@szyyw/design/pager";
     const p = mountPager(el, { total: 1234, page: 1, pageSize: 50, onChange: ({ page, pageSize }) => load(page, pageSize) });
     p.update({ total: 1300 });   // 数据变了：重绘（不触发 onChange）
     p.setBusy(true);             // 取数期间禁用全部控件
     p.destroy();

   选项：
     total（必填，≥0）/ page 1 / pageSize 50 / pageSizes [20, 50, 100, 200]（[] = 不显示每页条数）
     siblings 1（当前页两侧各显示几个页码）/ boundaries 1（首尾各固定显示几个页码）
     jump true（跳页输入框）/ summary true（「共 N 条 · 第 a–b 条」）/ keyboard true（焦点在分页器内时 ← → 翻页）
     locale "zh" | "ja" | "en"（缺省 "zh"）/ labels：覆盖任意文案
     onChange({ page, pageSize, reason })：reason = "page" | "size" | "jump" | "key"
   页码越界时自动夹到 [1, 末页]；改每页条数时保持当前第一条仍在页内。
   类：.pager（容器）、.pager-info、.pager-nav、.pager-tools（每页条数 + 跳页）、.pager-size、.pager-btn（.active 当前页）、.pager-gap、.pager-jump。
   模块顶层不碰 DOM。
   ============================================================ */

const TEXTS = {
  zh: {
    total: (n) => `共 ${n} 条`, range: (a, b) => `第 ${a}–${b} 条`, size: (n) => `${n} 条/页`, sizeLabel: "每页条数",
    first: "首页", prev: "上一页", next: "下一页", last: "末页", page: (n) => `第 ${n} 页`,
    jump: "跳至", jumpUnit: "页", jumpLabel: "跳到第几页", nav: "分页", empty: "没有数据"
  },
  ja: {
    total: (n) => `全 ${n} 件`, range: (a, b) => `${a}–${b} 件目`, size: (n) => `${n} 件/ページ`, sizeLabel: "表示件数",
    first: "最初", prev: "前へ", next: "次へ", last: "最後", page: (n) => `${n} ページ`,
    jump: "移動", jumpUnit: "ページ", jumpLabel: "ページ番号", nav: "ページ送り", empty: "データなし"
  },
  en: {
    total: (n) => `${n} total`, range: (a, b) => `${a}–${b}`, size: (n) => `${n} / page`, sizeLabel: "Rows per page",
    first: "First", prev: "Previous", next: "Next", last: "Last", page: (n) => `Page ${n}`,
    jump: "Go to", jumpUnit: "", jumpLabel: "Page number", nav: "Pagination", empty: "No data"
  }
};

const DEFAULTS = {
  total: 0, page: 1, pageSize: 50, pageSizes: [20, 50, 100, 200],
  siblings: 1, boundaries: 1, jump: true, summary: true, keyboard: true,
  locale: "zh", labels: undefined, onChange: undefined
};

const fmtNum = (n, locale) => Number(n).toLocaleString(locale === "en" ? "en-US" : locale === "ja" ? "ja-JP" : "zh-CN");

/** 页码序列：数字与 "gap"（省略号）。纯函数，可单测。 */
export function pageItems(page, last, siblings = 1, boundaries = 1) {
  if (last <= 0) return [];
  const set = new Set();
  for (let i = 1; i <= Math.min(boundaries, last); i++) set.add(i);
  for (let i = Math.max(1, last - boundaries + 1); i <= last; i++) set.add(i);
  for (let i = Math.max(1, page - siblings); i <= Math.min(last, page + siblings); i++) set.add(i);
  const nums = [...set].sort((a, b) => a - b);
  const out = [];
  for (let i = 0; i < nums.length; i++) {
    if (i > 0) {
      const gap = nums[i] - nums[i - 1];
      if (gap === 2) out.push(nums[i] - 1);          // 只差一个：直接补上，不画省略号
      else if (gap > 2) out.push("gap");
    }
    out.push(nums[i]);
  }
  return out;
}

export function mountPager(el, options = {}) {
  const o = { ...DEFAULTS, ...options };
  const t = { ...(TEXTS[o.locale] || TEXTS.zh), ...(o.labels || {}) };
  let busy = false;
  el.classList.add("pager");
  if (!el.hasAttribute("role")) el.setAttribute("role", "navigation");
  el.setAttribute("aria-label", t.nav);

  const lastPage = () => Math.max(1, Math.ceil(o.total / o.pageSize));
  const clampPage = (p) => Math.min(lastPage(), Math.max(1, Math.trunc(Number(p)) || 1));

  function go(page, reason) {
    const p = clampPage(page);
    if (busy || p === o.page) { render(); return; }
    o.page = p;
    render();
    if (reason === "key") el.querySelector(".pager-btn.active")?.focus();  // 方向键翻页：焦点跟着当前页走
    o.onChange?.({ page: o.page, pageSize: o.pageSize, reason });
  }

  function btn(label, page, { cls = "", aria, current = false, disabled = false } = {}) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `pager-btn${cls ? ` ${cls}` : ""}${current ? " active" : ""}`;
    b.textContent = label;
    if (aria) b.setAttribute("aria-label", aria);
    if (current) b.setAttribute("aria-current", "page");
    b.disabled = disabled || busy;
    b.dataset.page = String(page);
    return b;
  }

  function render() {
    o.page = clampPage(o.page);
    const last = lastPage();
    const parts = [];

    if (o.summary) {
      const info = document.createElement("span");
      info.className = "pager-info";
      if (o.total > 0) {
        const a = (o.page - 1) * o.pageSize + 1;
        const b = Math.min(o.total, o.page * o.pageSize);
        info.textContent = `${t.total(fmtNum(o.total, o.locale))} · ${t.range(fmtNum(a, o.locale), fmtNum(b, o.locale))}`;
      } else {
        info.textContent = t.empty;
      }
      parts.push(info);
    }

    let sizeEl = null;
    if (o.pageSizes && o.pageSizes.length) {
      const sel = document.createElement("select");
      sel.className = "field small pager-size";
      sel.setAttribute("aria-label", t.sizeLabel);
      const sizes = [...new Set([...o.pageSizes, o.pageSize])].sort((a, b) => a - b);
      for (const n of sizes) {
        const op = document.createElement("option");
        op.value = String(n);
        op.textContent = t.size(n);
        op.selected = n === o.pageSize;
        sel.append(op);
      }
      sel.disabled = busy;
      sel.addEventListener("change", () => {
        const first = (o.page - 1) * o.pageSize;   // 保持当前第一条仍在页内
        o.pageSize = Number(sel.value);
        o.page = Math.floor(first / o.pageSize) + 1;
        render();
        o.onChange?.({ page: o.page, pageSize: o.pageSize, reason: "size" });
      });
      sizeEl = sel;
    }

    const nav = document.createElement("span");
    nav.className = "pager-nav";
    const atFirst = o.page <= 1;
    const atLast = o.page >= last;
    nav.append(
      btn("«", 1, { cls: "pager-edge", aria: t.first, disabled: atFirst }),
      btn("‹", o.page - 1, { cls: "pager-step", aria: t.prev, disabled: atFirst })
    );
    for (const it of pageItems(o.page, last, o.siblings, o.boundaries)) {
      if (it === "gap") {
        const g = document.createElement("span");
        g.className = "pager-gap";
        g.textContent = "…";
        g.setAttribute("aria-hidden", "true");
        nav.append(g);
      } else {
        nav.append(btn(String(it), it, { cls: "pager-num", aria: t.page(it), current: it === o.page }));
      }
    }
    const cur = document.createElement("span");
    cur.className = "pager-cur";
    cur.textContent = `${o.page} / ${last}`;
    nav.append(cur,
      btn("›", o.page + 1, { cls: "pager-step", aria: t.next, disabled: atLast }),
      btn("»", last, { cls: "pager-edge", aria: t.last, disabled: atLast }));
    parts.push(nav);
    const tools = document.createElement("span");
    tools.className = "pager-tools";
    if (sizeEl) tools.append(sizeEl);

    if (o.jump && last > 1) {
      const form = document.createElement("form");
      form.className = "pager-jump";
      const lab = document.createElement("label");
      const input = document.createElement("input");
      input.className = "field small";
      input.type = "number";
      input.min = "1";
      input.max = String(last);
      input.inputMode = "numeric";
      input.placeholder = String(o.page);
      input.setAttribute("aria-label", t.jumpLabel);
      input.disabled = busy;
      lab.append(t.jump, input, t.jumpUnit);
      form.append(lab);
      form.addEventListener("submit", (ev) => {
        ev.preventDefault();
        if (input.value) go(input.value, "jump");
      });
      tools.append(form);
    }
    if (tools.childElementCount) parts.push(tools);

    // 重绘会换掉按钮：焦点还给同一个按钮；它被禁用了（翻到头 / 取数中）就给当前页，再不行给容器，键盘连续翻页不丢焦点
    const had = el.contains(document.activeElement) && document.activeElement.classList.contains("pager-btn")
      ? document.activeElement.getAttribute("aria-label") : null;
    el.setAttribute("aria-busy", String(busy));
    el.replaceChildren(...parts);
    if (had !== null) {
      const btns = [...el.querySelectorAll(".pager-btn")];
      const target = btns.find((x) => x.getAttribute("aria-label") === had && !x.disabled)
        || btns.find((x) => x.classList.contains("active") && !x.disabled);
      if (target) target.focus();
      else { if (!el.hasAttribute("tabindex")) el.tabIndex = -1; el.focus(); }
    }
  }

  const onClick = (ev) => {
    const b = ev.target.closest(".pager-btn");
    if (b && el.contains(b) && !b.disabled) go(Number(b.dataset.page), "page");
  };
  const onKey = (ev) => {
    if (!o.keyboard || ev.target.closest("input, select, textarea")) return;
    if (ev.key === "ArrowLeft") { ev.preventDefault(); go(o.page - 1, "key"); }
    else if (ev.key === "ArrowRight") { ev.preventDefault(); go(o.page + 1, "key"); }
  };
  el.addEventListener("click", onClick);
  el.addEventListener("keydown", onKey);
  render();

  return {
    get page() { return o.page; },
    get pageSize() { return o.pageSize; },
    get total() { return o.total; },
    update(next = {}) {
      for (const k of ["total", "page", "pageSize", "pageSizes"]) if (next[k] !== undefined) o[k] = next[k];
      render();
    },
    setBusy(v) {
      busy = !!v;
      render();
    },
    destroy() {
      el.removeEventListener("click", onClick);
      el.removeEventListener("keydown", onKey);
      el.replaceChildren();
      el.classList.remove("pager");
      el.removeAttribute("aria-busy");
    }
  };
}
