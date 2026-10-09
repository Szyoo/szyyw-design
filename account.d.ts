/** 账户菜单在右上角工具位里的位次（切换器 5 右边、明暗切换 10 左边） */
export const ACCOUNT_ORDER: number;

import type { AccountLabels } from "./chrome-text";
export type { AccountLabels };

/** portal `/api/me` 的 200 响应 */
export interface PortalMe {
  id: string | number;
  user: string;
  role: "admin" | "user" | "guest" | (string & {});
}

/** 登录小窗 postMessage 回来的数据（至少带 type） */
export interface PortalLoginMessage {
  type: "szyyw-portal:login";
  [key: string]: unknown;
}

export interface AccountMenuHandle {
  /** 重新拉一次 /api/me 并重绘 */
  refresh(): Promise<void>;
  /** 关闭面板（若开着） */
  close(): void;
  /** v0.13.0：换语言（就地重画按钮 / 面板，开着的面板会关上；不重新请求 /api/me）；labels 覆盖保留 */
  setLocale(locale: string): void;
  destroy(): void;
  /** 当前身份；未登录/未知为 null */
  readonly me: PortalMe | null;
}

/**
 * 挂载账户菜单：未登录显示「登录」（弹 portal 登录小窗，被拦则整页跳转），
 * 登录后显示首字头像，点开有用户名、角色、账户设置、登出。
 */
export function mountAccountMenu(options?: {
  /** 门户地址。缺省 https://szyyw.xyz */
  portal?: string;
  /** 工具位位次。缺省 6 */
  order?: number;
  /** 登录小窗回报成功时调用，随后页面 reload */
  onChange?: (data: PortalLoginMessage) => void;
  /** v0.13.0：内置文案语言 "zh" | "ja" | "en"，缺省 "zh"（与旧版逐字相同） */
  locale?: string;
  /** 逐键覆盖内置文案；roles 逐个合并（admin / user 本地化，未知角色原样显示） */
  labels?: AccountLabels;
}): AccountMenuHandle;
