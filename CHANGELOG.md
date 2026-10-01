# Changelog

## v0.7.0 — 2026-10-01

- 新增 `switcher.js` / `mountAppSwitcher()`：右上角工具位最左的「九宫格」应用切换器，列表来自 portal `/api/apps`，含「回到门户」；高亮当前站点，Esc / 点击外部关闭，60s 缓存。
- 新增 `sync.sh`：vendoring 的唯一来源。`sh sync.sh <dest> [tag|--local]`，写 `VENDORED.md`。各项目原有的 `update-design.sh` 应改为调用它。
- `components.css` 新增 `.app-switcher*` 样式。
- 新增本文件。

## v0.6.2 及更早

按 tag 看提交说明：v0.1.0 tokens + 玻璃层 + DotField → v0.1.1 光晕渐变修复 → v0.2.0 主题→配色→明暗三层 → v0.3.0 明暗模式模块 → v0.4.0 背景参数面板 + 右上角工具位 → v0.5.0 面板内版本检测 → v0.6.x React Bits 接入与 DotField 出处补记。
