# szyyw.xyz 设计语言

适用范围：portal（szyyw.xyz）、jppost-tracker、finance-ledger 及后续所有个人项目。
本仓库是唯一权威来源——改设计先改这里，再升 tag，各项目升级依赖。

## 1. 气质

深空。安静的底色上浮着毛玻璃层，青紫渐变只做点缀不做主角。
信息密度可以高，但视觉噪音必须低：细边框、低饱和、克制的动效。
所有动效使用同一条缓动曲线 `--ease: cubic-bezier(0.22, 1, 0.36, 1)`——快出慢停，有弹性但不弹跳。

## 2. 两条轴：主题 × 明暗

- **主题（palette）**：`html[data-theme]`，缺省 `nebula`（深空青紫）。备选 `aurora`（极光翠青）。
  新主题只需覆盖 hue 相关 token（accent/bg/tint/df-*），结构 token 不动。
- **明暗（scheme）**：`html[data-scheme]`，`dark`（缺省）/ `light` / `auto`（跟随系统）。
  实现：token 全部用 `light-dark()` 双值书写，scheme 只切换根节点的 `color-scheme`。
  auto = `color-scheme: light dark`，由系统决定取哪套，无需 JS 参与。

规则：**组件层禁止硬编码颜色**。透明度派生用 `color-mix(in srgb, var(--x) N%, transparent)`，
新颜色一律先进 tokens.css。

## 3. 层级模型

```
z-index 0   .bg-layer   点阵背景（fixed，独立合成层）
z-index 1   .app-frame  内容层
z-index 30  侧栏 / 顶栏（sticky/fixed + backdrop-blur）
z-index 40  底部导航
z-index 50  .overlay    弹层遮罩（Portal 挂 body，避开 transform 包含块陷阱）
```

玻璃三级：`--glass-bg`（卡片）→ `--inner-bg`（卡内嵌套）→ `--field-bg`（输入件）。
弹层用更实的 `--sheet-bg`（92% 不透明），保证叠在任何内容上都可读。

## 4. DotField 点阵背景

参数缺省值（两个项目实测的平衡点）：

| 参数 | 值 | 说明 |
|---|---|---|
| dotRadius / dotSpacing | 1.6 / 16 | 手机自动放大间距 1.5× |
| cursorRadius / cursorForce | 420 / 0.12 | 只对 `pointer: fine` 开启 |
| waveAmplitude | 2.5 | 全场缓波 |
| sparkle | on | 每帧 ~3% 的点放大 1.8×（伪随机哈希，无分配） |
| glow | on | SVG 径向“暗斑”跟随鼠标，按移动速度淡入（engagement 模型） |
| fps | 30 | 背景装饰不值 60fps 的电 |

工程要点（都是踩过的坑）：
- 颜色量化缓存（渐变 12 档 × 透明度 8 档），避免每帧上万次字符串分配
- 真实时间驱动相位，rAF 被节流后平滑续接，不跳变闪烁
- 只有宽度变化才重建点阵；iOS 软键盘/工具栏引起的纯高度抖动不重建
- 触摸滚动会触发 pointermove——指针扰动只对精确指针开启
- `prefers-reduced-motion` 时画一帧静态点阵，不进动画循环
- 取色自 `--df-from/--df-to/--df-glow`，主题/明暗切换自动换色（MutationObserver + matchMedia）

## 5. hover 光斑（.spot）

卡片 hover 时一团 accent 色的柔光跟随指针（radial-gradient at `--mx/--my`）。
`attachSpot()` 事件委托一次挂载，动态元素自动覆盖；触摸设备与 reduced-motion 下不启用。
与 `.lift`（上浮 + 描边）可叠加：`class="glass lift spot"`。

## 6. 字体与数字

- 正文 Inter + 中文回退（PingFang SC / Hiragino / 雅黑）；15px 基准
- 等宽 SF Mono / JetBrains Mono——终端窗、日志、代码
- **所有数字加 `.num`**（tabular-nums），金额列才对得齐
- 输入件字号 ≥16px：iOS 聚焦小于 16px 会触发页面缩放

## 7. 交互约定

- 破坏性操作：二次确认（首点变红「再点一次确认」+ 展开影响范围警告），
  桌面弹层底栏里破坏性按钮靠左隔离（`.sheet-foot .danger { margin-right: auto }`）
- 弹层：手机底部抽屉（sheet-up），桌面居中卡片（rise）；关闭 ✕ 恒在右上
- 动画终帧必须 `transform: none`——fill-mode 残留 transform 会困住子孙 fixed 弹层
- 空状态：居中 emoji + 一句引导文案（`.empty`）

## 8. 终端窗（日志回放）

刻意保持深色（真实终端的样子），浅色模式也不变——用独立的 `--term-*` token。
等宽字体、分级着色（debug 暗 / info 青 / warn 黄 / error 红）、按级别过滤、
自动跟随滚动（用户上翻时暂停）、复制按钮带「已复制」反馈。
