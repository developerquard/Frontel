import type { CSSProperties } from "react";
import type { AnimationSpec } from "@/schemas/types";
import { easingCss } from "./styles";

export const REVEAL_TYPES = new Set([
  "fade",
  "fade-up",
  "fade-down",
  "slide-left",
  "slide-right",
  "zoom-in",
]);

export const HOVER_TYPES = new Set(["hover-lift", "hover-glow", "hover-scale", "hover-brighten"]);

/** Inline style a hover effect applies to the element while the pointer is on it. */
export function hoverActiveStyle(type: string, colors?: [string, string]): CSSProperties {
  switch (type) {
    case "hover-lift":
      return { transform: "translateY(-4px)" };
    case "hover-scale":
      return { transform: "scale(1.035)" };
    case "hover-brighten":
      return { filter: "brightness(1.18) saturate(1.05)" };
    default:
      return { boxShadow: `0 8px 32px ${colors?.[0] ?? "rgba(45, 212, 191, 0.35)"}` };
  }
}

/** CSS declaration a hover effect gets in the exported stylesheet. */
export function hoverCssDecl(type: string, colors?: [string, string]): string {
  switch (type) {
    case "hover-lift":
      return "transform: translateY(-4px);";
    case "hover-scale":
      return "transform: scale(1.035);";
    case "hover-brighten":
      return "filter: brightness(1.18) saturate(1.05);";
    default:
      return `box-shadow: 0 8px 32px ${colors?.[0] ?? "rgba(45, 212, 191, 0.35)"};`;
  }
}

/** Transition property a hover effect needs to feel smooth. */
export function hoverTransition(type: string): string {
  switch (type) {
    case "hover-lift":
    case "hover-scale":
      return "transform";
    case "hover-brighten":
      return "filter";
    default:
      return "box-shadow";
  }
}

export const SCROLL_FX_TYPES = new Set(["parallax", "background-transition", "scroll-progress"]);

export function isReveal(a?: AnimationSpec): boolean {
  return !!a && REVEAL_TYPES.has(a.type);
}
export function isHoverFx(a?: AnimationSpec): boolean {
  return !!a && HOVER_TYPES.has(a.type);
}
export function isScrollFx(a?: AnimationSpec): boolean {
  return !!a && SCROLL_FX_TYPES.has(a.type);
}

/** Hidden initial state for reveal animations. */
export function revealHidden(spec: AnimationSpec): CSSProperties {
  const common: CSSProperties = { willChange: "opacity, transform" };
  switch (spec.type) {
    case "fade":
      return { ...common, opacity: 0 };
    case "fade-up":
      return { ...common, opacity: 0, transform: "translateY(28px)" };
    case "fade-down":
      return { ...common, opacity: 0, transform: "translateY(-28px)" };
    case "slide-left":
      return { ...common, opacity: 0, transform: "translateX(48px)" };
    case "slide-right":
      return { ...common, opacity: 0, transform: "translateX(-48px)" };
    case "zoom-in":
      return { ...common, opacity: 0, transform: "scale(0.92)" };
    default:
      return {};
  }
}

/** Transition used to move from hidden → visible. */
export function revealTransition(spec: AnimationSpec): CSSProperties {
  return {
    transitionProperty: "opacity, transform",
    transitionDuration: `${spec.duration}ms`,
    transitionDelay: `${spec.delay}ms`,
    transitionTimingFunction: easingCss(spec.easing),
  };
}

export const REVEAL_VISIBLE: CSSProperties = { opacity: 1, transform: "none" };

/** Parallax offset: progress -0.5..0.5 → translateY in px. */
export function parallaxOffset(progress: number, intensity = 0.4): number {
  return -progress * intensity * 160;
}

/** Scroll progress of the whole document, 0..1. */
export function documentScrollProgress(doc: Document): number {
  const max = doc.documentElement.scrollHeight - doc.documentElement.clientHeight;
  return max <= 0 ? 0 : Math.min(1, Math.max(0, doc.documentElement.scrollTop / max));
}

function hexToRgb(hex: string): [number, number, number] {
  const m = hex.replace("#", "");
  const v = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  const n = parseInt(v, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToCss([r, g, b]: [number, number, number]): string {
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

/** Interpolates two colors; t = 0 returns `from`, t = 1 returns `to`. */
export function mixColors(from: string, to: string, t: number): string {
  try {
    const a = hexToRgb(from);
    const b = hexToRgb(to);
    return rgbToCss([
      a[0] + (b[0] - a[0]) * t,
      a[1] + (b[1] - a[1]) * t,
      a[2] + (b[2] - a[2]) * t,
    ]);
  } catch {
    return from;
  }
}

/** 0 when the element enters from the bottom of the viewport, 1 when it leaves at the top. */
export function elementViewportProgress(el: HTMLElement): number {
  const doc = el.ownerDocument;
  const win = doc.defaultView;
  if (!win) return 0;
  const vh = win.innerHeight;
  const rect = el.getBoundingClientRect();
  const total = vh + rect.height;
  const traveled = vh - rect.top;
  return total <= 0 ? 0 : Math.min(1, Math.max(0, traveled / total));
}

export function prefersReducedMotion(doc?: Document): boolean {
  const w = (doc?.defaultView ?? window) as Window;
  return w.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
