export type ConfirmLocale = "zh" | "ja" | "en";

export interface ConfirmLabels {
  /** 对话框确认键缺省文案（「确定」） */
  confirm: string;
  /** 对话框取消键缺省文案（「取消」） */
  cancel: string;
  /** 按钮版上膛后的文案（「再点一次确认」） */
  armed: string;
  /** 无标题对话框的可访问名（「确认」） */
  dialog: string;
}

export declare const CONFIRM_TEXTS: Record<ConfirmLocale, ConfirmLabels>;

export type DisarmReason = "confirm" | "timeout" | "outside" | "escape" | "blur" | "manual" | "destroy";

export interface ArmConfirmOptions {
  /** 第二次点击时调用。不给时第二次点击照常冒泡（交给应用自己的点击委托） */
  onConfirm?: (event: MouseEvent) => void;
  /** 上膛后多久自动复原（ms），缺省 3000；0 = 不超时 */
  timeout?: number;
  /** 上膛后的文案，缺省 labels.armed；图标按钮只换 aria-label / title */
  label?: string;
  /** 缺省 "zh" */
  locale?: ConfirmLocale;
  labels?: Partial<ConfirmLabels>;
  /** 进入 .armed 时调用（可在这里展开影响范围提示） */
  onArm?: () => void;
  /** 复原时调用 */
  onDisarm?: (reason: DisarmReason) => void;
}

export interface ArmConfirmHandle {
  /** 当前是否处于上膛（.armed） */
  readonly armed: boolean;
  /** 立即复原 */
  disarm(): void;
  /** 复原并撤销监听（重复调用无害） */
  destroy(): void;
}

/**
 * v0.29.0：按钮的二次确认。第一次点 → .armed（变红、文字换成「再点一次确认」），再点执行；
 * 失焦 / 点别处 / Esc / 超时复原。适用于 .btn / .btn-ghost / .btn-icon / .menu-item。同一按钮再次调用会替换旧的。
 */
export function armConfirm(button: HTMLElement, options?: ArmConfirmOptions): ArmConfirmHandle;

export interface ConfirmInputOptions {
  /** 初始值 */
  value?: string;
  placeholder?: string;
  /** 缺省 "text" */
  type?: string;
  maxLength?: number;
  /** 输入框的可访问名，缺省用 title */
  label?: string;
  /** 为空时不允许确认（输入框标红） */
  required?: boolean;
  /** required 未填时的提示（缺省只标红不出字） */
  requiredMessage?: string;
  /** 返回错误文案则不关闭并显示在输入框下方（.field-msg.err）；返回 null / undefined / "" 表示通过 */
  validate?: (value: string) => string | null | undefined | false;
}

export interface ConfirmBaseOptions {
  /** 标题（.sheet-title）；不给时对话框用 labels.dialog 作可访问名 */
  title?: string | Node;
  /** 说明文字（.confirm-message） */
  message?: string | Node;
  /** 确认键文案，缺省 labels.confirm */
  confirmLabel?: string;
  /** 取消键文案，缺省 labels.cancel */
  cancelLabel?: string;
  /** 确认键用实底危险色（.btn.danger），对话框 role="alertdialog" */
  danger?: boolean;
  /** 缺省 "zh" */
  locale?: ConfirmLocale;
  labels?: Partial<ConfirmLabels>;
  /** 追加到 .sheet 上的类名 */
  className?: string;
  /** 中止时按「取消」处理 */
  signal?: AbortSignal;
}

/**
 * v0.29.0：确认对话框（.overlay + .sheet.confirm）。Esc / 点遮罩 / 取消 → false，确认 → true。
 * 焦点困在弹层里，初始焦点在取消键，关闭后还原。
 */
export function confirm(options?: ConfirmBaseOptions & { input?: undefined }): Promise<boolean>;
/** 带输入框：确认 → 输入的字符串，取消 → null。初始焦点在输入框（全选），Enter 确认 */
export function confirm(options: ConfirmBaseOptions & { input: ConfirmInputOptions }): Promise<string | null>;
