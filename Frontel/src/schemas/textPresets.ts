/**
 * Text variants — the builder's type system.
 *
 * Each variant is a pure StyleProps patch, so applying one goes through the
 * exact same path as any hand-made style: it is undoable, responsive and
 * exported by the code generator with no special case. A variant also declares
 * what it *creates* when used from the Add panel (a heading, a paragraph, a
 * pill…), which is what makes "add a gradient headline" one click instead of
 * five slider edits.
 */
import type { ElementProps, ElementType, StyleProps } from "./types";

export type TextPresetGroup = "Headings" | "Body" | "Accents" | "Labels";

export interface TextPreset {
  id: string;
  label: string;
  group: TextPresetGroup;
  description: string;
  /** What a click in the Add panel creates. */
  creates: { type: ElementType; props?: ElementProps };
  /** Style patch applied to the selection (or to the created node). */
  style: Partial<StyleProps>;
}

/**
 * Decorations every variant resets first, so switching variants never leaves a
 * stale glow, outline or gradient behind. A variant that wants one sets it
 * after the spread.
 */
const CLEAN: Partial<StyleProps> = {
  textGradient: undefined,
  textGlow: undefined,
  textShadow: undefined,
  textStrokeWidth: undefined,
  textStrokeColor: undefined,
  textTransform: undefined,
  fontStyle: undefined,
  textDecoration: undefined,
};

const glow = (color: string, blur: number, strength = 2): string =>
  `0 0 ${blur}px ${color}, 0 0 ${blur * strength}px ${color}`;

export const TEXT_PRESETS: TextPreset[] = [
  {
    id: "hero-display",
    label: "Hero display",
    group: "Headings",
    description: "The one line a visitor reads first: huge, tight and centred.",
    creates: { type: "heading", props: { text: "Ship at nebula speed", level: 1 } },
    style: {
      ...CLEAN,
      fontSize: 72,
      fontWeight: 800,
      lineHeight: 1.05,
      letterSpacing: -2.5,
      textAlign: "center",
      color: "text",
    },
  },
  {
    id: "display",
    label: "Display",
    group: "Headings",
    description: "Large page headline with tight optical spacing.",
    creates: { type: "heading", props: { text: "Obvious in hindsight", level: 1 } },
    style: {
      ...CLEAN,
      fontSize: 56,
      fontWeight: 800,
      lineHeight: 1.08,
      letterSpacing: -1.8,
      textAlign: "left",
      color: "text",
    },
  },
  {
    id: "title",
    label: "Title",
    group: "Headings",
    description: "Section headline that anchors a block of content.",
    creates: { type: "heading", props: { text: "Everything your release needs", level: 2 } },
    style: {
      ...CLEAN,
      fontSize: 40,
      fontWeight: 700,
      lineHeight: 1.15,
      letterSpacing: -1,
      textAlign: "left",
      color: "text",
    },
  },
  {
    id: "card-title",
    label: "Card title",
    group: "Headings",
    description: "Compact heading for cards, features and list rows.",
    creates: { type: "heading", props: { text: "Realtime pipelines", level: 3 } },
    style: {
      ...CLEAN,
      fontSize: 20,
      fontWeight: 600,
      lineHeight: 1.35,
      letterSpacing: -0.3,
      textAlign: "left",
      color: "text",
    },
  },
  {
    id: "editorial-serif",
    label: "Editorial serif",
    group: "Headings",
    description: "A serif headline — instantly more premium and magazine-like.",
    creates: { type: "heading", props: { text: "Crafted, not assembled", level: 2 } },
    style: {
      ...CLEAN,
      fontFamily: "playfair",
      fontSize: 44,
      fontWeight: 700,
      lineHeight: 1.15,
      letterSpacing: -0.5,
      textAlign: "left",
      color: "text",
    },
  },
  {
    id: "gradient-headline",
    label: "Gradient headline",
    group: "Headings",
    description: "Headline filled with the theme's primary gradient.",
    creates: { type: "heading", props: { text: "Built visually. Owned as code.", level: 2 } },
    style: {
      ...CLEAN,
      fontSize: 52,
      fontWeight: 800,
      lineHeight: 1.1,
      letterSpacing: -1.5,
      textAlign: "center",
      textGradient: "linear-gradient(100deg, var(--fe-primary) 0%, #7c3aed 55%, #f472b6 100%)",
    },
  },
  {
    id: "glow-headline",
    label: "Glow headline",
    group: "Headings",
    description: "Soft neon bloom around the glyphs — reads well on dark backgrounds.",
    creates: { type: "heading", props: { text: "Light it up", level: 1 } },
    style: {
      ...CLEAN,
      fontSize: 60,
      fontWeight: 800,
      lineHeight: 1.08,
      letterSpacing: -2,
      textAlign: "center",
      color: "text",
      textShadow: glow("var(--fe-primary)", 26, 2.6),
    },
  },
  {
    id: "outline-headline",
    label: "Outline headline",
    group: "Headings",
    description: "Hollow letterforms stroked in the primary color.",
    creates: { type: "heading", props: { text: "Outline", level: 1 } },
    style: {
      ...CLEAN,
      fontSize: 64,
      fontWeight: 800,
      lineHeight: 1.05,
      letterSpacing: -1,
      textAlign: "center",
      color: "transparent",
      textStrokeWidth: 1.5,
      textStrokeColor: "primary",
    },
  },
  {
    id: "lead",
    label: "Lead paragraph",
    group: "Body",
    description: "Slightly larger intro copy that sits under a headline.",
    creates: { type: "text", props: { text: "Nebula unifies analytics, releases and feature flags in one place." } },
    style: {
      ...CLEAN,
      fontSize: 19,
      fontWeight: 400,
      lineHeight: 1.7,
      letterSpacing: 0,
      textAlign: "left",
      color: "muted",
    },
  },
  {
    id: "body",
    label: "Body",
    group: "Body",
    description: "The default reading size for paragraphs.",
    creates: { type: "text", props: { text: "Describe your product in one clear sentence." } },
    style: {
      ...CLEAN,
      fontSize: 16,
      fontWeight: 400,
      lineHeight: 1.65,
      letterSpacing: 0,
      textAlign: "left",
      color: "muted",
    },
  },
  {
    id: "small",
    label: "Small print",
    group: "Body",
    description: "Fine print: footnotes, disclaimers, helper text.",
    creates: { type: "text", props: { text: "No credit card required. Cancel anytime." } },
    style: {
      ...CLEAN,
      fontSize: 13.5,
      fontWeight: 400,
      lineHeight: 1.6,
      letterSpacing: 0,
      textAlign: "left",
      color: "muted",
    },
  },
  {
    id: "caption",
    label: "Caption",
    group: "Body",
    description: "Tiny, tracked-out label for image and figure captions.",
    creates: { type: "text", props: { text: "Figure 01 — release pipeline" } },
    style: {
      ...CLEAN,
      fontSize: 12.5,
      fontWeight: 500,
      lineHeight: 1.5,
      letterSpacing: 0.4,
      textAlign: "left",
      color: "muted",
    },
  },
  {
    id: "quote",
    label: "Pull quote",
    group: "Accents",
    description: "Italic, indented and marked with an accent rule.",
    creates: { type: "text", props: { text: "The interface disappeared and only the work remained." } },
    style: {
      ...CLEAN,
      fontSize: 21,
      fontWeight: 400,
      lineHeight: 1.6,
      letterSpacing: -0.2,
      fontStyle: "italic",
      textAlign: "left",
      color: "text",
      borderWidth: 3,
      borderColor: "primary",
      padding: [4, 0, 4, 20],
    },
  },
  {
    id: "eyebrow",
    label: "Eyebrow",
    group: "Accents",
    description: "Uppercase kicker above a heading — the cheapest way to look designed.",
    creates: { type: "text", props: { text: "Now in public beta" } },
    style: {
      ...CLEAN,
      fontSize: 12,
      fontWeight: 700,
      lineHeight: 1.3,
      letterSpacing: 2.4,
      textTransform: "uppercase",
      textAlign: "left",
      color: "primary",
    },
  },
  {
    id: "accent-link",
    label: "Accent link",
    group: "Accents",
    description: "Inline call-to-action styled as a primary action link.",
    creates: { type: "link", props: { label: "Read the docs", href: "#" } },
    style: {
      ...CLEAN,
      fontSize: 15,
      fontWeight: 600,
      letterSpacing: 0,
      textAlign: "left",
      color: "primary",
      textDecoration: "underline",
    },
  },
  {
    id: "mono-code",
    label: "Inline code",
    group: "Labels",
    description: "Monospaced snippet with a surface chip behind it.",
    creates: { type: "text", props: { text: "npm create frontel@latest" } },
    style: {
      ...CLEAN,
      fontFamily: "jetbrains-mono",
      fontSize: 13.5,
      fontWeight: 500,
      lineHeight: 1.6,
      letterSpacing: 0,
      textAlign: "left",
      color: "text",
      background: "surface",
      padding: [6, 10, 6, 10],
      borderRadius: 8,
      borderWidth: 1,
      borderColor: "border",
    },
  },
  {
    id: "pill-badge",
    label: "Pill badge",
    group: "Labels",
    description: "Solid, fully rounded chip for status and badges.",
    creates: { type: "text", props: { text: "Beta" } },
    style: {
      ...CLEAN,
      fontSize: 12,
      fontWeight: 700,
      lineHeight: 1,
      letterSpacing: 0.6,
      textTransform: "uppercase",
      textAlign: "center",
      color: "primary-contrast",
      background: "primary",
      padding: [7, 14, 7, 14],
      borderRadius: 999,
    },
  },
  {
    id: "glow-badge",
    label: "Glow badge",
    group: "Labels",
    description: "Dark chip with a halo — great over a 3D background.",
    creates: { type: "text", props: { text: "✦ Now in beta" } },
    style: {
      ...CLEAN,
      fontSize: 12,
      fontWeight: 600,
      lineHeight: 1,
      letterSpacing: 0.4,
      textTransform: "uppercase",
      textAlign: "center",
      color: "primary",
      background: "surface",
      padding: [8, 15, 8, 15],
      borderRadius: 999,
      borderWidth: 1,
      borderColor: "primary",
      boxShadow: "0 0 24px -4px var(--fe-primary)",
      textShadow: glow("var(--fe-primary)", 12, 1.6),
    },
  },
  {
    id: "sticker",
    label: "Sticker",
    group: "Labels",
    description: "Heavy uppercase label with a hard drop shadow.",
    creates: { type: "text", props: { text: "Ship it" } },
    style: {
      ...CLEAN,
      fontSize: 14,
      fontWeight: 900,
      lineHeight: 1.2,
      letterSpacing: 1.4,
      textTransform: "uppercase",
      textAlign: "left",
      color: "primary",
      textShadow: "2px 2px 0 rgb(0 0 0 / 0.45)",
    },
  },
];

export const TEXT_PRESET_GROUPS: TextPresetGroup[] = ["Headings", "Body", "Accents", "Labels"];

const BY_ID = new Map(TEXT_PRESETS.map((p) => [p.id, p]));

export function getTextPreset(id: string): TextPreset | undefined {
  return BY_ID.get(id);
}

/** Variants matching a search query (label, description, group or id). */
export function filterTextPresets(q: string): TextPreset[] {
  const query = q.trim().toLowerCase();
  if (!query) return TEXT_PRESETS;
  return TEXT_PRESETS.filter((p) =>
    `${p.label} ${p.description} ${p.group} ${p.id}`.toLowerCase().includes(query),
  );
}
