/* ============================================================
   @szyyw/design · glide-select.js
   原生 <select> 的渐进增强：从触发器角上弹出的菜单，高亮块在行间滑动。
   出处：React Bits Glide Select（David Haz），MIT + Commons Clause；
   对勾 / 箭头为内联 SVG（自绘，非图标库）。

     <select class="field" data-glide> … </select>
     enhanceSelects();                          // 处理文档里所有 select[data-glide]
     const h = enhanceSelect(selectEl, { placement: "bottom", align: "left" });
     h.refresh();  h.destroy();

   原生 select 留在 DOM 里（视觉隐藏）并始终是真实数据源：
   - 选中时写 select.selectedIndex，再依次派发原生 input / change（冒泡），React 受控组件、
     表单提交、required 校验、form.reset() 都照常；派发之后重新读原生值，所以受控组件把值改回去也能同步。
   - 外部改 select.value / selectedIndex 会自动同步（实例上挂了同名访问器，写入时不派发事件，不会回环）；
     option 列表 / disabled / 文案 / data-tag 变化由 MutationObserver 同步；其余情况手动 refresh()。
   - <label for> 点击会把焦点转给触发器。
   - 不支持 multiple / size>1 的 select（原样保留）。

   菜单挂在 <body> 上 fixed 定位（不被 .table-wrap 裁、不被 .glass 的 backdrop-filter 困住），
   页面滚动 / 缩放时关闭（菜单自己的滚动不算）；同一时刻只开一个。
   键盘：↑↓ Home End Enter / Space Esc Tab，字母键跳转（连续输入按前缀匹配，同一字母重复按在同字母项间轮转）。
   aria：触发器 role=combobox + aria-activedescendant，菜单 role=listbox / option / group。

   选项（也可写在 select 上：data-glide-<名字>，元素上的优先，名字 kebab：data-glide-menu-width）：
     placeholder       选中项 value 为 "" 时触发器显示的文字；缺省取该 option 的文字，再缺省 "Select…"
     showTags          option 的 data-tag 显示在行尾；缺省 true
     accent / surface / highlight / text   颜色：CSS 颜色或 token 名（"--accent"）；缺省分别取
                       --accent / --sheet-bg / --accent（14% 着色）/ --text
     size              "sm" | "md" | "lg"（仅非 .field 的 select；.field 跟 .field 自己的尺寸）
     radius            菜单圆角 px，缺省 12
     menuWidth         菜单宽度 px；缺省 null = 不小于触发器、按内容
     placement         "bottom"（缺省）| "top"；放不下自动翻转
     align             "left"（缺省）| "right"
     popDuration       弹出 ms，缺省 180（收起为 2/3）
     glideDuration     高亮块滑动 ms，缺省 220
     rememberPosition  鼠标移出列表后高亮留在原行；缺省 true
     ariaLabel         无 <label> 时的可访问名；缺省取 select 的 aria-label
   模块顶层不碰 DOM。
   ============================================================ */

const GAP = 6;
const EDGE = 8;
const SVG_NS = "http://www.w3.org/2000/svg";

let openClose = null;
let uid = 0;

const DEFAULTS = {
  placeholder: undefined,
  showTags: true,
  accent: "--accent",
  surface: "--sheet-bg",
  highlight: undefined,
  text: "--text",
  size: "md",
  radius: 12,
  menuWidth: null,
  placement: "bottom",
  align: "left",
  popDuration: 180,
  glideDuration: 220,
  rememberPosition: true,
  ariaLabel: undefined
};
const SIZES = { sm: { chip: 28, row: 28, font: 12 }, md: { chip: 32, row: 32, font: 13 }, lg: { chip: 44, row: 40, font: 14 } };

const proto = HTMLSelectElement?.prototype;
const nativeValue = proto && Object.getOwnPropertyDescriptor(proto, "value");
const nativeIndex = proto && Object.getOwnPropertyDescriptor(proto, "selectedIndex");

const colorOf = (v) => (typeof v === "string" && v.startsWith("--") ? `var(${v})` : v);
const bool = (v, d) => (v === undefined ? d : v === "" || v === "true" || v === "1" ? true : !(v === "false" || v === "0"));
const numOr = (v, d) => (v === undefined || v === "" || Number.isNaN(Number(v)) ? d : Number(v));

function fromData(select) {
  const d = select.dataset;
  const o = {};
  if (d.glidePlaceholder !== undefined) o.placeholder = d.glidePlaceholder;
  if (d.glideShowTags !== undefined) o.showTags = bool(d.glideShowTags, true);
  for (const k of ["accent", "surface", "highlight", "text", "size", "placement", "align"]) {
    const v = d["glide" + k[0].toUpperCase() + k.slice(1)];
    if (v !== undefined) o[k] = v;
  }
  for (const k of ["radius", "menuWidth", "popDuration", "glideDuration"]) {
    const v = d["glide" + k[0].toUpperCase() + k.slice(1)];
    if (v !== undefined) o[k] = numOr(v, undefined);
  }
  if (d.glideRememberPosition !== undefined) o.rememberPosition = bool(d.glideRememberPosition, true);
  if (d.glideAriaLabel !== undefined) o.ariaLabel = d.glideAriaLabel;
  return o;
}

function svg(d, size, sw) {
  const s = document.createElementNS(SVG_NS, "svg");
  s.setAttribute("viewBox", "0 0 24 24");
  s.setAttribute("width", size);
  s.setAttribute("height", size);
  s.setAttribute("fill", "none");
  s.setAttribute("stroke", "currentColor");
  s.setAttribute("stroke-width", sw);
  s.setAttribute("stroke-linecap", "round");
  s.setAttribute("stroke-linejoin", "round");
  s.setAttribute("aria-hidden", "true");
  const p = document.createElementNS(SVG_NS, "path");
  p.setAttribute("d", d);
  s.appendChild(p);
  return s;
}
const chevron = () => svg("M6 9l6 6 6-6", 12, 2.5);
const tick = () => svg("M5 12.5l4.5 4.5L19 7.5", 13, 2.5);

const registry = new WeakMap();

/**
 * @param {HTMLSelectElement} select
 * @param {object} [options]
 * @returns {{ refresh(): void, destroy(): void }}
 */
export function enhanceSelect(select, options = {}) {
  if (typeof document === "undefined" || !select) return { refresh() {}, destroy() {} };
  const existing = registry.get(select);
  if (existing) return existing;
  if (select.multiple || select.size > 1) return { refresh() {}, destroy() {} };

  const o = { ...DEFAULTS, ...options, ...fromData(select) };
  const S = SIZES[o.size] || SIZES.md;
  const id = `glide-${++uid}`;
  const isField = select.classList.contains("field");
  const popOut = Math.round((o.popDuration * 2) / 3);
  const mq = typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null;

  // ---------- 触发器 ----------
  const root = document.createElement("span");
  root.className = "glide-select" + (isField ? " glide-select--field" : "") + (o.className ? ` ${o.className}` : "");
  root.dataset.size = o.size;
  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "glide-select__trigger" + (isField ? " field" + (select.classList.contains("small") ? " small" : "") : "");
  trigger.setAttribute("role", "combobox");
  trigger.setAttribute("aria-haspopup", "listbox");
  trigger.setAttribute("aria-expanded", "false");
  trigger.setAttribute("aria-controls", `${id}-list`);
  const labelEl = document.createElement("span");
  labelEl.className = "glide-select__label";
  const chev = document.createElement("span");
  chev.className = "glide-select__chevron";
  chev.setAttribute("aria-hidden", "true");
  chev.appendChild(chevron());
  trigger.append(labelEl, chev);
  root.appendChild(trigger);

  const setVars = (el) => {
    el.style.setProperty("--gs-accent", colorOf(o.accent));
    el.style.setProperty("--gs-surface", colorOf(o.surface));
    el.style.setProperty("--gs-highlight", o.highlight ? colorOf(o.highlight) : `color-mix(in srgb, ${colorOf(o.accent)} 14%, transparent)`);
    el.style.setProperty("--gs-text", colorOf(o.text));
    el.style.setProperty("--gs-radius", `${o.radius}px`);
    el.style.setProperty("--gs-inner-radius", `${Math.max(3, o.radius - 4)}px`);
    el.style.setProperty("--gs-chip", `${S.chip}px`);
    el.style.setProperty("--gs-row", `${S.row}px`);
    el.style.setProperty("--gs-font", `${S.font}px`);
    el.style.setProperty("--gs-pop", `${o.popDuration}ms`);
    el.style.setProperty("--gs-pop-out", `${popOut}ms`);
    el.style.setProperty("--gs-glide", `${o.glideDuration}ms`);
  };
  setVars(root);

  select.after(root);
  const hadTabindex = select.getAttribute("tabindex");
  const hadAriaHidden = select.getAttribute("aria-hidden");
  select.classList.add("glide-native");
  select.setAttribute("tabindex", "-1");
  select.setAttribute("aria-hidden", "true");

  // 可访问名
  const labels = select.labels ? [...select.labels] : [];
  if (labels.length) {
    for (const l of labels) if (!l.id) l.id = `${id}-label-${uid++}`;
    trigger.setAttribute("aria-labelledby", labels.map((l) => l.id).join(" "));
  } else {
    const al = o.ariaLabel || select.getAttribute("aria-label") || select.title;
    if (al) trigger.setAttribute("aria-label", al);
  }

  // ---------- 状态 ----------
  let items = []; // { kind:"option", el, index, label, tag, disabled, value } | { kind:"group", label }
  let open = false;
  let active = -1; // items 下标（option）
  let menu = null;
  let list = null;
  let pill = null;
  let side = o.placement;
  let closeTimer = 0;
  let typeBuf = "";
  let typeTimer = 0;
  let scrub = null;
  let instant = true;
  let destroyed = false;

  function collect() {
    const out = [];
    const walk = (parent, groupDisabled, group) => {
      for (const c of parent.children) {
        if (c.tagName === "OPTGROUP") {
          out.push({ kind: "group", label: c.label || "", id: `${id}-g${out.length}` });
          walk(c, groupDisabled || c.disabled, c);
        } else if (c.tagName === "OPTION") {
          if (c.hidden) continue;
          out.push({
            kind: "option",
            el: c,
            index: c.index,
            value: c.value,
            label: c.label || c.textContent.trim(),
            tag: c.dataset.tag,
            disabled: groupDisabled || c.disabled,
            inGroup: !!group
          });
        }
      }
    };
    walk(select, false, null);
    return out;
  }
  const optIdx = () => items.map((it, i) => (it.kind === "option" ? i : -1)).filter((i) => i >= 0);
  const selectedItem = () => items.findIndex((it) => it.kind === "option" && it.index === select.selectedIndex);

  function paintLabel(animate) {
    const si = selectedItem();
    const sel = si >= 0 ? items[si] : null;
    const selOpt = select.options[select.selectedIndex];
    const empty = !selOpt || selOpt.value === "";
    const text = empty ? o.placeholder ?? (selOpt && selOpt.textContent.trim()) ?? "Select…" : sel ? sel.label : selOpt.textContent.trim();
    const next = text || o.placeholder || "Select…";
    if (labelEl.textContent !== next) {
      labelEl.textContent = next;
      if (animate && !mq?.matches) {
        root.dataset.swap = "";
        setTimeout(() => delete root.dataset.swap, 200);
      }
    }
    if (empty) labelEl.dataset.empty = "";
    else delete labelEl.dataset.empty;
  }

  function paintDisabled() {
    trigger.disabled = select.disabled;
    if (select.disabled) {
      root.dataset.disabled = "";
      if (open) close(true);
    } else delete root.dataset.disabled;
  }

  // ---------- 菜单 ----------
  function buildMenu() {
    const keep = active >= 0 ? items[active]?.el : null;
    menu.textContent = "";
    list = document.createElement("div");
    list.className = "glide-select__list";
    list.id = `${id}-list`;
    list.setAttribute("role", "listbox");
    const nm = trigger.getAttribute("aria-label");
    if (nm) list.setAttribute("aria-label", nm);
    else if (trigger.getAttribute("aria-labelledby")) list.setAttribute("aria-labelledby", trigger.getAttribute("aria-labelledby"));
    pill = document.createElement("span");
    pill.className = "glide-select__pill";
    pill.setAttribute("aria-hidden", "true");
    list.appendChild(pill);
    const selectedIdx = select.selectedIndex;
    let grp = null;
    items.forEach((it, i) => {
      if (it.kind === "group") {
        grp = document.createElement("div");
        grp.className = "glide-select__group";
        grp.setAttribute("role", "group");
        grp.setAttribute("aria-labelledby", it.id);
        const h = document.createElement("div");
        h.className = "glide-select__group-label";
        h.id = it.id;
        h.textContent = it.label;
        grp.appendChild(h);
        list.appendChild(grp);
        it.node = grp;
        return;
      }
      const row = document.createElement("div");
      row.className = "glide-select__option";
      row.id = `${id}-o${i}`;
      row.setAttribute("role", "option");
      row.setAttribute("aria-selected", String(it.index === selectedIdx));
      if (it.disabled) row.setAttribute("aria-disabled", "true");
      row.dataset.i = String(i);
      const name = document.createElement("span");
      name.className = "glide-select__name";
      name.textContent = it.label;
      row.appendChild(name);
      if (o.showTags && it.tag) {
        const t = document.createElement("span");
        t.className = "glide-select__tag";
        t.textContent = it.tag;
        row.appendChild(t);
      }
      const ck = document.createElement("span");
      ck.className = "glide-select__check";
      if (it.index === selectedIdx) ck.dataset.on = "";
      ck.setAttribute("aria-hidden", "true");
      ck.appendChild(tick());
      row.appendChild(ck);
      (it.inGroup && grp ? grp : list).appendChild(row);
      it.row = row;
      if (!it.inGroup) grp = null;
    });
    menu.appendChild(list);
    if (keep) {
      const k = items.findIndex((it) => it.el === keep);
      active = k;
    }
    list.addEventListener("pointerover", onOver);
    list.addEventListener("pointerleave", onLeave);
    list.addEventListener("pointerdown", onListDown);
    list.addEventListener("pointermove", onListMove);
    list.addEventListener("pointerup", onListUp);
    list.addEventListener("pointercancel", onListUp);
  }

  function movePill(jump) {
    if (!pill) return;
    const row = active >= 0 ? items[active]?.row : null;
    if (!row) {
      pill.style.opacity = "0";
      return;
    }
    const first = pill.style.opacity !== "1";
    pill.style.transitionDuration = jump || first || mq?.matches ? "0ms, 150ms" : "";
    pill.style.height = `${row.offsetHeight}px`;
    pill.style.transform = `translateY(${row.offsetTop}px)`;
    pill.style.opacity = "1";
    list.dataset.live = "";
  }

  function setActive(i, { jump = false, scroll = false } = {}) {
    if (i === active) return;
    active = i;
    if (active < 0) {
      delete list?.dataset.live;
      trigger.removeAttribute("aria-activedescendant");
    } else {
      trigger.setAttribute("aria-activedescendant", items[active].row.id);
      if (scroll) items[active].row.scrollIntoView({ block: "nearest" });
    }
    movePill(jump);
  }

  function place() {
    const r = trigger.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    menu.style.minWidth = `${Math.round(r.width)}px`;
    menu.style.width = o.menuWidth ? `${o.menuWidth}px` : "max-content";
    menu.style.maxHeight = "";
    const m = menu.getBoundingClientRect();
    const need = m.height;
    const below = vh - r.bottom - GAP - EDGE;
    const above = r.top - GAP - EDGE;
    side = o.placement;
    if (side === "bottom" && need > below && above > below) side = "top";
    else if (side === "top" && need > above && below > above) side = "bottom";
    const room = side === "bottom" ? below : above;
    const h = Math.min(need, Math.max(120, room));
    if (need > room) menu.style.maxHeight = `${Math.round(h)}px`;
    let left = o.align === "right" ? r.right - m.width : r.left;
    left = Math.min(Math.max(EDGE, left), Math.max(EDGE, vw - m.width - EDGE));
    const top = side === "bottom" ? r.bottom + GAP : r.top - GAP - Math.min(need, h);
    menu.style.left = `${Math.round(left)}px`;
    menu.style.top = `${Math.round(top)}px`;
    const align = o.align === "right" ? "right" : "left";
    menu.style.transformOrigin = `${side === "bottom" ? "top" : "bottom"} ${align}`;
    menu.dataset.side = side;
    menu.dataset.align = align;
    // 滑动型菜单没有溢出时，触摸可在列表上拖选（touch-action: none）；有溢出就让它滚
    list.classList.toggle("is-scrollable", menu.scrollHeight > menu.clientHeight + 1);
  }

  function doOpen(viaKey) {
    if (open || select.disabled || destroyed) return;
    if (openClose) openClose();
    clearTimeout(closeTimer);
    items = collect();
    menu = document.createElement("div");
    menu.className = "glide-select__menu";
    menu.dataset.state = "closed";
    setVars(menu);
    menu.addEventListener("pointerdown", keepFocus);
    menu.addEventListener("mousedown", keepFocus);
    buildMenu();
    document.body.appendChild(menu);
    open = true;
    openClose = () => close(true);
    trigger.setAttribute("aria-expanded", "true");
    place();
    const si = selectedItem();
    active = -1;
    instant = true;
    const startAt = si >= 0 ? si : viaKey ? optIdx().find((i) => !items[i].disabled) ?? -1 : -1;
    setActive(startAt, { jump: true, scroll: true });
    // 下一帧才切到 open，触发弹出过渡
    void menu.offsetHeight;
    menu.dataset.state = "open";
    document.addEventListener("pointerdown", onDocDown, true);
    window.addEventListener("scroll", onScroll, { capture: true, passive: true });
    window.addEventListener("resize", onResize, { passive: true });
  }

  const keepFocus = (e) => e.preventDefault(); // 点菜单不让触发器丢焦点

  function close(immediate) {
    if (!open) return;
    open = false;
    if (openClose) openClose = null;
    trigger.setAttribute("aria-expanded", "false");
    trigger.removeAttribute("aria-activedescendant");
    document.removeEventListener("pointerdown", onDocDown, true);
    window.removeEventListener("scroll", onScroll, { capture: true });
    window.removeEventListener("resize", onResize);
    scrub = null;
    const m = menu;
    menu = list = pill = null;
    active = -1;
    if (!m) return;
    if (immediate || mq?.matches) {
      m.remove();
      return;
    }
    m.dataset.state = "closed";
    closeTimer = setTimeout(() => m.remove(), popOut + 30);
  }

  function pick(i, viaKey) {
    const it = items[i];
    if (!it || it.kind !== "option" || it.disabled) return;
    const changed = it.index !== select.selectedIndex;
    close(true);
    trigger.focus({ preventScroll: true });
    if (changed) {
      nativeIndex.set.call(select, it.index);
      select.dispatchEvent(new Event("input", { bubbles: true }));
      select.dispatchEvent(new Event("change", { bubbles: true }));
      if (!viaKey) root.dataset.swap = "";
      setTimeout(() => delete root.dataset.swap, 200);
    }
    sync();
  }

  // ---------- 事件 ----------
  function onDocDown(e) {
    if (!menu) return;
    if (menu.contains(e.target) || root.contains(e.target)) return;
    close(false);
  }
  function onScroll(e) {
    if (menu && !menu.contains(e.target)) close(true);
  }
  function onResize() {
    close(true);
  }

  const rowOf = (el) => el?.closest?.(".glide-select__option");
  function onOver(e) {
    if (e.pointerType === "touch" || scrub) return;
    const row = rowOf(e.target);
    if (!row || row.getAttribute("aria-disabled") === "true") return;
    setActive(Number(row.dataset.i));
  }
  function onLeave() {
    if (!scrub && !o.rememberPosition) setActive(-1);
  }
  function rowAt(x, y) {
    const row = rowOf(document.elementFromPoint(x, y));
    if (!row || row.getAttribute("aria-disabled") === "true") return -1;
    return Number(row.dataset.i);
  }
  function onListDown(e) {
    if (e.button !== 0 || scrub) return;
    const canScrub = e.pointerType === "touch" ? !list.classList.contains("is-scrollable") : true;
    scrub = { id: e.pointerId, down: rowAt(e.clientX, e.clientY), canScrub, moved: false, x: e.clientX, y: e.clientY };
    if (canScrub) {
      try {
        list.setPointerCapture(e.pointerId);
      } catch {}
      setActive(scrub.down, { jump: e.pointerType === "touch" });
    }
  }
  function onListMove(e) {
    if (!scrub || scrub.id !== e.pointerId) return;
    if (Math.abs(e.clientX - scrub.x) + Math.abs(e.clientY - scrub.y) > 6) scrub.moved = true;
    if (!scrub.canScrub) return;
    const i = rowAt(e.clientX, e.clientY);
    if (i !== active && (i >= 0 || e.pointerType === "touch")) setActive(i);
  }
  function onListUp(e) {
    if (!scrub || scrub.id !== e.pointerId) return;
    const s = scrub;
    scrub = null;
    if (e.type === "pointercancel") return;
    if (!s.canScrub && s.moved) return; // 滚动手势
    const i = rowAt(e.clientX, e.clientY);
    if (i >= 0) pick(i, false);
    else if (!o.rememberPosition) setActive(-1);
  }

  function step(from, dir) {
    const opts = optIdx().filter((i) => !items[i].disabled);
    if (!opts.length) return -1;
    if (from < 0) return dir > 0 ? opts[0] : opts[opts.length - 1];
    const pos = opts.indexOf(from);
    if (pos < 0) return dir > 0 ? opts.find((i) => i > from) ?? opts[opts.length - 1] : [...opts].reverse().find((i) => i < from) ?? opts[0];
    return opts[Math.min(opts.length - 1, Math.max(0, pos + dir))];
  }
  function typeahead(ch) {
    clearTimeout(typeTimer);
    typeBuf += ch.toLowerCase();
    typeTimer = setTimeout(() => (typeBuf = ""), 600);
    const opts = optIdx().filter((i) => !items[i].disabled);
    if (!opts.length) return -1;
    const cyc = [...typeBuf].every((c) => c === typeBuf[0]);
    const q = cyc ? typeBuf[0] : typeBuf;
    const startPos = Math.max(0, opts.indexOf(active));
    for (let k = cyc ? 1 : 0; k <= opts.length; k++) {
      const i = opts[(startPos + k) % opts.length];
      if (items[i].label.toLowerCase().startsWith(q)) return i;
    }
    return -1;
  }

  function onKey(e) {
    const k = e.key;
    if (!open) {
      if (k === "Enter" || k === " " || k === "ArrowDown" || k === "ArrowUp") {
        e.preventDefault();
        doOpen(true);
      } else if (k.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
        // 关着时字母键直接切换选中项（原生 select 的行为）
        items = collect();
        const opts = optIdx().filter((i) => !items[i].disabled);
        const cur = selectedItem();
        const startPos = Math.max(0, opts.indexOf(cur));
        const c = k.toLowerCase();
        for (let n = 1; n <= opts.length; n++) {
          const i = opts[(startPos + n) % opts.length];
          if (items[i].label.toLowerCase().startsWith(c)) {
            if (items[i].index !== select.selectedIndex) pick(i, true);
            break;
          }
        }
      }
      return;
    }
    const go = (i) => {
      e.preventDefault();
      if (i >= 0) setActive(i, { jump: true, scroll: true });
    };
    if (k === "ArrowDown") go(step(active, 1));
    else if (k === "ArrowUp") go(step(active, -1));
    else if (k === "Home") go(step(-1, 1));
    else if (k === "End") go(step(-1, -1));
    else if (k === "Enter" || k === " ") {
      e.preventDefault();
      if (active >= 0) pick(active, true);
      else close(true);
    } else if (k === "Escape") {
      e.preventDefault();
      close(true);
    } else if (k === "Tab") close(true);
    else if (k.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) go(typeahead(k));
  }

  function onTriggerDown(e) {
    if (e.button !== 0 || select.disabled) return;
    e.preventDefault(); // 不让按下时丢焦点 / 起选区
    trigger.focus({ preventScroll: true });
    if (open) close(false);
    else doOpen(false);
  }
  function onTriggerClick(e) {
    // 指针路径在 pointerdown 已处理；detail 为 0 = 辅助技术 / 脚本触发的 click
    if (e.detail === 0 && !e.pointerType) open ? close(false) : doOpen(true);
  }
  trigger.addEventListener("pointerdown", onTriggerDown);
  trigger.addEventListener("mousedown", keepFocus);
  trigger.addEventListener("click", onTriggerClick);
  trigger.addEventListener("keydown", onKey);
  const onNativeFocus = () => trigger.focus({ preventScroll: true });
  select.addEventListener("focus", onNativeFocus);

  // ---------- 同步 ----------
  let lastKey = "";
  function sync() {
    if (destroyed) return;
    const key = `${select.selectedIndex}|${select.options.length}|${select.disabled}`;
    items = collect();
    paintLabel(key !== lastKey && lastKey !== "");
    lastKey = key;
    paintDisabled();
    if (open && menu) {
      buildMenu();
      place();
      setActive(Math.min(active, items.length - 1), { jump: true });
    }
  }
  function refresh() {
    lastKey = "";
    sync();
  }

  // 外部写 value / selectedIndex 时同步（不派发事件）
  Object.defineProperty(select, "value", {
    configurable: true,
    get() {
      return nativeValue.get.call(this);
    },
    set(v) {
      nativeValue.set.call(this, v);
      sync();
    }
  });
  Object.defineProperty(select, "selectedIndex", {
    configurable: true,
    get() {
      return nativeIndex.get.call(this);
    },
    set(v) {
      nativeIndex.set.call(this, v);
      sync();
    }
  });

  let moQueued = false;
  const mo = new MutationObserver(() => {
    if (moQueued) return;
    moQueued = true;
    queueMicrotask(() => {
      moQueued = false;
      sync();
    });
  });
  mo.observe(select, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["disabled", "label", "value", "data-tag", "hidden", "selected"] });

  const onNativeChange = () => sync(); // 脚本直接对原生派发 change（或用户经表单控件改了）
  select.addEventListener("change", onNativeChange);
  const form = select.form;
  const onReset = () => setTimeout(sync, 0);
  form?.addEventListener("reset", onReset);

  sync();
  lastKey = `${select.selectedIndex}|${select.options.length}|${select.disabled}`;

  const handle = {
    refresh,
    destroy() {
      if (destroyed) return;
      close(true);
      destroyed = true;
      mo.disconnect();
      select.removeEventListener("focus", onNativeFocus);
      select.removeEventListener("change", onNativeChange);
      form?.removeEventListener("reset", onReset);
      delete select.value;
      delete select.selectedIndex;
      select.classList.remove("glide-native");
      if (hadTabindex === null) select.removeAttribute("tabindex");
      else select.setAttribute("tabindex", hadTabindex);
      if (hadAriaHidden === null) select.removeAttribute("aria-hidden");
      else select.setAttribute("aria-hidden", hadAriaHidden);
      root.remove();
      registry.delete(select);
    }
  };
  registry.set(select, handle);
  return handle;
}

/**
 * 处理 root（缺省 document）里所有 select[data-glide]。已处理的跳过。
 * @returns {() => void} 解除本次处理的所有 select
 */
export function enhanceSelects(root = document, options = {}) {
  if (typeof document === "undefined") return () => {};
  const scope = root || document;
  const picks = [];
  if (scope.matches?.("select[data-glide]")) picks.push(scope);
  picks.push(...scope.querySelectorAll("select[data-glide]"));
  const hs = [];
  for (const el of picks) {
    if (registry.has(el)) continue;
    hs.push(enhanceSelect(el, options));
  }
  return () => hs.forEach((h) => h.destroy());
}
