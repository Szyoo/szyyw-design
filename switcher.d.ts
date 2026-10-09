/** 切换器在右上角工具位里的位次（比明暗切换 10 更靠左） */
export const SWITCHER_ORDER: number;

import type { SwitcherText } from "./chrome-text";
export type { SwitcherText };

export interface AppSwitcherHandle {
  open(): void;
  close(): void;
  /** 强制重新拉取列表（绕过缓存） */
  refresh(): Promise<void>;
  /** v0.13.0：换语言（按钮提示 + 面板就地重画，不重新拉列表）；labels 覆盖保留 */
  setLocale(locale: string): void;
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
  /** v0.13.0：内置文案语言 "zh" | "ja" | "en"（"ja-JP" 也认），缺省 "zh"（与旧版逐字相同） */
  locale?: string;
  /** 逐键覆盖内置文案 */
  labels?: Partial<SwitcherText>;
}): AppSwitcherHandle;

export { mountAccountMenu, ACCOUNT_ORDER } from "./account";
export type { AccountMenuHandle, PortalMe, PortalLoginMessage } from "./account";
