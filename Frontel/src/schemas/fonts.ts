/**
 * Font registry.
 *
 * A node stores a font *id* (StyleProps.fontFamily) rather than a raw CSS
 * stack, because two consumers need different things from it:
 *
 *   - the renderer + codegen need the CSS stack (`fontStack`);
 *   - the export needs the real webfont URL to load (`googleFontsHref`), which
 *     is impossible to recover from an arbitrary stack string.
 *
 * Unknown ids fall back to the literal value, so imported projects that carry
 * hand-written stacks keep rendering exactly as before.
 */
import type { ElementNode, Project } from "./types";

export type FontCategory = "sans" | "serif" | "mono" | "display";

export interface FontDef {
  id: string;
  name: string;
  category: FontCategory;
  /** Full CSS font-family stack. */
  stack: string;
  /** Google Fonts family + weights, when the face is a webfont. */
  google?: { family: string; weights: number[] };
}

const SANS_FALLBACK = "ui-sans-serif, system-ui, -apple-system, sans-serif";
const SERIF_FALLBACK = "ui-serif, Georgia, serif";
const MONO_FALLBACK = "ui-monospace, \"Cascadia Code\", monospace";

/** Weights requested from Google for every webfont (keeps one URL shape). */
const W = [400, 500, 600, 700, 800];

export const FONT_DEFS: FontDef[] = [
  { id: "inter", name: "Inter", category: "sans", stack: `Inter, ${SANS_FALLBACK}`, google: { family: "Inter", weights: W } },
  { id: "manrope", name: "Manrope", category: "sans", stack: `Manrope, Inter, ${SANS_FALLBACK}`, google: { family: "Manrope", weights: W } },
  { id: "plus-jakarta", name: "Plus Jakarta Sans", category: "sans", stack: `"Plus Jakarta Sans", Inter, ${SANS_FALLBACK}`, google: { family: "Plus+Jakarta+Sans", weights: W } },
  { id: "dm-sans", name: "DM Sans", category: "sans", stack: `"DM Sans", Inter, ${SANS_FALLBACK}`, google: { family: "DM+Sans", weights: W } },
  { id: "outfit", name: "Outfit", category: "sans", stack: `Outfit, Inter, ${SANS_FALLBACK}`, google: { family: "Outfit", weights: W } },
  { id: "poppins", name: "Poppins", category: "sans", stack: `Poppins, Inter, ${SANS_FALLBACK}`, google: { family: "Poppins", weights: W } },
  { id: "sora", name: "Sora", category: "display", stack: `Sora, Inter, ${SANS_FALLBACK}`, google: { family: "Sora", weights: W } },
  { id: "space-grotesk", name: "Space Grotesk", category: "display", stack: `"Space Grotesk", Inter, ${SANS_FALLBACK}`, google: { family: "Space+Grotesk", weights: [400, 500, 600, 700] } },
  { id: "bricolage", name: "Bricolage Grotesque", category: "display", stack: `"Bricolage Grotesque", Inter, ${SANS_FALLBACK}`, google: { family: "Bricolage+Grotesque", weights: W } },
  { id: "playfair", name: "Playfair Display", category: "serif", stack: `"Playfair Display", Georgia, ${SERIF_FALLBACK}`, google: { family: "Playfair+Display", weights: W } },
  { id: "fraunces", name: "Fraunces", category: "serif", stack: `Fraunces, Georgia, ${SERIF_FALLBACK}`, google: { family: "Fraunces", weights: W } },
  { id: "lora", name: "Lora", category: "serif", stack: `Lora, Georgia, ${SERIF_FALLBACK}`, google: { family: "Lora", weights: W } },
  { id: "instrument-serif", name: "Instrument Serif", category: "serif", stack: `"Instrument Serif", Georgia, ${SERIF_FALLBACK}`, google: { family: "Instrument+Serif", weights: [400] } },
  { id: "jetbrains-mono", name: "JetBrains Mono", category: "mono", stack: `"JetBrains Mono", ${MONO_FALLBACK}`, google: { family: "JetBrains+Mono", weights: W } },
  { id: "space-mono", name: "Space Mono", category: "mono", stack: `"Space Mono", ${MONO_FALLBACK}`, google: { family: "Space+Mono", weights: [400, 700] } },
  { id: "system", name: "System UI", category: "sans", stack: SANS_FALLBACK },
  { id: "georgia", name: "Georgia (local)", category: "serif", stack: `Georgia, "Times New Roman", ${SERIF_FALLBACK}` },
];

export const FONT_CATEGORY_ORDER: FontCategory[] = ["sans", "display", "serif", "mono"];

export const FONT_CATEGORY_LABELS: Record<FontCategory, string> = {
  sans: "Sans",
  display: "Display",
  serif: "Serif",
  mono: "Mono",
};

const BY_ID = new Map(FONT_DEFS.map((f) => [f.id, f]));

export function getFont(id: string | undefined): FontDef | undefined {
  return id ? BY_ID.get(id) : undefined;
}

/**
 * Resolves a stored font value to a CSS font-family stack. Registry ids win;
 * anything else is passed through untouched (raw stacks, imported projects).
 */
export function fontStack(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return getFont(value)?.stack ?? value;
}

/** The registry id for a stack string, when one matches (theme migrations). */
export function fontIdForStack(stack: string | undefined): string | undefined {
  if (!stack) return undefined;
  return FONT_DEFS.find((f) => f.stack === stack)?.id;
}

/** Google Fonts stylesheet URL for a set of font ids, or null when none. */
export function googleFontsHref(ids: Iterable<string>): string | null {
  const families: string[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    const def = getFont(id);
    if (!def?.google || seen.has(def.id)) continue;
    seen.add(def.id);
    families.push(`family=${def.google.family}:wght@${def.google.weights.join(";")}`);
  }
  if (!families.length) return null;
  return `https://fonts.googleapis.com/css2?${families.join("&")}&display=swap`;
}

/**
 * Every webfont a project needs: the theme typeface plus any per-node
 * override. Used by the exported index.html and by the editor's own loader,
 * so the canvas shows the same faces the export ships.
 */
export function fontsUsedBy(project: Project): string[] {
  const ids = new Set<string>();
  const themeId = project.theme.fontId ?? fontIdForStack(project.theme.font);
  if (themeId) ids.add(themeId);
  for (const node of Object.values(project.nodes) as ElementNode[]) {
    for (const layer of [node.style.base, node.style.tablet, node.style.mobile]) {
      if (layer?.fontFamily) ids.add(layer.fontFamily);
    }
  }
  return [...ids];
}
