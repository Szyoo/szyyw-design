#!/usr/bin/env node
/* ============================================================
   scripts/build-corner-css.mjs —— 从 components.css 生成 corner.css（开发用，不进 package files）。

   corner.css = 只有右上角工具位及其弹层的样式，给有自己样式体系、不加载 components.css 的应用
   （claude-bridge）单独挂工具位用（配 tokens.css）。它**不含**任何元素级 / 全局规则。

   来源（单一真相仍是 components.css，本脚本只做摘取与改写）：
   1. 「@corner:begin」到「@corner:end」之间的段落 —— 原样照抄
   2. 弹层里用到的公开类与表单元素规则（.glass / .btn / .chip / .switch / input[type=range] / label …）——
      逐条改写成只在工具位与弹层内部生效：选择器前加 :where(.corner-tools, .corner-panel)，
      :where() 的特异性为 0，所以层叠结果与 components.css 下完全一致
   3. 上面用到的 @keyframes（按 animation 名自动收集）
   另在文件头加一小段「独立挂载基底」（字体 / 字色 / 链接）：components.css 里这些由 body / a 提供，
   这里只作用于工具位与弹层自身——不能写进 components.css，否则会盖掉应用自己改过的 body 字体。

   用法：
     node scripts/build-corner-css.mjs           重新生成 corner.css
     node scripts/build-corner-css.mjs --check   只检查 corner.css 是否与 components.css 同步（过期退出码 1）
   ============================================================ */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(root, "components.css");
const OUT = join(root, "corner.css");
const check = process.argv.includes("--check");

const SCOPE = ":where(.corner-tools, .corner-panel)";

/** 弹层内部用到的公开类 / 元素规则：规则的每个选择器都以这些「头」开头才摘取 */
const DEP_HEADS = [
  ".glass",
  ".btn",
  ".btn-ghost",
  ".btn-small",
  ".chip",
  ".chip-row",
  ".pill",
  ".panel-head",
  ".panel-title",
  ".close-x",
  ".divider",
  ".err-text",
  ".num",
  ".switch",
  "label",
  'input[type="range"]',
  'input[type="color"]'
];
/** 这些类挂在弹层自身（glass corner-panel），除了「弹层内部」还要匹配弹层本身 */
const SELF_HEADS = new Set([".glass"]);

const css = readFileSync(SRC, "utf8");

/* ---------- 极简 CSS 扫描：顶层条目（规则 / @块），保留原文位置 ---------- */

function scanTopLevel(text) {
  const items = [];
  let i = 0;
  let start = 0;
  const n = text.length;
  while (i < n) {
    const c = text[i];
    if (c === "/" && text[i + 1] === "*") {
      const end = text.indexOf("*/", i + 2);
      i = end < 0 ? n : end + 2;
      if (text.slice(start, i).trim().startsWith("/*")) start = i; // 顶层注释不并入下一条规则的选择器
      continue;
    }
    if (c === '"' || c === "'") {
      i = skipString(text, i);
      continue;
    }
    if (c === "{") {
      const close = matchBrace(text, i);
      items.push({ start, prelude: text.slice(start, i).replace(/\/\*[\s\S]*?\*\//g, "").trim(), body: text.slice(i + 1, close), end: close + 1 });
      i = close + 1;
      start = i;
      continue;
    }
    if (c === "}" || c === ";") {
      i++;
      start = i;
      continue;
    }
    if (/\s/.test(c) && text.slice(start, i).trim() === "") start = i + 1;
    i++;
  }
  return items;
}

function skipString(text, i) {
  const q = text[i];
  i++;
  while (i < text.length && text[i] !== q) i += text[i] === "\\" ? 2 : 1;
  return i + 1;
}

function matchBrace(text, open) {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    const c = text[i];
    if (c === "/" && text[i + 1] === "*") {
      i = text.indexOf("*/", i + 2) + 1;
      continue;
    }
    if (c === '"' || c === "'") {
      i = skipString(text, i) - 1;
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return i;
  }
  throw new Error(`components.css: 第 ${open} 字符处的 { 没有配对`);
}

/** 按顶层逗号拆选择器（不拆 :where(a, b) / :not(…) / [attr="a,b"] 里的逗号） */
function splitSelectors(prelude) {
  const out = [];
  let depth = 0;
  let cur = "";
  for (let i = 0; i < prelude.length; i++) {
    const c = prelude[i];
    if (c === '"' || c === "'") {
      const j = skipString(prelude, i);
      cur += prelude.slice(i, j);
      i = j - 1;
      continue;
    }
    if (c === "(" || c === "[") depth++;
    else if (c === ")" || c === "]") depth--;
    if (c === "," && depth === 0) {
      out.push(cur.trim());
      cur = "";
    } else cur += c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

const headOf = (sel) => DEP_HEADS.find((h) => sel.startsWith(h) && !/[\w-]/.test(sel[h.length] ?? ""));

/* ---------- 摘取 ---------- */

const BEGIN = "/* @corner:begin";
const END = "/* @corner:end */";
const regions = [];
for (let from = 0; ; ) {
  const b = css.indexOf(BEGIN, from);
  if (b < 0) break;
  const e = css.indexOf(END, b);
  if (e < 0) throw new Error("components.css: @corner:begin 没有对应的 @corner:end");
  regions.push([b, e + END.length]);
  from = e + END.length;
}
if (!regions.length) throw new Error("components.css 里没有 @corner:begin / @corner:end 标记");
const inRegion = (pos) => regions.some(([b, e]) => pos >= b && pos < e);

const items = scanTopLevel(css);
const pieces = []; // { pos, text }

for (const [b, e] of regions) {
  // 去掉开头标记行本身（它的说明是给 components.css 读者看的）
  let text = css.slice(b, e);
  text = text.replace(/^\/\* @corner:begin[\s\S]*?\*\/\s*/, "").replace(/\s*\/\* @corner:end \*\/$/, "");
  pieces.push({ pos: b, text: text.trim() });
}

let depCount = 0;
for (const it of items) {
  if (inRegion(it.start) || it.prelude.startsWith("@")) continue;
  const sels = splitSelectors(it.prelude);
  if (!sels.length || !sels.every((s) => headOf(s))) continue;
  const scoped = [];
  for (const s of sels) {
    scoped.push(`${SCOPE} ${s}`);
    if (SELF_HEADS.has(s)) scoped.push(`${s}:where(.corner-panel)`);
  }
  const body = it.body.replace(/^\n?/, "\n").replace(/\s*$/, "\n");
  pieces.push({ pos: it.start, text: `${scoped.join(",\n")} {${body}}` });
  depCount++;
}

pieces.sort((a, b) => a.pos - b.pos);
let output = pieces.map((p) => p.text).join("\n\n");

// 用到的 @keyframes：照 animation / animation-name 里出现的名字收集
const keyframes = new Map();
for (const it of items) {
  const m = /^@keyframes\s+([\w-]+)/.exec(it.prelude);
  if (m) keyframes.set(m[1], css.slice(it.start, it.end).trim());
}
const used = new Set();
for (const m of output.matchAll(/animation(?:-name)?\s*:\s*([^;}]+)/g)) {
  for (const word of m[1].split(/[\s,]+/)) if (keyframes.has(word)) used.add(word);
}
const ownKeyframes = new Set([...output.matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => m[1]));
const extraKeyframes = [...used].filter((k) => !ownKeyframes.has(k)).map((k) => keyframes.get(k));

const HEADER = `/* ============================================================
   @szyyw/design · corner.css —— 由 scripts/build-corner-css.mjs 从 components.css 生成，不要手改。
   只含右上角工具位及其弹层（.corner-tools / .corner-tool / .corner-badge / .corner-panel /
   .corner-clear / 明暗 / 外观 / 背景参数 / 应用切换器 / 账户菜单 / 语言切换），
   不含任何元素级 / 全局规则（*、html、body、a、button…），给不加载 components.css 的应用
   （自有样式体系，如 claude-bridge）单独挂工具位：<link> tokens.css + corner.css 即可。
   与 components.css 二选一；同时加载也无害（规则相同、特异性相同）。
   ============================================================ */

/* 独立挂载基底：components.css 里由 body / a 提供；这里只作用于工具位与弹层自身 */
${SCOPE} {
  font-family: 'Inter', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', system-ui, sans-serif;
  font-size: 15px;
  line-height: 1.6;
  color: var(--text);
  -webkit-tap-highlight-color: transparent;
}
${SCOPE} a {
  color: inherit;
  text-decoration: none;
}
`;

output = `${HEADER}\n${output}\n${extraKeyframes.length ? `\n/* ---------- 用到的动效 ---------- */\n\n${extraKeyframes.join("\n\n")}\n` : ""}`;

// 自检：不得出现元素级 / 全局选择器开头的顶层规则
const BANNED = /^(\*|html|body|a|button|input|select|textarea|label|code|table|h[1-6]|p|ul|ol)(?=$|[\s>+~:,[])/;
for (const it of scanTopLevel(output)) {
  if (it.prelude.startsWith("@")) continue;
  for (const s of splitSelectors(it.prelude)) {
    if (BANNED.test(s)) {
      console.error(`build-corner-css: 产物里出现全局规则「${s}」——检查 @corner 段落`);
      process.exit(1);
    }
  }
}

if (check) {
  const current = existsSync(OUT) ? readFileSync(OUT, "utf8") : "";
  if (current !== output) {
    console.error("build-corner-css --check: corner.css 与 components.css 不同步——跑 node scripts/build-corner-css.mjs");
    process.exit(1);
  }
  console.log(`build-corner-css --check: corner.css 已同步（${regions.length} 段原样 + ${depCount} 条改写 + ${extraKeyframes.length} 个 keyframes）`);
} else {
  writeFileSync(OUT, output);
  console.log(`build-corner-css: 写入 corner.css（${regions.length} 段原样 + ${depCount} 条改写 + ${extraKeyframes.length} 个 keyframes，${output.length} 字节）`);
}
