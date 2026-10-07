/**
 * Shared icon registry. The renderer draws these as inline SVG in the editor,
 * and the code generator embeds the identical paths in generated components.
 */

export const ICON_PATHS: Record<string, string> = {
  spark: "M12 3v4m0 10v4M3 12h4m10 0h4M5.6 5.6l2.8 2.8m7.2 7.2 2.8 2.8m0-12.8-2.8 2.8M8.4 15.6l-2.8 2.8",
  "arrow-right": "M4 12h16m-6-6 6 6-6 6",
  "arrow-left": "M20 12H4m6-6-6 6 6 6",
  check: "M4 12.5 9.5 18 20 6.5",
  x: "M6 6l12 12M18 6 6 18",
  menu: "M4 7h16M4 12h16M4 17h16",
  "chevron-down": "M6 9l6 6 6-6",
  "chevron-right": "M9 6l6 6-6 6",
  "chevron-up": "M6 15l6-6 6 6",
  star: "M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1.1 5.8L12 16.9l-5.3 2.7 1.1-5.8L3.5 9.7l5.9-.8z",
  heart: "M12 20.5C7 16.5 3.5 13.3 3.5 9.6 3.5 7 5.5 5 8 5c1.6 0 3.1.9 4 2.2C12.9 5.9 14.4 5 16 5c2.5 0 4.5 2 4.5 4.6 0 3.7-3.5 6.9-8.5 10.9z",
  zap: "M13 2 4.5 13.5H11L10 22l8.5-11.5H13z",
  globe: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c2.5 2.4 4 5.6 4 9s-1.5 6.6-4 9c-2.5-2.4-4-5.6-4-9s1.5-6.6 4-9z",
  code: "M8 6 3 12l5 6m8-12 5 6-5 6",
  shield: "M12 3 5 6v6c0 4.4 3 7.4 7 9 4-1.6 7-4.6 7-9V6z",
  rocket: "M12 15c-1-3.5.5-7.5 4-10 2 3.5 1.5 8-1 11l-1.5 1.5zM12 15l-3-3M8 12c-2 0-4 1-5 3 2 .5 3 .5 4 2 1.5 1 1.5 2 2 4 2-1 3-3 3-5",
  box: "M12 2 3 7v10l9 5 9-5V7zM3 7l9 5m0 0 9-5m-9 5v10",
  layers: "M12 2 2 7.5 12 13l10-5.5zM2 12.5 12 18l10-5.5M2 17.5 12 23l10-5.5",
  search: "M10.5 18a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15zM21 21l-5-5",
  mail: "M3 6h18v12H3zM3 7l9 6 9-6",
  github: "M12 2a10 10 0 0 0-3.2 19.5c.5.1.7-.2.7-.5v-1.7C6.7 19.9 6.1 18 6.1 18c-.4-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.6 2.4 1.1 3 .9.1-.7.4-1.1.6-1.4-2.2-.3-4.6-1.1-4.6-5 0-1.1.4-2 1-2.7-.1-.2-.4-1.2.1-2.6 0 0 .8-.3 2.7 1a9.4 9.4 0 0 1 5 0c1.9-1.3 2.7-1 2.7-1 .5 1.4.2 2.4.1 2.6.6.7 1 1.6 1 2.7 0 3.9-2.4 4.7-4.6 5 .4.3.7.9.7 1.9V21c0 .3.2.6.7.5A10 10 0 0 0 12 2z",
  twitter: "M4 4l7.1 9.3L4.4 20h2.1l5.4-5.5L16 20h4l-7.4-9.7L18.9 4h-2.1l-4.9 5.1L8 4z",
  play: "M8 5.5v13l10-6.5z",
  chart: "M4 20V10m6 10V4m6 16v-7m4 7H4",
  lock: "M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3",
  cloud: "M7 18a4 4 0 0 1-.6-8A5.5 5.5 0 0 1 17 8.5 4.2 4.2 0 0 1 17 18z",
  terminal: "M4 5h16v14H4zm3 4 3 3-3 3m5.5 0H16",
  users: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zm-6 9c.5-3.5 3-5.5 6-5.5s5.5 2 6 5.5m1.5-9a3 3 0 1 0-.5-6M18 20c-.2-2.2-1-3.9-2.3-5",
  wand: "M15 4V2m0 20v-2M4.9 4.9 3.5 3.5m17 17-1.4-1.4M4 15H2m20 0h-2M4.9 25.1M6 21 21 6",
  cursor: "M5 3l14 7-6.5 1.5L11 18z",
};

export const ICON_NAMES = Object.keys(ICON_PATHS);

export function iconPath(name: string | undefined): string {
  return ICON_PATHS[name ?? ""] ?? ICON_PATHS["spark"];
}
