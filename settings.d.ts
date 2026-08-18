import type { DotFieldHandle, DotFieldOptions } from "./dotfield";

/** 面板里的一整套取值：行为参数 + 三个颜色 */
export interface DotFieldSettings extends DotFieldOptions {
  gradientFrom?: string;
  gradientTo?: string;
  glowColor?: string;
}

export interface DotFieldSettingsHandle {
  open(): void;
  close(): void;
  /** 手动触发一次强制检查（绕过缓存）；update: false 时是 no-op */
  checkUpdate(): Promise<void> | undefined;
  /** 外部改了参数后让面板跟上 */
  sync(): void;
  destroy(): void;
}

export interface UpdateResult {
  current: string;
  latest: string;
  hasUpdate: boolean;
  /** GitHub compare 页：v当前...v最新 */
  compareUrl: string;
}

/**
 * 查上游最新 tag 并与当前 VERSION 比对。
 * 匿名 GitHub API + localStorage 缓存（缺省 6h），force 绕过缓存。
 */
export function checkDesignUpdate(options?: {
  repo?: string;
  cacheHours?: number;
  force?: boolean;
  cacheKey?: string;
}): Promise<UpdateResult>;

export interface UpdateConfig {
  repo?: string;
  cacheHours?: number;
  /** 复制给用户的升级命令；vendored 项目传自己的 cp 流程 */
  command?: (latest: string) => string;
  /** 接了才显示真·一键更新按钮（消费方服务端完成更新）；抛错即算失败 */
  onUpdate?: (result: UpdateResult) => void | Promise<void>;
}

/**
 * 取回上次存的背景参数：颜色立刻写回 token，行为参数以对象返回。
 *
 *   const field = mountDotField(bg, restoreDotFieldSettings());
 */
export function restoreDotFieldSettings(options?: { storageKey?: string }): DotFieldOptions;

/** 挂载背景参数面板（齿轮进右上角工具位，排在明暗切换右边） */
export function mountDotFieldSettings(options: {
  field: DotFieldHandle;
  title?: string;
  /** 缺省 localStorage：改完即存，刷新还在 */
  persist?: "localStorage" | "none";
  storageKey?: string;
  /** 越大越靠右；缺省 20（明暗切换是 10） */
  order?: number;
  /** 传了才显示「保存」按钮（存服务端用）；抛错即算失败 */
  onSave?: (values: DotFieldSettings) => void | Promise<void>;
  /** 没有 onSave 时的页脚说明，如「访客模式 · 仅本地预览」 */
  note?: string;
  /** 版本检测；false 关闭 */
  update?: false | UpdateConfig;
  labels?: Partial<
    Record<
      | "open" | "close" | "reset" | "save" | "saving" | "saved" | "error"
      | "version" | "check" | "checking" | "upToDate" | "updateAvailable" | "viewChanges"
      | "copyCommand" | "copied" | "updateNow" | "updating" | "updated" | "updateFailed" | "checkFailed",
      string
    >
  >;
}): DotFieldSettingsHandle;
