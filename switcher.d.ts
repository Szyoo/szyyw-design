/** 切换器在右上角工具位里的位次（比明暗切换 10 更靠左） */
export const SWITCHER_ORDER: number;

export interface AppSwitcherHandle {
  open(): void;
  close(): void;
  /** 强制重新拉取列表（绕过缓存） */
  refresh(): Promise<void>;
  destroy(): void;
}

/**
 * 挂载应用切换器：右上角「九宫格」按钮，点开列出当前账号可进的站点 + 回到门户。
 * 列表来自 portal 的 `/api/apps`，由 portal 的权限矩阵决定。
 */
export function mountAppSwitcher(options?: {
  /** 门户地址，也是列表接口的来源。缺省 https://szyyw.xyz */
  portal?: string;
  /** 相对门户的列表接口。缺省 /api/apps */
  endpoint?: string;
  /** 工具位位次。缺省 5 */
  order?: number;
  /** 当前站点 host，用于高亮。缺省 location.host */
  current?: string;
  /** 列表缓存毫秒数。缺省 60000；0 = 每次打开都拉 */
  cacheMs?: number;
  labels?: Partial<Record<"open" | "portal" | "loading" | "empty" | "unauth" | "error", string>>;
}): AppSwitcherHandle;

export { mountAccountMenu, ACCOUNT_ORDER } from "./account";
export type { AccountMenuHandle, PortalMe, PortalLoginMessage } from "./account";
