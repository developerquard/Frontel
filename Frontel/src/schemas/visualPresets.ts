/**
 * Surface presets — one-click looks for boxes (cards, panels, buttons).
 *
 * Same contract as the text variants: a preset is a pure StyleProps patch, so
 * it is undoable, responsive and exported by the code generator for free.
 * Every value is expressed in theme tokens (var(--fe-…)) wherever a color is
 * involved, so a preset keeps working after the theme changes.
 */
import type { ElementProps, ElementType, StyleProps } from "./types";

export interface SurfacePreset {
  id: string;
  label: string;
  description: string;
  /** Thumbnail background (pure CSS, no rendering of the real element). */
  swatch: string;
  style: Partial<StyleProps>;
  /** Optional "add this" behaviour for the Add panel. */
  creates?: { type: ElementType; props?: ElementProps };
}

export const SURFACE_PRESETS: SurfacePreset[] = [
  {
    id: "glass",
    label: "Glass",
    description: "Frosted translucent card — the fastest way to look modern over imagery.",
    swatch: "linear-gradient(135deg, rgb(255 255 255 / 0.22), rgb(255 255 255 / 0.06))",
    style: {
      background: "rgb(255 255 255 / 0.07)",
      backdropBlur: 18,
      borderWidth: 1,
      borderColor: "rgb(255 255 255 / 0.14)",
      borderRadius: 20,
      boxShadow: "0 24px 60px -24px rgb(0 0 0 / 0.65)",
      padding: [28, 28, 28, 28],
    },
    creates: { type: "stack", props: {} },
  },
  {
    id: "frosted-panel",
    label: "Frosted panel",
    description: "Heavier blur with a hairline edge — ideal for sticky navigation.",
    swatch: "linear-gradient(180deg, rgb(255 255 255 / 0.14), rgb(255 255 255 / 0.03))",
    style: {
      background: "rgb(255 255 255 / 0.05)",
      backdropBlur: 28,
      borderWidth: 1,
      borderColor: "border",
      borderRadius: 16,
    },
  },
  {
    id: "soft-card",
    label: "Soft card",
    description: "Surface fill, hairline border, generous rounded corners.",
    swatch: "linear-gradient(135deg, #171c27, #10141d)",
    style: {
      background: "surface",
      borderWidth: 1,
      borderColor: "border",
      borderRadius: 18,
      boxShadow: "0 1px 2px rgb(0 0 0 / 0.35), 0 18px 40px -24px rgb(0 0 0 / 0.8)",
      padding: [28, 28, 28, 28],
    },
    creates: { type: "stack", props: {} },
  },
  {
    id: "raised",
    label: "Raised",
    description: "Pure depth: a large soft shadow, no border.",
    swatch: "radial-gradient(circle at 50% 120%, rgb(0 0 0 / 0.75) 0 40%, transparent 70%)",
    style: {
      boxShadow: "0 32px 80px -32px rgb(0 0 0 / 0.85)",
      borderRadius: 18,
      borderWidth: 0,
    },
  },
  {
    id: "neon-ring",
    label: "Neon ring",
    description: "Primary-colored ring with an outer glow.",
    swatch: "radial-gradient(circle at 50% 50%, transparent 45%, rgb(45 212 191 / 0.85) 55%, transparent 70%)",
    style: {
      borderWidth: 1,
      borderColor: "primary",
      borderRadius: 14,
      boxShadow: "0 0 0 1px var(--fe-primary), 0 0 34px -6px var(--fe-primary)",
    },
  },
  {
    id: "primary-glow",
    label: "Primary glow",
    description: "A colored light spill under the box — perfect for CTAs.",
    swatch: "radial-gradient(circle at 50% 100%, rgb(45 212 191 / 0.75) 0 20%, transparent 65%)",
    style: {
      boxShadow: "0 16px 44px -12px var(--fe-primary)",
      borderRadius: 12,
      borderWidth: 0,
    },
  },
  {
    id: "gradient-panel",
    label: "Gradient panel",
    description: "Primary gradient fill for hero blocks and feature banners.",
    swatch: "linear-gradient(120deg, #2dd4bf, #7c3aed)",
    style: {
      background: "linear-gradient(120deg, var(--fe-primary) 0%, #7c3aed 100%)",
      borderRadius: 20,
      borderWidth: 0,
      boxShadow: "0 24px 60px -28px rgb(0 0 0 / 0.7)",
      padding: [28, 28, 28, 28],
    },
    creates: { type: "stack", props: {} },
  },
  {
    id: "inner-sheen",
    label: "Inner sheen",
    description: "A single bright inset line — subtle, expensive-looking depth.",
    swatch: "linear-gradient(180deg, rgb(255 255 255 / 0.18), transparent 55%)",
    style: {
      boxShadow:
        "inset 0 1px 0 rgb(255 255 255 / 0.14), inset 0 -1px 0 rgb(0 0 0 / 0.35), 0 14px 32px -20px rgb(0 0 0 / 0.7)",
      borderRadius: 14,
      borderWidth: 1,
      borderColor: "border",
    },
  },
  {
    id: "pill",
    label: "Pill",
    description: "Fully rounded — buttons, badges and segmented controls.",
    swatch: "linear-gradient(90deg, #1c2333, #2dd4bf)",
    style: { borderRadius: 999 },
  },
  {
    id: "tilt",
    label: "Tilted",
    description: "A small rotation — breaks the grid without breaking the layout.",
    swatch: "linear-gradient(135deg, transparent 45%, rgb(45 212 191 / 0.6) 50%, transparent 55%)",
    style: { rotate: -3, borderRadius: 16 },
  },
];

const BY_ID = new Map(SURFACE_PRESETS.map((p) => [p.id, p]));

export function getSurfacePreset(id: string): SurfacePreset | undefined {
  return BY_ID.get(id);
}

/** Surface presets matching a search query; `onlyCreatable` for the Add panel. */
export function filterSurfacePresets(q: string, onlyCreatable = false): SurfacePreset[] {
  const query = q.trim().toLowerCase();
  return SURFACE_PRESETS.filter(
    (p) =>
      (!onlyCreatable || !!p.creates) &&
      (!query || `${p.label} ${p.description} ${p.id}`.toLowerCase().includes(query)),
  );
}
