/**
 * The design widths the canvas and the preview agree on.
 *
 * One source of truth on purpose: the canvas renders its artboard at these
 * widths and the preview mirrors them, so "what I built" and "what the preview
 * shows" can never silently diverge again. Preview desktop used to be
 * unbounded, which meant a page authored inside the 1280 canvas rendered at
 * whatever the window happened to be — `fill` boxes stretched to the window
 * while pixel-pinned ones didn't, so the two views told different stories.
 *
 * This is the width `fill`/`%` resolve against and the width free placements
 * are authored in. The breakpoint layers themselves live in schemas/types.ts;
 * code/cssgen.ts emits the media queries they map to.
 */
import type { Breakpoint } from "@/schemas/types";

/** Artboard width per breakpoint, in CSS px. */
export const VIEWPORT_WIDTH: Record<Breakpoint, number> = {
  desktop: 1280,
  tablet: 768,
  mobile: 390,
};

/** Tooltip label for a viewport, e.g. "Desktop preview (1280)". */
export function viewportLabel(bp: Breakpoint): string {
  return `${bp[0].toUpperCase()}${bp.slice(1)} preview (${VIEWPORT_WIDTH[bp]})`;
}
