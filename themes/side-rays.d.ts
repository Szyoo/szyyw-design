import type { ThemeMeta, ThemeContext, ThemeHandle } from "./_gl.js";

export interface SideRaysParams {
  speed: number;
  /** token 名，缺省 "--th-side-rays-1" */
  rayColor1: string;
  /** token 名，缺省 "--th-side-rays-2" */
  rayColor2: string;
  intensity: number;
  spread: number;
  origin: "top-right" | "top-left" | "bottom-right" | "bottom-left";
  /** 度 */
  tilt: number;
  saturation: number;
  blend: number;
  falloff: number;
  opacity: number;
  fps: number;
  maxDpr: number;
}

export const meta: ThemeMeta;

/** 挂到 .bg-layer；params 缺的键用 meta 里的缺省值；ctx 省略时用内置的 token 读取实现 */
export function mount(container: HTMLElement, params?: Partial<SideRaysParams>, ctx?: ThemeContext): ThemeHandle;
