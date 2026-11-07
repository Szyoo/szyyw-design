#!/usr/bin/env node
/* ============================================================
   scripts/build-icons.mjs —— 从 lucide-static 的 icons/ 目录生成 icons.js / icons.d.ts 里的图标数据段
   （开发用，不进 package files）。

   只收下面 NAMES 里的精选子集；SVG 内部标记原样照抄（24 视框、描边 currentColor、宽 2、圆端点由 icons.js 的外壳给）。
   icons.js 里「@icons:begin」到「@icons:end」之间、icons.d.ts 里「@icons:names」那一行由本脚本改写，其余手写。
   要加图标：把 Lucide 名字加进 NAMES（旧名写进 ALIASES），重跑本脚本，同步改 CHANGELOG。

   用法：
     npm pack lucide-static && tar xzf lucide-static-*.tgz
     node scripts/build-icons.mjs <解包目录>/package          重新生成
     node scripts/build-icons.mjs <解包目录>/package --check  只检查是否同步（过期退出码 1）
   ============================================================ */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const NAMES = [
  // 增减
  "x", "plus", "minus", "check",
  // 方向
  "chevron-left", "chevron-right", "chevron-up", "chevron-down", "chevrons-left", "chevrons-right",
  "arrow-left", "arrow-right", "arrow-up", "arrow-down", "arrow-up-right", "arrow-left-right", "arrow-down-right", "chevrons-up-down",
  // 操作
  "copy", "clipboard", "external-link", "link", "refresh-cw", "rotate-ccw", "search", "filter",
  "trash-2", "pencil", "save", "download", "upload", "share-2", "send",
  // 视图
  "zoom-in", "zoom-out", "maximize", "minimize", "maximize-2", "minimize-2", "scan", "eye", "eye-off",
  "menu", "ellipsis", "ellipsis-vertical", "grip-vertical", "settings", "sliders-horizontal",
  // 状态
  "info", "circle-help", "circle-alert", "triangle-alert", "circle-check", "circle-x", "loader", "loader-circle",
  // 对象
  "user", "users", "lock", "log-in", "log-out", "house", "calendar", "clock", "mail", "mic", "bell",
  "image", "file", "file-text", "folder", "star", "sun", "moon", "monitor",
  // v0.30.0：助手入口 / 计算 / 包裹 / 点按提示
  "sparkles", "calculator", "package", "pointer",
  // v0.30.0：天气（sun / moon 见上）
  "cloud", "cloud-sun", "cloud-moon", "cloud-rain", "cloud-drizzle", "cloud-snow", "cloud-lightning", "cloud-fog", "wind"
];

/** Lucide 旧名 → 现名（Lucide 改过名的常用图标，两种写法都认） */
const ALIASES = {
  "alert-triangle": "triangle-alert",
  "alert-circle": "circle-alert",
  "help-circle": "circle-help",
  "check-circle": "circle-check",
  "x-circle": "circle-x",
  "more-horizontal": "ellipsis",
  "more-vertical": "ellipsis-vertical",
  "home": "house"
};

const pkg = process.argv[2];
const check = process.argv.includes("--check");
if (!pkg || pkg.startsWith("--")) {
  console.error("usage: node scripts/build-icons.mjs <lucide-static package dir> [--check]");
  process.exit(2);
}
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const lucideVersion = JSON.parse(readFileSync(join(pkg, "package.json"), "utf8")).version;

function inner(name) {
  const svg = readFileSync(join(pkg, "icons", `${name}.svg`), "utf8");
  const body = svg.slice(svg.indexOf(">", svg.indexOf("<svg")) + 1, svg.lastIndexOf("</svg>"));
  return body.split("\n").map((l) => l.trim()).filter(Boolean).join("").replace(/\s*\/>/g, "/>");
}

const lines = [
  `// 由 scripts/build-icons.mjs 从 lucide-static v${lucideVersion} 生成，勿手改`,
  "const ICON_DATA = {",
  ...NAMES.map((n) => `  ${JSON.stringify(n)}: ${JSON.stringify(inner(n))},`),
  "};",
  `const ICON_ALIASES = ${JSON.stringify(ALIASES, null, 2).replace(/\n/g, "\n")};`,
  `export const LUCIDE_VERSION = ${JSON.stringify(lucideVersion)};`
];

const jsPath = join(root, "icons.js");
const js = readFileSync(jsPath, "utf8");
const nextJs = js.replace(/(\/\/ @icons:begin\n)[\s\S]*?(\/\/ @icons:end)/, `$1${lines.join("\n")}\n$2`);

const union = (list) => list.map((n) => JSON.stringify(n)).join(" | ");
const dtsPath = join(root, "icons.d.ts");
const dts = readFileSync(dtsPath, "utf8");
const nextDts = dts
  .replace(/^export type LucideIconName = .*; \/\/ @icons:names$/m, `export type LucideIconName = ${union(NAMES)}; // @icons:names`)
  .replace(/^export type LucideIconAlias = .*; \/\/ @icons:aliases$/m, `export type LucideIconAlias = ${union(Object.keys(ALIASES))}; // @icons:aliases`);

if (check) {
  const stale = [nextJs !== js && "icons.js", nextDts !== dts && "icons.d.ts"].filter(Boolean);
  if (stale.length) { console.error(`stale: ${stale.join(", ")} — rerun scripts/build-icons.mjs`); process.exit(1); }
  console.log(`icons up to date (${NAMES.length} icons, lucide-static v${lucideVersion})`);
} else {
  writeFileSync(jsPath, nextJs);
  writeFileSync(dtsPath, nextDts);
  console.log(`wrote ${NAMES.length} icons from lucide-static v${lucideVersion}`);
}
