export type Scheme = "auto" | "light" | "dark";

export interface SchemeConfig {
  /** SSR 项目必须用 cookie（服务端要读它避免首屏闪烁） */
  persist?: "cookie" | "localStorage" | "none";
  storageKey?: string;
  cookieDays?: number;
  /** 同步 <meta name="theme-color"> */
  themeColor?: boolean;
}

export interface SchemeToggleHandle {
  destroy(): void;
  update(): void;
}

export function getScheme(): Scheme;
export function setScheme(next: Scheme, options?: { persist?: boolean }): Scheme;
/**
 * 按当前实际底色重算 <meta name="theme-color">（读 body 的 computed backgroundColor）。
 * setScheme 已自动调用；换配色等其它改 --bg 的操作后手动调一次。configureScheme({ themeColor: false }) 时 no-op
 */
export function refreshThemeColor(): void;
/** auto → light → dark → auto */
export function cycleScheme(): Scheme;
/** 配置持久化并对齐初始状态；返回当前模式。重复调用不会叠加系统监听 */
export function configureScheme(options?: SchemeConfig): Scheme;
/** 解绑系统明暗监听（SPA 卸载时用） */
export function destroyScheme(): void;
/** 订阅变化，返回解绑函数 */
export function onSchemeChange(handler: (scheme: Scheme) => void): () => void;
/** 挂载常驻切换按钮（缺省进右上角工具位；给了 container 就挂到那里） */
export function mountSchemeToggle(options?: {
  container?: HTMLElement | null;
  /** 覆盖个别文案；与 locale 都不传时是英文缺省 */
  labels?: Partial<Record<Scheme, string>> | null;
  /** v0.12.0：用内置 zh / ja / en 文案 */
  locale?: string | null;
}): SchemeToggleHandle;
