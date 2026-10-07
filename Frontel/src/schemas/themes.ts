/**
 * Theme templates — 15 unique, opinionated design systems applied as a unit.
 *
 * Each template is a complete ProjectTheme (colors, type pairing, radius).
 * Applying one writes real theme tokens: every color token in the editor,
 * renderer and generated CSS keeps working — templates are data, not
 * special cases.
 */
import type { ThemeTemplate } from "./types";

const INTER = "Inter, ui-sans-serif, system-ui, sans-serif";
const GEOM = '"Space Grotesk", Inter, ui-sans-serif, system-ui, sans-serif';
const SERIF = 'Georgia, "Times New Roman", ui-serif, serif';
const MONO = '"JetBrains Mono", ui-monospace, "Cascadia Code", monospace';
const MODERN = '"DM Sans", Inter, ui-sans-serif, system-ui, sans-serif';
const ELEGANT = '"Playfair Display", Georgia, ui-serif, serif';

export const THEME_TEMPLATES: ThemeTemplate[] = [
  {
    id: "midnight",
    name: "Midnight Teal",
    description: "The Frontel default — deep ink surfaces with a teal accent.",
    swatch: "linear-gradient(135deg, #0c0e13 0 55%, #2dd4bf 55%)",
    theme: {
      colors: {
        background: "#0c0e13",
        surface: "#141822",
        text: "#e6eaf4",
        textMuted: "#8b93a9",
        primary: "#2dd4bf",
        primaryContrast: "#05201c",
        border: "#262d3e",
      },
      font: INTER,
      radius: 10,
    },
  },
  {
    id: "paper",
    name: "Paper",
    description: "Editorial light theme with warm ink and a red accent.",
    swatch: "linear-gradient(135deg, #faf7f2 0 55%, #d64545 55%)",
    theme: {
      colors: {
        background: "#faf7f2",
        surface: "#ffffff",
        text: "#1f1b16",
        textMuted: "#8a8072",
        primary: "#d64545",
        primaryContrast: "#fff5f2",
        border: "#e7e0d4",
      },
      font: SERIF,
      radius: 4,
    },
  },
  {
    id: "nordic",
    name: "Nordic Frost",
    description: "Cool Scandinavian blues with generous rounding.",
    swatch: "linear-gradient(135deg, #eceff4 0 55%, #5e81ac 55%)",
    theme: {
      colors: {
        background: "#eceff4",
        surface: "#ffffff",
        text: "#2e3440",
        textMuted: "#6b7686",
        primary: "#5e81ac",
        primaryContrast: "#ffffff",
        border: "#d8dee9",
      },
      font: MODERN,
      radius: 14,
    },
  },
  {
    id: "synthwave",
    name: "Synthwave",
    description: "Retro-future magenta on midnight purple.",
    swatch: "linear-gradient(135deg, #150c2e 0 55%, #ff2d95 55%)",
    theme: {
      colors: {
        background: "#150c2e",
        surface: "#1f1440",
        text: "#f2ecff",
        textMuted: "#9d8fc4",
        primary: "#ff2d95",
        primaryContrast: "#1a0524",
        border: "#37246b",
      },
      font: GEOM,
      radius: 8,
    },
  },
  {
    id: "forest",
    name: "Deep Forest",
    description: "Mossy greens for calm, grounded brands.",
    swatch: "linear-gradient(135deg, #0f1a12 0 55%, #6fcf97 55%)",
    theme: {
      colors: {
        background: "#0f1a12",
        surface: "#17241a",
        text: "#e8f3ea",
        textMuted: "#93a89a",
        primary: "#6fcf97",
        primaryContrast: "#0b1a10",
        border: "#25382b",
      },
      font: MODERN,
      radius: 12,
    },
  },
  {
    id: "mono",
    name: "Monochrome",
    description: "Pure black, white and nothing else. Typographic brutalism.",
    swatch: "linear-gradient(135deg, #0a0a0a 0 55%, #ffffff 55%)",
    theme: {
      colors: {
        background: "#0a0a0a",
        surface: "#141414",
        text: "#fafafa",
        textMuted: "#8f8f8f",
        primary: "#ffffff",
        primaryContrast: "#0a0a0a",
        border: "#2a2a2a",
      },
      font: MONO,
      radius: 2,
    },
  },
  {
    id: "sandstone",
    name: "Sandstone",
    description: "Desert warmth — terracotta, sand and clay.",
    swatch: "linear-gradient(135deg, #f6efe7 0 55%, #c96f4a 55%)",
    theme: {
      colors: {
        background: "#f6efe7",
        surface: "#fffbf5",
        text: "#3b2f28",
        textMuted: "#97857a",
        primary: "#c96f4a",
        primaryContrast: "#fff8f2",
        border: "#e6d9c9",
      },
      font: ELEGANT,
      radius: 10,
    },
  },
  {
    id: "cobalt",
    name: "Cobalt Corporate",
    description: "Confident enterprise blue with crisp contrast.",
    swatch: "linear-gradient(135deg, #0b1220 0 55%, #3b82f6 55%)",
    theme: {
      colors: {
        background: "#0b1220",
        surface: "#101a2e",
        text: "#e8eefb",
        textMuted: "#8b9ab5",
        primary: "#3b82f6",
        primaryContrast: "#071224",
        border: "#1e2c47",
      },
      font: INTER,
      radius: 8,
    },
  },
  {
    id: "blossom",
    name: "Blossom",
    description: "Soft pink pastels for friendly, human products.",
    swatch: "linear-gradient(135deg, #fff5f7 0 55%, #ec6a9c 55%)",
    theme: {
      colors: {
        background: "#fff5f7",
        surface: "#ffffff",
        text: "#3d2230",
        textMuted: "#a07b8c",
        primary: "#ec6a9c",
        primaryContrast: "#fffafc",
        border: "#f7dbe4",
      },
      font: MODERN,
      radius: 16,
    },
  },
  {
    id: "carbon",
    name: "Carbon Ember",
    description: "Dark carbon with a burning amber highlight.",
    swatch: "linear-gradient(135deg, #121212 0 55%, #ff9f1c 55%)",
    theme: {
      colors: {
        background: "#121212",
        surface: "#1c1c1c",
        text: "#f0ede8",
        textMuted: "#9b968f",
        primary: "#ff9f1c",
        primaryContrast: "#1d1200",
        border: "#2e2e2e",
      },
      font: GEOM,
      radius: 10,
    },
  },
  {
    id: "ocean",
    name: "Ocean Depth",
    description: "Abyssal navy lit by bioluminescent cyan.",
    swatch: "linear-gradient(135deg, #041622 0 55%, #00d1ff 55%)",
    theme: {
      colors: {
        background: "#041622",
        surface: "#0a2233",
        text: "#e2f4ff",
        textMuted: "#7fa3b8",
        primary: "#00d1ff",
        primaryContrast: "#02141d",
        border: "#123246",
      },
      font: INTER,
      radius: 12,
    },
  },
  {
    id: "lavender",
    name: "Lavender Dusk",
    description: "Twilight purples with a violet accent — creative studios.",
    swatch: "linear-gradient(135deg, #17131f 0 55%, #a78bfa 55%)",
    theme: {
      colors: {
        background: "#17131f",
        surface: "#211b2d",
        text: "#efeaff",
        textMuted: "#a293bd",
        primary: "#a78bfa",
        primaryContrast: "#150f24",
        border: "#332a45",
      },
      font: GEOM,
      radius: 14,
    },
  },
  {
    id: "matcha",
    name: "Matcha Cream",
    description: "Green tea calm — soft greens on warm cream.",
    swatch: "linear-gradient(135deg, #f4f1e8 0 55%, #7ca26b 55%)",
    theme: {
      colors: {
        background: "#f4f1e8",
        surface: "#fcfbf4",
        text: "#2c3324",
        textMuted: "#84907a",
        primary: "#7ca26b",
        primaryContrast: "#f9faf2",
        border: "#e0dcc9",
      },
      font: MODERN,
      radius: 12,
    },
  },
  {
    id: "crimson",
    name: "Crimson Press",
    description: "Bold magazine red on newsprint grey.",
    swatch: "linear-gradient(135deg, #f2f2f0 0 55%, #b3001b 55%)",
    theme: {
      colors: {
        background: "#f2f2f0",
        surface: "#ffffff",
        text: "#191919",
        textMuted: "#77756f",
        primary: "#b3001b",
        primaryContrast: "#fff5f6",
        border: "#ddddda",
      },
      font: SERIF,
      radius: 2,
    },
  },
  {
    id: "goldnight",
    name: "Black & Gold",
    description: "Luxury dark theme with metallic gold accents.",
    swatch: "linear-gradient(135deg, #0d0c0a 0 55%, #d4af37 55%)",
    theme: {
      colors: {
        background: "#0d0c0a",
        surface: "#171410",
        text: "#f4efe6",
        textMuted: "#a89e8c",
        primary: "#d4af37",
        primaryContrast: "#1c1503",
        border: "#2c2519",
      },
      font: ELEGANT,
      radius: 4,
    },
  },
];

const BY_ID = new Map(THEME_TEMPLATES.map((t) => [t.id, t]));

export function getThemeTemplate(id: string): ThemeTemplate | undefined {
  return BY_ID.get(id);
}
