import type { ThemeMeta, ThemeContext, ThemeHandle } from "./_gl.js";

export interface GradientWavesParams {
  /** token 名，缺省 "--th-gradient-waves-horizon" */
  horizonColor: string;
  /** token 名，缺省 "--th-gradient-waves-wave" */
  waveColor: string;
  /** token 名，缺省 "--th-gradient-waves-crest" */
  crestColor: string;
  speed: number;
  amplitude: number;
  waveScale: number;
  waveRatio: number;
  swell: number;
  turbulence: number;
  /** 弧度 */
  tilt: number;
  zoom: number;
  height: number;
  fogDepth: number;
  detail: "low" | "medium" | "high";
  brightness: number;
  opacity: number;
  mouseInteraction: boolean;
  parallaxStrength: number;
  grain: boolean;
  grainIntensity: number;
  fps: number;
  maxDpr: number;
}

export const meta: ThemeMeta;

/** 挂到 .bg-layer；params 缺的键用 meta 里的缺省值；ctx 省略时用内置的 token 读取实现 */
export function mount(container: HTMLElement, params?: Partial<GradientWavesParams>, ctx?: ThemeContext): ThemeHandle;
