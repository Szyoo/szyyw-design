# Changelog

## v0.8.0 — 2026-10-02

- 新增 `account.js` / `mountAccountMenu()`（导出路径 `./account`，`./switcher` 也转导出）：右上角工具位 order 6 的账户菜单。读 portal `/api/me`：未登录显示「登录」，弹 `/login?popup=1` 小窗（被拦则整页跳 `/login?rd=…`），只接受 portal 源的 `szyyw-portal:login` 消息 → `onChange` → reload；登录后显示首字圆形头像，面板含用户名 + 角色徽章 + 「账户设置」（`/?account=1`）+「登出」（`POST /api/logout`，失败面板内提示）。网络错误时不渲染，3s 后重试一次。
- `corner.js` 新增 `claimCornerPanel(close)`：工具位下方面板互斥，切换器与账户菜单同一时刻只开一个。
- `components.css` 新增 `.account-login` / `.account-avatar` / `.account-menu*` 样式。
- `sync.sh` 文件清单加入 `account.js`（现为 9 个运行时文件）。

## v0.7.0 — 2026-10-01

- 新增 `switcher.js` / `mountAppSwitcher()`：右上角工具位最左的「九宫格」应用切换器，列表来自 portal `/api/apps`，含「回到门户」；高亮当前站点，Esc / 点击外部关闭，60s 缓存。
- 新增 `sync.sh`：vendoring 的唯一来源。`sh sync.sh <dest> [tag|--local]`，写 `VENDORED.md`。各项目原有的 `update-design.sh` 应改为调用它。
- `components.css` 新增 `.app-switcher*` 样式。
- 新增本文件。

## v0.6.2 及更早

按 tag 看提交说明：v0.1.0 tokens + 玻璃层 + DotField → v0.1.1 光晕渐变修复 → v0.2.0 主题→配色→明暗三层 → v0.3.0 明暗模式模块 → v0.4.0 背景参数面板 + 右上角工具位 → v0.5.0 面板内版本检测 → v0.6.x React Bits 接入与 DotField 出处补记。
