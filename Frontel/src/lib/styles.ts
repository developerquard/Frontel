import type { CSSProperties } from "react";
import type { ProjectTheme, SizeValue, StyleProps } from "@/schemas/types";
import { fontStack } from "@/schemas/fonts";

/** Maps schema easing names to CSS cubic-bezier curves. Shared with codegen. */
export const EASING_CSS: Record<string, string> = {
  "ease-out": "cubic-bezier(0.22, 1, 0.36, 1)",
  "ease-in": "cubic-bezier(0.7, 0, 0.84, 0)",
  "ease-in-out": "cubic-bezier(0.65, 0, 0.35, 1)",
  linear: "linear",
  spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
};

export function easingCss(easing: string | undefined): string {
  return EASING_CSS[easing ?? "ease-out"] ?? EASING_CSS["ease-out"];
}

export function sizeToCss(size: SizeValue | undefined): string | undefined {
  if (!size) return undefined;
  switch (size.kind) {
    case "fill":
      return "100%";
    case "hug":
      return "fit-content";
    case "auto":
      return "auto";
    case "fixed":
      return `${size.value}${size.unit}`;
  }
}

export function spacingToCss(v: [number, number, number, number] | undefined): string | undefined {
  if (!v) return undefined;
  const [t, r, b, l] = v;
  if (t === r && r === b && b === l) return `${t}px`;
  if (t === b && r === l) return `${t}px ${r}px`;
  return `${t}px ${r}px ${b}px ${l}px`;
}

/** Typography from theme vars (no inline font-family in the editor either). */
export function themeVars(theme: ProjectTheme): Record<string, string> {
  return {
    "--fe-bg": theme.colors.background,
    "--fe-surface": theme.colors.surface,
    "--fe-text": theme.colors.text,
    "--fe-muted": theme.colors.textMuted,
    "--fe-primary": theme.colors.primary,
    "--fe-primary-contrast": theme.colors.primaryContrast,
    "--fe-border": theme.colors.border,
    "--fe-radius": `${theme.radius}px`,
    "--fe-font": theme.font,
  };
}

/**
 * Converts effective (already breakpoint-merged) StyleProps to a React
 * CSSProperties object. The code generator emits the identical declarations
 * into real CSS classes — see src/code/generator.ts.
 */
export function styleToCss(style: StyleProps, theme: ProjectTheme): CSSProperties {
  const css: Record<string, string | number | undefined> = {};

  if (style.display === "grid") {
    css.display = "grid";
    if (style.gridColumns) css.gridTemplateColumns = `repeat(${style.gridColumns}, minmax(0, 1fr))`;
  } else if (style.display === "flex" || style.flexDirection) {
    css.display = "flex";
    if (style.flexDirection) css.flexDirection = style.flexDirection;
    if (style.justify) css.justifyContent = style.justify;
    if (style.align) css.alignItems = style.align;
    if (style.wrap !== undefined) css.flexWrap = style.wrap ? "wrap" : "nowrap";
  }

  if (style.gap !== undefined) css.gap = `${style.gap}px`;
  const pad = spacingToCss(style.padding);
  if (pad) css.padding = pad;
  const mar = spacingToCss(style.margin);
  if (mar) css.margin = mar;

  const w = sizeToCss(style.width);
  if (w) css.width = w;
  const h = sizeToCss(style.height);
  if (h) css.height = h;
  if (style.minHeight !== undefined) {
    css.minHeight = typeof style.minHeight === "number" ? `${style.minHeight}px` : style.minHeight;
  }
  if (style.maxWidth != null) css.maxWidth = `${style.maxWidth}px`;

  if (style.background) css.background = resolveColor(style.background, theme);
  if (style.borderRadius !== undefined) css.borderRadius = `${style.borderRadius}px`;
  if (style.borderWidth !== undefined && style.borderWidth > 0) {
    css.border = `${style.borderWidth}px solid ${resolveColor(style.borderColor ?? theme.colors.border, theme)}`;
  }
  if (style.opacity !== undefined) css.opacity = style.opacity;
  if (style.overflow) css.overflow = style.overflow;
  // A box that hosts a negative-z backdrop (a 3D scene used as a background)
  // needs its own stacking context, or the backdrop would paint behind the
  // host's background — i.e. vanish.
  if (style.isolation) css.isolation = "isolate";
  if (style.position) css.position = style.position;
  // Free placement (position absolute inside a position:relative host box).
  if (style.position === "absolute") {
    if (style.left !== undefined) css.left = `${Math.round(style.left)}px`;
    if (style.top !== undefined) css.top = `${Math.round(style.top)}px`;
    if (style.zIndex !== undefined) css.zIndex = style.zIndex;
  }
  if (style.cursor) css.cursor = style.cursor;

  if (style.fontSize !== undefined) css.fontSize = `${style.fontSize}px`;
  if (style.fontWeight !== undefined) css.fontWeight = style.fontWeight;
  if (style.lineHeight !== undefined) css.lineHeight = String(style.lineHeight);
  if (style.letterSpacing !== undefined) css.letterSpacing = `${style.letterSpacing}px`;
  if (style.color) css.color = resolveColor(style.color, theme);
  if (style.textAlign) css.textAlign = style.textAlign;
  const family = fontStack(style.fontFamily);
  if (family) css.fontFamily = family;
  if (style.textTransform) css.textTransform = style.textTransform;
  if (style.fontStyle) css.fontStyle = style.fontStyle;
  if (style.textDecoration) css.textDecoration = style.textDecoration;
  // Gradient text: the gradient replaces the fill and is clipped to the glyphs.
  if (style.textGradient) {
    css.backgroundImage = resolveColor(style.textGradient, theme);
    css.backgroundClip = "text";
    css.WebkitBackgroundClip = "text";
    css.WebkitTextFillColor = "transparent";
    css.color = "transparent";
  }
  if (style.textStrokeWidth) {
    css.WebkitTextStrokeWidth = `${style.textStrokeWidth}px`;
    css.WebkitTextStrokeColor = resolveColor(style.textStrokeColor ?? theme.colors.text, theme);
  }
  if (style.textGlow) {
    const color = resolveColor(style.textGlow.color, theme);
    const blur = Math.max(0, style.textGlow.blur);
    const spread = style.textGlow.spread ?? 2;
    css.textShadow =
      blur <= 0
        ? `0 0 0 ${color}`
        : spread > 0
          ? `0 0 ${blur}px ${color}, 0 0 ${Math.round(blur * spread)}px ${color}`
          : `0 0 ${blur}px ${color}`;
  }
  if (style.textShadow) css.textShadow = resolveColor(style.textShadow, theme);
  if (style.boxShadow) css.boxShadow = resolveColor(style.boxShadow, theme);
  if (style.backdropBlur) css.backdropFilter = `blur(${style.backdropBlur}px)`;
  if (style.blur) css.filter = `blur(${style.blur}px)`;
  if (style.rotate !== undefined && style.rotate !== 0) css.rotate = `${style.rotate}deg`;
  if (style.scale !== undefined && style.scale !== 1) css.scale = String(style.scale);

  if (style.objectFit) css.objectFit = style.objectFit;
  if (style.objectPosition) css.objectPosition = style.objectPosition;

  if (style.thickness !== undefined && style.orientation) {
    if (style.orientation === "horizontal") {
      css.width = "100%";
      css.height = `${style.thickness}px`;
    } else {
      css.width = `${style.thickness}px`;
      css.height = "100%";
    }
  }

  if (style.visible === false) css.display = "none";

  return css as CSSProperties;
}

/** Resolves semantic color tokens ("primary", "surface", …) to theme values. */
export function resolveColor(color: string, theme: ProjectTheme): string {
  switch (color) {
    case "background":
      return theme.colors.background;
    case "surface":
      return theme.colors.surface;
    case "text":
      return theme.colors.text;
    case "muted":
      return theme.colors.textMuted;
    case "primary":
      return theme.colors.primary;
    case "primary-contrast":
      return theme.colors.primaryContrast;
    case "border":
      return theme.colors.border;
    default:
      return color;
  }
}

export const SEMANTIC_COLORS = [
  "background",
  "surface",
  "text",
  "muted",
  "primary",
  "primary-contrast",
  "border",
] as const;

export function isSemanticColor(color: string): boolean {
  return (SEMANTIC_COLORS as readonly string[]).includes(color);
}
