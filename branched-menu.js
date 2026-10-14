/* ============================================================
   @szyyw/design · branched-menu.js（v0.19.0）
   Branched Menu（备用组件，不接入任何现有界面）：分组标题 + 可折叠的子项，
   一根主干线向各子项分出圆角支线；选中项的支线被「描」成强调色，左侧小标记随选中项滑动。

   出处与许可：React Bits「Branched Menu」（https://reactbits.dev/components/branched-menu），
   Copyright (c) 2026 David Haz，MIT + Commons Clause License Condition v1.0。
   本移植由包作者知情决定随个人站点的设计包一起发布；使用者请自行留意上游许可
   （Commons Clause：不得出售 / 再许可组件本身）。上游原件存于 reference/reactbits/（不进 package files）。
   图标：内置 8 个来自 Hugeicons 免费图标集（@hugeicons/core-free-icons，MIT License，
   Copyright (c) 2025 Hugeicons，https://github.com/hugeicons/hugeicons），以内联 SVG 收在 ICONS 里；
   上游演示用的就是这 8 个。也可传自己的 SVG 标记 / Node。

     import { mountBranchedMenu } from "@szyyw/design/branched-menu";
     const menu = mountBranchedMenu(el, {
       sections: [
         { label: "开始", items: [{ label: "安装", value: "install", icon: "install" }, …] },
         { label: "关于", value: "about" },                       // 没有 items = 单行叶子
       ],
       value: "install",
       onSelect: (value, item) => {},
     });
     menu.set("about"); menu.destroy();

   对照上游：items → sections；children → items；defaultActive → value；其余参数同名保留
   （defaultOpen / onToggle / color / accentColor / lineColor / width / rowHeight / indent / trunk /
   radius / lineWidth / fontSize / drawDuration / foldDuration / className）。
   新增：section 的 icon（标题前小图标）；返回 { set, toggle, destroy }。
   与上游的差异：颜色缺省取 token（--text / --accent / --text-dim 派生），样式在 components.css 的「interactions」段；
   reduced-motion 下折叠与描线不做过渡。
   模块顶层不碰 DOM：SSR 时被求值也不会炸。
   ============================================================ */

/** 内置图标名 → SVG 内部标记（24×24 视口，描边 currentColor） */
export const ICONS = {
  install: '<path d="M16.9504 12.1817C17.1981 12.814 16.5076 13.5726 15.1267 15.0899C13.6702 16.6902 12.9201 17.4904 12 17.5C11.0799 17.4904 10.3298 16.6902 8.87331 15.0899C7.49239 13.5726 6.80193 12.814 7.04964 12.1817C7.05868 12.1586 7.06851 12.1359 7.0791 12.1135C7.34928 11.542 8.24477 11.5029 10 11.5002V4.99998C10 4.53501 10 4.30253 10.0511 4.11179C10.1898 3.59414 10.5941 3.1898 11.1118 3.05111C11.3025 3 11.535 3 12 3C12.4649 3 12.6974 3 12.8882 3.05111C13.4058 3.1898 13.8102 3.59414 13.9489 4.11179C14 4.30253 14 4.53501 14 4.99998V11.5002C15.7552 11.5029 16.6507 11.542 16.9209 12.1135C16.9315 12.1359 16.9413 12.1586 16.9504 12.1817Z" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/><path d="M5.00006 21H19.0001" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>',
  rocket: '<path d="M6.21875 11.618L3.31189 11.2378C2.71644 11.1606 2.31883 10.5841 2.58348 10.0458C3.42523 8.33365 5.6195 6.35437 9.73988 6.68079M6.21875 11.618C7.27445 9.85426 8.57175 8.00435 9.73988 6.68079M6.21875 11.618L11.882 17.2812M9.73988 6.68079C13.4105 2.58986 17.1745 1.728 19.5937 2.06685C20.5508 2.2009 21.2991 2.94917 21.4332 3.90626C21.772 6.32551 20.9101 10.0895 16.8192 13.7601M11.882 17.2812L12.2622 20.1881C12.3394 20.7836 12.9159 21.1812 13.4542 20.9165C15.1664 20.0748 17.1456 17.8805 16.8192 13.7601M11.882 17.2812C13.6457 16.2255 15.4956 14.9282 16.8192 13.7601" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/><path d="M17.5 8C17.5 6.89543 16.6046 6 15.5 6C14.3954 6 13.5 6.89543 13.5 8C13.5 9.10457 14.3954 10 15.5 10C16.6046 10 17.5 9.10457 17.5 8Z" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/><path d="M4 22L8 18M4 17L5.5 15.5" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>',
  settings: '<path d="M15.5 12C15.5 13.933 13.933 15.5 12 15.5C10.067 15.5 8.5 13.933 8.5 12C8.5 10.067 10.067 8.5 12 8.5C13.933 8.5 15.5 10.067 15.5 12Z" stroke="currentColor"/><path d="M21.011 14.0965C21.5329 13.9558 21.7939 13.8854 21.8969 13.7508C22 13.6163 22 13.3998 22 12.9669V11.0332C22 10.6003 22 10.3838 21.8969 10.2493C21.7938 10.1147 21.5329 10.0443 21.011 9.90358C19.0606 9.37759 17.8399 7.33851 18.3433 5.40087C18.4817 4.86799 18.5509 4.60156 18.4848 4.44529C18.4187 4.28902 18.2291 4.18134 17.8497 3.96596L16.125 2.98673C15.7528 2.77539 15.5667 2.66972 15.3997 2.69222C15.2326 2.71472 15.0442 2.90273 14.6672 3.27873C13.208 4.73448 10.7936 4.73442 9.33434 3.27864C8.95743 2.90263 8.76898 2.71463 8.60193 2.69212C8.43489 2.66962 8.24877 2.77529 7.87653 2.98663L6.15184 3.96587C5.77253 4.18123 5.58287 4.28891 5.51678 4.44515C5.45068 4.6014 5.51987 4.86787 5.65825 5.4008C6.16137 7.3385 4.93972 9.37763 2.98902 9.9036C2.46712 10.0443 2.20617 10.1147 2.10308 10.2492C2 10.3838 2 10.6003 2 11.0332V12.9669C2 13.3998 2 13.6163 2.10308 13.7508C2.20615 13.8854 2.46711 13.9558 2.98902 14.0965C4.9394 14.6225 6.16008 16.6616 5.65672 18.5992C5.51829 19.1321 5.44907 19.3985 5.51516 19.5548C5.58126 19.7111 5.77092 19.8188 6.15025 20.0341L7.87495 21.0134C8.24721 21.2247 8.43334 21.3304 8.6004 21.3079C8.76746 21.2854 8.95588 21.0973 9.33271 20.7213C10.7927 19.2644 13.2088 19.2643 14.6689 20.7212C15.0457 21.0973 15.2341 21.2853 15.4012 21.3078C15.5682 21.3303 15.7544 21.2246 16.1266 21.0133L17.8513 20.034C18.2307 19.8187 18.4204 19.711 18.4864 19.5547C18.5525 19.3984 18.4833 19.132 18.3448 18.5991C17.8412 16.6616 19.0609 14.6226 21.011 14.0965Z" stroke="currentColor" stroke-linecap="round" stroke-width="1.5"/>',
  paint: '<path d="M22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22C12.8417 22 14 22.1163 14 21C14 20.391 13.6832 19.9212 13.3686 19.4544C12.9082 18.7715 12.4523 18.0953 13 17C13.6667 15.6667 14.7778 15.6667 16.4815 15.6667C17.3334 15.6667 18.3334 15.6667 19.5 15.5C21.601 15.1999 22 13.9084 22 12Z" stroke="currentColor"/><circle cx="9.5" cy="8.5" r="1.5" stroke="currentColor"/><circle cx="16.5" cy="9.5" r="1.5" stroke="currentColor"/><path d="M7.125 15H7M7.25 15C7.25 15.1381 7.13807 15.25 7 15.25C6.86193 15.25 6.75 15.1381 6.75 15C6.75 14.8619 6.86193 14.75 7 14.75C7.13807 14.75 7.25 14.8619 7.25 15Z" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>',
  pointer: '<path d="M12.0033 19.4056L9.88486 13.3197L9.88485 13.3197C9.08816 11.031 8.68981 9.88664 9.28857 9.28834C9.88733 8.69005 11.0326 9.08809 13.3231 9.88417L19.401 11.9966C20.6716 12.4382 21.3069 12.659 21.4441 13.0867C21.4819 13.2045 21.4949 13.329 21.4824 13.4521C21.4369 13.8989 20.8612 14.2464 19.7097 14.9415C18.9714 15.3872 18.6023 15.61 18.5039 15.9462C18.476 16.0414 18.4641 16.1405 18.4686 16.2396C18.4845 16.5896 18.7902 16.8935 19.4018 17.5012L21.4116 19.4988L21.4117 19.4988C21.7125 19.7979 21.863 19.9474 21.932 20.1147C22.0223 20.3335 22.0227 20.5792 21.9329 20.7983C21.8644 20.9657 21.7143 21.1157 21.4142 21.4155L21.4142 21.4156C21.1148 21.7147 20.9652 21.8642 20.7979 21.9328C20.5791 22.0224 20.3337 22.0224 20.1149 21.9328C19.9476 21.8642 19.7979 21.7147 19.4986 21.4156L19.4986 21.4155L17.4812 19.3998L17.4812 19.3998C16.8797 18.7987 16.5789 18.4982 16.2338 18.4802C16.1293 18.4747 16.0247 18.4875 15.9246 18.5179C15.594 18.6185 15.3745 18.9825 14.9355 19.7106L14.9355 19.7106C14.2491 20.8492 13.9059 21.4185 13.4653 21.4686C13.3353 21.4833 13.2037 21.4696 13.0796 21.4284C12.6588 21.2887 12.4403 20.661 12.0033 19.4056Z" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/><path d="M10.8576 7.08329C11.0714 7.43808 11.5323 7.55239 11.8871 7.33861C12.2419 7.12483 12.3562 6.66392 12.1424 6.30913L10.8576 7.08329ZM6.30914 12.1424C6.66392 12.3562 7.12483 12.2419 7.33861 11.8871C7.55239 11.5323 7.43808 11.0714 7.08329 10.8576L6.30914 12.1424ZM5.75 8.5C5.75 6.98122 6.98123 5.75 8.5 5.75V4.25C6.15281 4.25 4.25 6.15279 4.25 8.5H5.75ZM8.5 5.75C9.49944 5.75 10.3752 6.28272 10.8576 7.08329L12.1424 6.30913C11.3999 5.07687 10.0469 4.25 8.5 4.25V5.75ZM7.08329 10.8576C6.28272 10.3752 5.75 9.49945 5.75 8.5H4.25C4.25 10.0469 5.07688 11.3999 6.30914 12.1424L7.08329 10.8576Z" fill="currentColor"/><path d="M14.2515 8.13498C14.2778 8.54836 14.6342 8.86216 15.0476 8.83587C15.461 8.80958 15.7748 8.45316 15.7485 8.03979L14.2515 8.13498ZM8.04118 15.7485C8.45457 15.7747 8.81093 15.4608 8.83714 15.0475C8.86335 14.6341 8.54948 14.2777 8.1361 14.2515L8.04118 15.7485ZM2.75 8.50661C2.75 5.32733 5.32736 2.75 8.50664 2.75V1.25C4.49895 1.25 1.25 4.49889 1.25 8.50661H2.75ZM8.50664 2.75C11.561 2.75 14.0604 5.12926 14.2515 8.13498L15.7485 8.03979C15.5074 4.24925 12.3576 1.25 8.50664 1.25V2.75ZM8.1361 14.2515C5.12986 14.0609 2.75 11.5614 2.75 8.50661H1.25C1.25 12.358 4.25002 15.5081 8.04118 15.7485L8.1361 14.2515Z" fill="currentColor"/>',
  font: '<path d="M14 19L11.1069 10.7479C9.76348 6.91597 9.09177 5 8 5C6.90823 5 6.23652 6.91597 4.89309 10.7479L2 19M4.5 12H11.5" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/><path d="M21.9692 13.9392V18.4392M21.9692 13.9392C22.0164 13.1161 22.0182 12.4891 21.9194 11.9773C21.6864 10.7709 20.4258 10.0439 19.206 9.89599C18.0385 9.75447 17.1015 10.055 16.1535 11.4363M21.9692 13.9392L19.1256 13.9392C18.6887 13.9392 18.2481 13.9603 17.8272 14.0773C15.2545 14.7925 15.4431 18.4003 18.0233 18.845C18.3099 18.8944 18.6025 18.9156 18.8927 18.9026C19.5703 18.8724 20.1955 18.545 20.7321 18.1301C21.3605 17.644 21.9692 16.9655 21.9692 15.9392V13.9392Z" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>',
  layers: '<path d="M8.64298 3.14559L6.93816 3.93362C4.31272 5.14719 3 5.75397 3 6.75C3 7.74603 4.31272 8.35281 6.93817 9.56638L8.64298 10.3544C10.2952 11.1181 11.1214 11.5 12 11.5C12.8786 11.5 13.7048 11.1181 15.357 10.3544L17.0618 9.56638C19.6873 8.35281 21 7.74603 21 6.75C21 5.75397 19.6873 5.14719 17.0618 3.93362L15.357 3.14559C13.7048 2.38186 12.8786 2 12 2C11.1214 2 10.2952 2.38186 8.64298 3.14559Z" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/><path d="M20.788 11.0972C20.9293 11.2959 21 11.5031 21 11.7309C21 12.7127 19.6873 13.3109 17.0618 14.5072L15.357 15.284C13.7048 16.0368 12.8786 16.4133 12 16.4133C11.1214 16.4133 10.2952 16.0368 8.64298 15.284L6.93817 14.5072C4.31272 13.3109 3 12.7127 3 11.7309C3 11.5031 3.07067 11.2959 3.212 11.0972" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/><path d="M20.3767 16.2661C20.7922 16.5971 21 16.927 21 17.3176C21 18.2995 19.6873 18.8976 17.0618 20.0939L15.357 20.8707C13.7048 21.6236 12.8786 22 12 22C11.1214 22 10.2952 21.6236 8.64298 20.8707L6.93817 20.0939C4.31272 18.8976 3 18.2995 3 17.3176C3 16.927 3.20778 16.5971 3.62334 16.2661" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>',
  bell: '<path d="M20 18.5011L18.349 7.93407C17.8603 4.80601 15.166 2.5 12 2.5C8.83398 2.5 6.13971 4.80601 5.65098 7.93407L4 18.5011" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/><path d="M20 18.5C20 16.8431 16.4183 15.5 12 15.5C7.58172 15.5 4 16.8431 4 18.5C4 20.1569 7.58172 21.5 12 21.5C16.4183 21.5 20 20.1569 20 18.5Z" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/><path d="M13 18.5H11" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>',
};

export const DEFAULTS = {
  /** 初始展开的分组下标（数字或数组；-1 = 都不展开） */
  defaultOpen: 0,
  /** 文字色 / 强调色 / 线色：CSS 颜色或 token 引用；null = 取 components.css 缺省（token） */
  color: null,
  accentColor: null,
  lineColor: null,
  width: 240,
  rowHeight: 36,
  indent: 40,
  trunk: 14,
  radius: 10,
  lineWidth: 1.5,
  fontSize: 14,
  drawDuration: 400,
  foldDuration: 300,
  className: "",
};

const PAD = 6;
const MARK = 16;
const SVG_NS = "http://www.w3.org/2000/svg";

function toSet(open) {
  return new Set(Array.isArray(open) ? open : open >= 0 ? [open] : []);
}

function renderIcon(icon, size = 16) {
  if (icon instanceof Node) return icon;
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke-width", "1.8");
  svg.setAttribute("aria-hidden", "true");
  const markup = typeof icon === "string" && icon.trim().startsWith("<") ? icon : ICONS[icon] || "";
  if (/^\s*<svg/i.test(markup)) {
    const holder = document.createElement("div");
    holder.innerHTML = markup;
    return holder.firstElementChild || svg;
  }
  svg.innerHTML = markup;
  return svg;
}

/**
 * 挂载 Branched Menu。
 * @param {Element} container
 * @param {{ sections?: Array<{ label: string, value?: string, icon?: string|Node, items?: Array<{ label: string, value: string, icon?: string|Node }> }>, value?: string, onSelect?: (value: string, item: object) => void, onToggle?: (index: number, open: boolean) => void } & Partial<typeof DEFAULTS>} [options]
 * @returns {{ set(value: string): void, toggle(index: number, open?: boolean): void, destroy(): void }}
 */
export function mountBranchedMenu(container, options = {}) {
  if (typeof document === "undefined" || !container) return { set() {}, toggle() {}, destroy() {} };
  const o = { ...DEFAULTS, ...options };
  const sections = o.sections || [];
  const open = toSet(o.defaultOpen);
  let active = o.value ?? "";
  if (!active) {
    const first = sections.find((s, i) => s.items && open.has(i));
    active = first?.items?.[0]?.value ?? "";
  }
  let onSelect = o.onSelect;
  let onToggle = o.onToggle;

  const nav = document.createElement("nav");
  nav.className = `branched-menu${o.className ? " " + o.className : ""}`;
  const set = (name, v) => nav.style.setProperty(name, v);
  set("--bm-w", `${o.width}px`);
  if (o.color) set("--bm-ink", o.color);
  if (o.accentColor) set("--bm-accent", o.accentColor);
  if (o.lineColor) set("--bm-line", o.lineColor);
  set("--bm-font", `${o.fontSize}px`);
  set("--bm-row", `${o.rowHeight}px`);
  set("--bm-indent", `${o.indent}px`);
  set("--bm-line-w", String(o.lineWidth));
  set("--bm-draw", `${o.drawDuration}ms`);
  set("--bm-fold", `${o.foldDuration}ms`);

  const marker = document.createElement("span");
  marker.className = "branched-menu__marker";
  marker.setAttribute("aria-hidden", "true");
  nav.append(marker);

  const r = Math.min(o.radius, o.rowHeight / 2 - 2);
  const endX = o.indent - 8;
  const rowY = (k) => PAD + k * o.rowHeight + o.rowHeight / 2;
  const branch = (k) => `M ${o.trunk} ${rowY(k) - r} A ${r} ${r} 0 0 0 ${o.trunk + r} ${rowY(k)} H ${endX}`;
  const reach = (k) => `M ${o.trunk} 0 V ${rowY(k) - r} A ${r} ${r} 0 0 0 ${o.trunk + r} ${rowY(k)} H ${endX}`;
  const length = (k) => rowY(k) - r + (Math.PI * r) / 2 + (endX - o.trunk - r);

  const secEls = []; // { section, root, head, items: [{ item, btn, reach, len }] }
  sections.forEach((section, i) => {
    const kids = section.items;
    const root = document.createElement("div");
    root.className = "branched-menu__section";
    const head = document.createElement("button");
    head.type = "button";
    head.className = "branched-menu__head";
    if (section.icon) {
      const ic = document.createElement("span");
      ic.className = "branched-menu__icon";
      ic.setAttribute("aria-hidden", "true");
      ic.append(renderIcon(section.icon));
      head.append(ic);
    }
    const text = document.createElement("span");
    text.textContent = section.label;
    head.append(text);
    root.append(head);
    const entry = { section, root, head, items: [] };

    if (kids) {
      head.addEventListener("click", () => toggle(i));
      const bodyH = PAD * 2 + kids.length * o.rowHeight;
      const body = document.createElement("div");
      body.className = "branched-menu__body";
      const fold = document.createElement("div");
      fold.className = "branched-menu__fold";
      const tree = document.createElement("div");
      tree.className = "branched-menu__tree";
      tree.style.height = `${bodyH}px`;
      const svg = document.createElementNS(SVG_NS, "svg");
      svg.setAttribute("class", "branched-menu__lines");
      svg.setAttribute("width", String(o.indent));
      svg.setAttribute("height", String(bodyH));
      svg.setAttribute("aria-hidden", "true");
      const mk = (cls, d) => {
        const p = document.createElementNS(SVG_NS, "path");
        p.setAttribute("class", cls);
        p.setAttribute("d", d);
        svg.append(p);
        return p;
      };
      if (kids.length) mk("branched-menu__base", `M ${o.trunk} 0 V ${rowY(kids.length - 1) - r}`);
      kids.forEach((_, k) => mk("branched-menu__base", branch(k)));
      const reaches = kids.map((_, k) => {
        const p = mk("branched-menu__reach", reach(k));
        p.style.strokeDasharray = String(length(k));
        return p;
      });
      tree.append(svg);
      kids.forEach((kid, k) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "branched-menu__item";
        if (kid.icon) {
          const ic = document.createElement("span");
          ic.className = "branched-menu__icon";
          ic.setAttribute("aria-hidden", "true");
          ic.append(renderIcon(kid.icon));
          btn.append(ic);
        }
        const label = document.createElement("span");
        label.className = "branched-menu__label";
        label.textContent = kid.label;
        btn.append(label);
        btn.addEventListener("click", () => select(kid.value, kid));
        tree.append(btn);
        entry.items.push({ item: kid, btn, reach: reaches[k], len: length(k) });
      });
      fold.append(tree);
      body.append(fold);
      root.append(body);
    } else {
      head.addEventListener("click", () => select(section.value ?? section.label, section));
    }
    nav.append(root);
    secEls.push(entry);
  });

  function activeSection() {
    return sections.findIndex((s) => s.items?.some((kid) => kid.value === active));
  }

  function placeMarker(glide) {
    const idx = activeSection();
    const el = secEls[idx]?.head;
    const on = idx >= 0 && open.has(idx) && el;
    if (!glide) marker.style.transition = "none";
    if (on) marker.style.top = `${el.offsetTop + (el.offsetHeight - MARK) / 2}px`;
    marker.toggleAttribute("data-on", Boolean(on));
    if (!glide) {
      void marker.offsetHeight;
      marker.style.transition = "";
    }
  }

  function render() {
    secEls.forEach((e, i) => {
      const kids = e.section.items;
      const isOpen = kids ? open.has(i) : false;
      e.root.toggleAttribute("data-open", isOpen);
      if (kids) e.head.setAttribute("aria-expanded", String(isOpen));
      else {
        const leafActive = (e.section.value ?? e.section.label) === active;
        e.head.toggleAttribute("data-active", leafActive);
        if (leafActive) e.head.setAttribute("aria-current", "true");
        else e.head.removeAttribute("aria-current");
      }
      for (const it of e.items) {
        const on = it.item.value === active;
        it.btn.toggleAttribute("data-active", on);
        if (on) it.btn.setAttribute("aria-current", "true");
        else it.btn.removeAttribute("aria-current");
        it.btn.tabIndex = isOpen ? 0 : -1;
        it.reach.style.strokeDashoffset = on ? "0" : String(it.len);
      }
    });
    placeMarker(true);
  }

  function select(value, item) {
    active = value;
    render();
    onSelect?.(value, item);
  }
  function toggle(i, force) {
    if (!sections[i]?.items) return;
    const next = force === undefined ? !open.has(i) : Boolean(force);
    if (next === open.has(i)) return;
    if (next) open.add(i);
    else open.delete(i);
    render();
    onToggle?.(i, next);
  }

  container.append(nav);
  render();
  placeMarker(false);
  let ro = null;
  if (typeof ResizeObserver === "function") {
    let first = true;
    ro = new ResizeObserver(() => {
      if (first) {
        first = false;
        return;
      }
      placeMarker(false);
    });
    ro.observe(nav);
  }

  return {
    /** 程序化选中（并展开所在分组），不触发 onSelect */
    set(value) {
      active = value;
      const idx = activeSection();
      if (idx >= 0) open.add(idx);
      render();
    },
    toggle,
    destroy() {
      ro?.disconnect();
      nav.remove();
      onSelect = onToggle = undefined;
    },
  };
}
