import type { ThemeMeta, ThemeParams, ThemeContext, ThemeInstance } from "./types";
import type { DotFieldHandle } from "../dotfield";

/** 缺省主题「星云」：DotField 点阵。参数键与旧「背景参数」面板相同，存储沿用 szyyw:dotfield */
export const meta: ThemeMeta & { id: "nebula" };

export interface NebulaInstance extends ThemeInstance {
  /** 底层 DotField 句柄（glow 切换 / 恢复缺省时会重挂，请每次现取） */
  readonly field: DotFieldHandle;
}

export function mount(container: HTMLElement, params?: ThemeParams, ctx?: Partial<ThemeContext>): NebulaInstance;
