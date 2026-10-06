#!/usr/bin/env node
/* ============================================================
   scripts/check-tokens.mjs —— appearance-data.js 与 tokens.css 的一致性护栏
   （开发用，不进 package files）。

   JS 没法 import CSS，配色的 --bg 两套值在两边各写了一份，靠这里断言：
   - PALETTES 里 id = "default" 的项 ↔ tokens.css 的 :root 主块
   - 其余每个 id ↔ :root[data-palette="<id>"] 块必须存在
   - 块内 --bg: light-dark(L, D) 与 bg.light / bg.dark 一致（不区分大小写）
   - 反向：tokens.css 里每个 data-palette 块都要在 PALETTES 里登记（否则面板选不到）
   - 每个配色的 theme 都在 THEMES 里

   用法：node scripts/check-tokens.mjs   （失败时退出码 1）
   ============================================================ */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { THEMES, PALETTES } from "../appearance-data.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const css = readFileSync(join(root, "tokens.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

/** selector（规范化空白）→ 声明体；同一 selector 出现多次时拼起来 */
const blocks = new Map();
for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
  const selector = m[1].trim().replace(/\s+/g, " ");
  blocks.set(selector, (blocks.get(selector) ?? "") + m[2]);
}

const BG_RE = /--bg\s*:\s*light-dark\(\s*(#[0-9a-fA-F]{3,8})\s*,\s*(#[0-9a-fA-F]{3,8})\s*\)/;
const errors = [];
const ok = [];

const selectorOf = (id) => (id === "default" ? ":root" : `:root[data-palette="${id}"]`);

for (const p of PALETTES) {
  if (!THEMES.some((t) => t.id === p.theme)) errors.push(`配色 ${p.id} 的 theme "${p.theme}" 不在 THEMES 里`);
  const sel = selectorOf(p.id);
  const body = blocks.get(sel);
  if (body === undefined) {
    errors.push(`tokens.css 缺少配色块 ${sel}（appearance-data.js 登记了 ${p.id}）`);
    continue;
  }
  const m = BG_RE.exec(body);
  if (!m) {
    errors.push(`${sel} 里没有 --bg: light-dark(#light, #dark)`);
    continue;
  }
  const [light, dark] = [m[1].toLowerCase(), m[2].toLowerCase()];
  if (light !== p.bg.light.toLowerCase() || dark !== p.bg.dark.toLowerCase()) {
    errors.push(
      `${p.id}: tokens.css --bg = light ${light} / dark ${dark}，appearance-data.js = light ${p.bg.light} / dark ${p.bg.dark}`
    );
    continue;
  }
  ok.push(`${p.id.padEnd(8)} ${sel.padEnd(28)} light ${light}  dark ${dark}`);
}

for (const sel of blocks.keys()) {
  const m = /^:root\[data-palette="([^"]+)"\]$/.exec(sel);
  if (m && !PALETTES.some((p) => p.id === m[1])) {
    errors.push(`tokens.css 有配色块 ${sel}，但 appearance-data.js 的 PALETTES 没登记 ${m[1]}`);
  }
}

for (const line of ok) console.log("ok   " + line);
if (errors.length) {
  for (const e of errors) console.error("FAIL " + e);
  console.error(`\ncheck-tokens: ${errors.length} 处不一致——改 tokens.css 配色块必须同步 appearance-data.js`);
  process.exit(1);
}
console.log(`\ncheck-tokens: ${PALETTES.length} 个配色与 tokens.css 一致`);
