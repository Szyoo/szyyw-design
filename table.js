/* ============================================================
   @szyyw/design · table.js（v0.30.0）
   可排序表头：点 th[aria-sort] > button.th-sort 在 升序 ↔ 降序 间切换（首次点按 firstDirection），
   同步各列 aria-sort（其余列回到 "none"）；缺省同时把 tbody 的行按该列重新排（数字 / 日期感知、空值垫底），
   数据由应用自己排（服务端分页、React 状态）时传 sort: false，只用 onSort 回调。
   框架无关；模块顶层不碰 DOM（SSR 可 import）。

     <th aria-sort="none" class="col-num"><button type="button" class="th-sort">金额</button></th>
     <td class="col-num" data-sort="12480">¥12,480</td>      ← data-sort 优先于单元格文字

     import { enhanceSortTable } from "@szyyw/design/table";
     const t = enhanceSortTable(table, { onSort: ({ index, direction }) => … });   // → { sortBy(index, dir), state, destroy() }

   React / Vue 管理行时务必 sort: false（本模块挪动 DOM 行会和框架的节点表打架）。
   tr.empty-row、tr.total 不参与排序、留在原位置之后。
   ============================================================ */

const registry = new WeakMap();
const collator = typeof Intl !== "undefined" ? new Intl.Collator(undefined, { numeric: true, sensitivity: "base" }) : null;

function cellValue(cell) {
  if (!cell) return "";
  const raw = cell.getAttribute("data-sort") ?? cell.textContent ?? "";
  return raw.trim();
}

/** 能当数字比的就当数字（去掉千分位、货币符号、%） */
function asNumber(s) {
  if (s === "") return null;
  const t = s.replace(/[,\s¥$€£円%]/g, "").replace(/^\+/, "").replace(/^−/, "-");
  if (!/^-?\d+(\.\d+)?$/.test(t)) return null;
  return Number(t);
}

function compare(a, b) {
  if (a === b) return 0;
  if (a === "") return 1;
  if (b === "") return -1;
  const na = asNumber(a);
  const nb = asNumber(b);
  if (na !== null && nb !== null) return na - nb;
  return collator ? collator.compare(a, b) : a < b ? -1 : 1;
}

/**
 * @param {HTMLTableElement} table
 * @param {{ sort?: boolean, firstDirection?: "ascending" | "descending",
 *           onSort?: (s: { index: number, direction: "ascending" | "descending", th: HTMLTableCellElement }) => void }} [options]
 */
export function enhanceSortTable(table, options = {}) {
  const noop = { sortBy() {}, get state() { return null; }, destroy() {} };
  if (typeof document === "undefined" || !table) return noop;
  const existing = registry.get(table);
  if (existing) return existing;

  const { sort = true, firstDirection = "ascending", onSort } = options;
  const headRow = () => table.tHead?.rows[0] || null;
  let state = null;

  function sortRows(index, direction) {
    for (const body of table.tBodies) {
      const rows = [...body.rows];
      const movable = rows.filter((r) => !r.classList.contains("empty-row") && !r.classList.contains("total"));
      const fixed = rows.filter((r) => !movable.includes(r));
      const sign = direction === "descending" ? -1 : 1;
      movable
        .map((r, i) => ({ r, i, v: cellValue(r.cells[index]) }))
        .sort((x, y) => {
          // 空值无论升降都垫底；同值保持原顺序（稳定）
          if (x.v === "" && y.v !== "") return 1;
          if (y.v === "" && x.v !== "") return -1;
          return compare(x.v, y.v) * sign || x.i - y.i;
        })
        .forEach(({ r }) => body.append(r));
      fixed.forEach((r) => body.append(r));
    }
  }

  function sortBy(index, direction, emit = true) {
    const row = headRow();
    if (!row) return;
    const th = row.cells[index];
    if (!th) return;
    for (const c of row.cells) if (c.hasAttribute("aria-sort")) c.setAttribute("aria-sort", c === th ? direction : "none");
    state = { index, direction, th };
    if (sort) sortRows(index, direction);
    if (emit) onSort?.(state);
  }

  const onClick = (e) => {
    const btn = e.target instanceof Element ? e.target.closest(".th-sort") : null;
    if (!btn || !table.contains(btn) || btn.disabled) return;
    const th = btn.closest("th");
    if (!th || !th.hasAttribute("aria-sort")) return;
    const cur = th.getAttribute("aria-sort");
    const next = cur === "ascending" ? "descending" : cur === "descending" ? "ascending" : firstDirection;
    sortBy(th.cellIndex, next);
  };
  table.addEventListener("click", onClick);

  // 初始就带了 ascending / descending 的列：只记状态，不重排（服务端已排好）
  const pre = headRow() && [...headRow().cells].find((c) => /^(a|de)scending$/.test(c.getAttribute("aria-sort") || ""));
  if (pre) state = { index: pre.cellIndex, direction: pre.getAttribute("aria-sort"), th: pre };

  const handle = {
    sortBy: (index, direction = firstDirection) => sortBy(index, direction),
    get state() { return state; },
    destroy() {
      table.removeEventListener("click", onClick);
      registry.delete(table);
    }
  };
  registry.set(table, handle);
  return handle;
}
