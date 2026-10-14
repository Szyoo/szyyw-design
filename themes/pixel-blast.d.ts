import type { ThemeMeta, ThemeContext, ThemeHandle } from "./_gl.js";

export interface PixelBlastParams {
  variant: "square" | "circle" | "triangle" | "diamond";
  pixelSize: number;
  /** token 名，缺省 "--th-pixel-blast-color" */
  color: string;
  /** 改它会重建 WebGL 上下文 */
  antialias: boolean;
  patternScale: number;
  patternDensity: number;
  pixelSizeJitter: number;
  enableRipples: boolean;
  rippleIntensityScale: number;
  rippleThickness: number;
  rippleSpeed: number;
  liquid: boolean;
  liquidStrength: number;
  liquidRadius: number;
  liquidWobbleSpeed: number;
  speed: number;
  edgeFade: number;
  noiseAmount: number;
  transparent: boolean;
  autoPauseOffscreen: boolean;
  fps: number;
  maxDpr: number;
}

export const meta: ThemeMeta;

/** 挂到 .bg-layer；params 缺的键用 meta 里的缺省值；ctx 省略时用内置的 token 读取实现 */
export function mount(container: HTMLElement, params?: Partial<PixelBlastParams>, ctx?: ThemeContext): ThemeHandle;
