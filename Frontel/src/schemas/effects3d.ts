/**
 * 3D background effects — 30 presets sourced from vanta.js-style WebGL
 * backgrounds plus in-house GLSL shaders in the same spirit.
 *
 * Each preset:
 *  - belongs to a family ("vanta" = shipped vanta.js effect modules,
 *    "shader" = custom fragment-shader backgrounds, "objects" = three.js
 *    object stages) so the right runtime component renders it;
 *  - declares the parameters it exposes so the inspector can render
 *    per-effect controls from one table (single source of truth);
 *  - resolves to a full Scene3DConfig patch via `effectConfig`.
 *
 * The code generator reads the same table to emit equivalent runtimes into
 * exported projects, so editor and export cannot drift apart.
 */
import { DEFAULT_SCENE_3D, type Scene3DConfig } from "./types";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type EffectFamily = "vanta" | "shader" | "objects";

export type EffectCategory =
  | "animated"
  | "particles"
  | "nature"
  | "abstract"
  | "objects"
  | "interactive";

export interface EffectParamDef {
  key: string;
  label: string;
  kind: "number" | "color" | "boolean" | "select";
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
  /** vanta color params expect ints; shader params take #hex strings. */
  intColor?: boolean;
}

export interface Effect3DPreset {
  id: string;
  name: string;
  family: EffectFamily;
  category: EffectCategory;
  description: string;
  /** CSS background used by gallery thumbnails (no WebGL in a thumbnail). */
  swatch: string;
  /** Vanta effect module name (family === "vanta"). */
  vantaEffect?: string;
  /** Custom shader id (family === "shader"). */
  shaderId?: string;
  /** Params this effect exposes, in inspector display order. */
  params: EffectParamDef[];
  /** Defaults for those params. */
  defaults: Record<string, number | string | boolean>;
}

/* ------------------------------------------------------------------ */
/* Shared param helpers                                                */
/* ------------------------------------------------------------------ */

const P = {
  color: (key = "color", label = "Color"): EffectParamDef => ({ key, label, kind: "color" }),
  bgColor: (): EffectParamDef => ({ key: "backgroundColor", label: "Background", kind: "color", intColor: true }),
  speed: (max = 4): EffectParamDef => ({ key: "speed", label: "Speed", kind: "number", min: 0, max, step: 0.05 }),
  size: (min = 0.5, max = 5): EffectParamDef => ({ key: "size", label: "Size", kind: "number", min, max, step: 0.1 }),
  spacing: (min = 5, max = 60): EffectParamDef => ({ key: "spacing", label: "Spacing", kind: "number", min, max, step: 1 }),
  zoom: (): EffectParamDef => ({ key: "zoom", label: "Zoom", kind: "number", min: 0.4, max: 3, step: 0.05 }),
  mouseControls: (): EffectParamDef => ({ key: "mouseControls", label: "Mouse controls", kind: "boolean" }),
  touchControls: (): EffectParamDef => ({ key: "touchControls", label: "Touch controls", kind: "boolean" }),
  gyroControls: (): EffectParamDef => ({ key: "gyroControls", label: "Gyro controls", kind: "boolean" }),
};

/* ------------------------------------------------------------------ */
/* The 30 presets                                                      */
/* ------------------------------------------------------------------ */

/** 14 vanta.js effects — real shipped modules from the vanta package. */
const VANTA_PRESETS: Effect3DPreset[] = [
  {
    id: "vanta-birds",
    name: "Birds",
    family: "vanta",
    category: "animated",
    description: "Boid flocking birds weaving through space.",
    swatch: "radial-gradient(circle at 30% 35%, #ff5b5b 0 8%, transparent 9%), radial-gradient(circle at 62% 60%, #38c8ff 0 6%, transparent 7%), linear-gradient(160deg, #0a2038 10%, #07192f 60%)",
    vantaEffect: "BIRDS",
    params: [
      P.bgColor(),
      { key: "color1", label: "Bird color 1", kind: "color", intColor: true },
      { key: "color2", label: "Bird color 2", kind: "color", intColor: true },
      { key: "birdSize", label: "Bird size", kind: "number", min: 0.5, max: 4, step: 0.1 },
      { key: "wingSpan", label: "Wing span", kind: "number", min: 10, max: 40, step: 1 },
      { key: "speedLimit", label: "Speed limit", kind: "number", min: 1, max: 10, step: 0.5 },
      { key: "separation", label: "Separation", kind: "number", min: 5, max: 100, step: 1 },
      { key: "quantity", label: "Flock size", kind: "number", min: 2, max: 5, step: 1 },
      P.mouseControls(), P.touchControls(), P.gyroControls(),
    ],
    defaults: { backgroundColor: "#07192f", color1: "#ff5b5b", color2: "#38c8ff", birdSize: 1.2, wingSpan: 30, speedLimit: 5, separation: 20, quantity: 5, mouseControls: true, touchControls: true, gyroControls: false },
  },
  {
    id: "vanta-waves",
    name: "Waves",
    family: "vanta",
    category: "nature",
    description: "Glossy rolling ocean waves catching the light.",
    swatch: "linear-gradient(180deg, #0b2f4d 0%, #005588 55%, #03203a 100%)",
    vantaEffect: "WAVES",
    params: [
      P.color(),
      { key: "shininess", label: "Shininess", kind: "number", min: 5, max: 150, step: 1 },
      { key: "waveHeight", label: "Wave height", kind: "number", min: 0, max: 40, step: 0.5 },
      { key: "waveSpeed", label: "Wave speed", kind: "number", min: 0, max: 2, step: 0.05 },
      P.zoom(), P.mouseControls(), P.touchControls(), P.gyroControls(),
    ],
    defaults: { color: "#005588", shininess: 30, waveHeight: 18, waveSpeed: 1, zoom: 1.05, mouseControls: true, touchControls: true, gyroControls: false },
  },
  {
    id: "vanta-net",
    name: "Net",
    family: "vanta",
    category: "particles",
    description: "A plexus web of connected points reacting to the cursor.",
    swatch: "radial-gradient(circle at 55% 45%, #ff3f81 0 3%, transparent 4%), linear-gradient(150deg, #2b1a4a 0%, #23153c 70%)",
    vantaEffect: "NET",
    params: [
      P.color(),
      P.bgColor(),
      { key: "points", label: "Points", kind: "number", min: 4, max: 20, step: 1 },
      { key: "maxDistance", label: "Link distance", kind: "number", min: 10, max: 40, step: 1 },
      P.spacing(10, 30),
      { key: "showDots", label: "Show dots", kind: "boolean" },
      P.mouseControls(), P.touchControls(), P.gyroControls(),
    ],
    defaults: { color: "#ff3f81", backgroundColor: "#23153c", points: 12, maxDistance: 22, spacing: 16, showDots: true, mouseControls: true, touchControls: true, gyroControls: false },
  },
  {
    id: "vanta-globe",
    name: "Globe",
    family: "vanta",
    category: "particles",
    description: "Rotating sphere of linked dots — a living wireframe globe.",
    swatch: "radial-gradient(circle at 50% 48%, #ff3f81 0 10%, transparent 12%), radial-gradient(circle at 50% 48%, transparent 0 24%, #ffffff22 25%, transparent 27%), linear-gradient(150deg, #2b1a4a 0%, #23153c 70%)",
    vantaEffect: "GLOBE",
    params: [
      P.color(),
      { key: "color2", label: "Dot color", kind: "color", intColor: true },
      P.bgColor(),
      P.size(0.5, 3),
      { key: "points", label: "Points", kind: "number", min: 4, max: 20, step: 1 },
      P.spacing(10, 30),
      { key: "showDots", label: "Show dots", kind: "boolean" },
      P.mouseControls(), P.touchControls(), P.gyroControls(),
    ],
    defaults: { color: "#ff3f81", color2: "#ffffff", backgroundColor: "#23153c", size: 1.1, points: 12, spacing: 18, showDots: true, mouseControls: true, touchControls: true, gyroControls: false },
  },
  {
    id: "vanta-dots",
    name: "Dot Field",
    family: "vanta",
    category: "particles",
    description: "Deep-space grid of glowing dots drifting past the camera.",
    swatch: "radial-gradient(circle at 40% 40%, #ff8820 0 2%, transparent 3%), radial-gradient(circle at 70% 65%, #ff8820 0 2%, transparent 3%), linear-gradient(180deg, #2a2a2a 0%, #191919 100%)",
    vantaEffect: "DOTS",
    params: [
      P.color(),
      { key: "color2", label: "Accent color", kind: "color", intColor: true },
      P.bgColor(),
      P.size(0.5, 5),
      P.spacing(20, 60),
      { key: "showLines", label: "Show lines", kind: "boolean" },
      P.mouseControls(), P.touchControls(), P.gyroControls(),
    ],
    defaults: { color: "#ff8820", color2: "#ff8820", backgroundColor: "#222222", size: 3, spacing: 35, showLines: true, mouseControls: true, touchControls: true, gyroControls: false },
  },
  {
    id: "vanta-fog",
    name: "Fog",
    family: "vanta",
    category: "abstract",
    description: "Soft volumetric fog clouds blending four colors.",
    swatch: "linear-gradient(115deg, #ffc300 0%, #ff1f00 38%, #2d00ff 72%, #ffebeb 100%)",
    vantaEffect: "FOG",
    params: [
      { key: "highlightColor", label: "Highlight", kind: "color", intColor: true },
      { key: "midtoneColor", label: "Midtone", kind: "color", intColor: true },
      { key: "lowlightColor", label: "Lowlight", kind: "color", intColor: true },
      { key: "baseColor", label: "Base", kind: "color", intColor: true },
      { key: "blurFactor", label: "Blur", kind: "number", min: 0.2, max: 0.9, step: 0.01 },
      P.speed(), P.zoom(), P.mouseControls(), P.touchControls(), P.gyroControls(),
    ],
    defaults: { highlightColor: "#ffc300", midtoneColor: "#ff1f00", lowlightColor: "#2d00ff", baseColor: "#0a0a12", blurFactor: 0.6, speed: 1, zoom: 1, mouseControls: true, touchControls: true, gyroControls: false },
  },
  {
    id: "vanta-cells",
    name: "Cells",
    family: "vanta",
    category: "abstract",
    description: "Organic Voronoi cells pulsing like a microscope slide.",
    swatch: "conic-gradient(from 120deg at 45% 50%, #8c8cff 0%, #f2e735 35%, #d7ff8f 60%, #8c8cff 100%)",
    vantaEffect: "CELLS",
    params: [
      { key: "color1", label: "Cell color", kind: "color", intColor: true },
      { key: "color2", label: "Accent color", kind: "color", intColor: true },
      P.bgColor(),
      { key: "amplitudeFactor", label: "Amplitude", kind: "number", min: 0.1, max: 3, step: 0.1 },
      { key: "ringFactor", label: "Rings", kind: "number", min: 0.1, max: 20, step: 0.1 },
      { key: "rotationFactor", label: "Rotation", kind: "number", min: 0, max: 2, step: 0.05 },
      P.size(0.5, 3), P.speed(),
      P.mouseControls(), P.touchControls(), P.gyroControls(),
    ],
    defaults: { color1: "#8c8cff", color2: "#f2e735", backgroundColor: "#101018", amplitudeFactor: 1, ringFactor: 1, rotationFactor: 1, size: 1.5, speed: 1, mouseControls: true, touchControls: true, gyroControls: false },
  },
  {
    id: "vanta-topology",
    name: "Topology",
    family: "vanta",
    category: "abstract",
    description: "Flow-field ribbons growing across the canvas (p5 engine).",
    swatch: "linear-gradient(45deg, #89964e 0 25%, #002222 25% 50%, #89964e 50% 75%, #002222 75%)",
    vantaEffect: "TOPOLOGY",
    params: [
      P.color(),
      P.bgColor(),
      P.mouseControls(), P.touchControls(), P.gyroControls(),
    ],
    defaults: { color: "#89964e", backgroundColor: "#002222", mouseControls: true, touchControls: true, gyroControls: false },
  },
  {
    id: "vanta-trunk",
    name: "Trunk",
    family: "vanta",
    category: "nature",
    description: "Concentric growth rings rippling from a wandering trunk (p5 engine).",
    swatch: "repeating-radial-gradient(circle at 50% 55%, #98465f 0 3px, #222426 3px 9px)",
    vantaEffect: "TRUNK",
    params: [
      P.color(),
      P.bgColor(),
      P.spacing(0, 10),
      { key: "chaos", label: "Chaos", kind: "number", min: 0, max: 10, step: 0.5 },
      P.mouseControls(), P.touchControls(), P.gyroControls(),
    ],
    defaults: { color: "#98465f", backgroundColor: "#222426", spacing: 0, chaos: 1, mouseControls: true, touchControls: true, gyroControls: false },
  },
  {
    id: "vanta-rings",
    name: "Rings",
    family: "vanta",
    category: "abstract",
    description: "Neon concentric rings pulsing outward like sonar.",
    swatch: "repeating-radial-gradient(circle at 50% 50%, #88ff00 0 2px, #202428 2px 14px)",
    vantaEffect: "RINGS",
    params: [
      P.color(),
      P.bgColor(),
      P.mouseControls(), P.touchControls(), P.gyroControls(),
    ],
    defaults: { color: "#88ff00", backgroundColor: "#202428", mouseControls: true, touchControls: true, gyroControls: false },
  },
  {
    id: "vanta-halo",
    name: "Halo",
    family: "vanta",
    category: "interactive",
    description: "A glowing torus of particles orbiting a dark core.",
    swatch: "radial-gradient(circle at 50% 50%, #0b0b10 0 18%, #5b2c8f30 24%, transparent 40%), linear-gradient(150deg, #1a1030 0%, #0b0b10 70%)",
    vantaEffect: "HALO",
    params: [
      P.bgColor(),
      { key: "haloColor", label: "Halo color", kind: "color", intColor: true },
      { key: "amplitudeFactor", label: "Amplitude", kind: "number", min: 0.5, max: 3, step: 0.1 },
      { key: "xOffset", label: "X offset", kind: "number", min: -0.5, max: 0.5, step: 0.01 },
      { key: "yOffset", label: "Y offset", kind: "number", min: -0.5, max: 0.5, step: 0.01 },
      P.size(0.5, 3),
      P.mouseControls(), P.touchControls(), P.gyroControls(),
    ],
    defaults: { backgroundColor: "#0b0b10", haloColor: "#7b46c9", amplitudeFactor: 1.3, xOffset: 0.15, yOffset: 0.05, size: 1, mouseControls: true, touchControls: true, gyroControls: false },
  },
  {
    id: "vanta-ripple",
    name: "Ripple",
    family: "vanta",
    category: "interactive",
    description: "Water-like ripples spreading under the pointer.",
    swatch: "radial-gradient(circle at 55% 45%, #186025 0 6%, #ffffff44 8%, transparent 12%), linear-gradient(150deg, #a8e6c0 0%, #f6f6f6 70%)",
    vantaEffect: "RIPPLE",
    params: [
      { key: "color1", label: "Ripple color", kind: "color", intColor: true },
      { key: "color2", label: "Highlight", kind: "color", intColor: true },
      P.bgColor(),
      { key: "amplitudeFactor", label: "Amplitude", kind: "number", min: 0.1, max: 3, step: 0.1 },
      { key: "ringFactor", label: "Rings", kind: "number", min: 0.1, max: 20, step: 0.1 },
      { key: "rotationFactor", label: "Rotation", kind: "number", min: 0, max: 2, step: 0.05 },
      P.speed(),
      P.mouseControls(), P.touchControls(), P.gyroControls(),
    ],
    defaults: { color1: "#186025", color2: "#ffffff", backgroundColor: "#f6f6f6", amplitudeFactor: 1, ringFactor: 4, rotationFactor: 0.1, speed: 1, mouseControls: true, touchControls: true, gyroControls: false },
  },
  {
    id: "vanta-clouds",
    name: "Clouds",
    family: "vanta",
    category: "nature",
    description: "Sunlit clouds drifting across a painted sky.",
    swatch: "linear-gradient(180deg, #68b8d7 0%, #adc1de 55%, #ff9919 100%)",
    vantaEffect: "CLOUDS",
    params: [
      P.bgColor(),
      { key: "skyColor", label: "Sky", kind: "color", intColor: true },
      { key: "cloudColor", label: "Cloud", kind: "color", intColor: true },
      { key: "cloudShadowColor", label: "Cloud shadow", kind: "color", intColor: true },
      { key: "sunColor", label: "Sun", kind: "color", intColor: true },
      { key: "sunGlareColor", label: "Sun glare", kind: "color", intColor: true },
      { key: "sunlightColor", label: "Sun light", kind: "color", intColor: true },
      P.speed(), P.mouseControls(), P.touchControls(), P.gyroControls(),
    ],
    defaults: { backgroundColor: "#ffffff", skyColor: "#68b8d7", cloudColor: "#adc1de", cloudShadowColor: "#183550", sunColor: "#ff9919", sunGlareColor: "#ff6633", sunlightColor: "#ff9933", speed: 1, mouseControls: true, touchControls: true, gyroControls: false },
  },
  {
    id: "vanta-clouds2",
    name: "Night Clouds",
    family: "vanta",
    category: "nature",
    description: "Moonlit storm clouds sliding through the dark.",
    swatch: "linear-gradient(180deg, #5ca6ca 0%, #334d80 45%, #0a0f1c 100%)",
    vantaEffect: "CLOUDS2",
    params: [
      P.bgColor(),
      { key: "skyColor", label: "Sky", kind: "color", intColor: true },
      { key: "cloudColor", label: "Cloud", kind: "color", intColor: true },
      { key: "lightColor", label: "Light", kind: "color", intColor: true },
      P.speed(),
      P.mouseControls(), P.touchControls(), P.gyroControls(),
    ],
    defaults: { backgroundColor: "#000000", skyColor: "#5ca6ca", cloudColor: "#334d80", lightColor: "#ffffff", speed: 1, mouseControls: true, touchControls: true, gyroControls: false },
  },
];

/** 16 in-house GLSL / three.js backgrounds in the same spirit. */
const SHADER_PRESETS: Effect3DPreset[] = [
  {
    id: "fx-aurora",
    name: "Aurora",
    family: "shader",
    category: "nature",
    description: "Northern-lights curtains sweeping over a night sky.",
    swatch: "linear-gradient(100deg, #020014 0%, #00ffa3 35%, #0396ff 65%, #020014 100%)",
    shaderId: "aurora",
    params: [
      { key: "colorA", label: "Curtain A", kind: "color" },
      { key: "colorB", label: "Curtain B", kind: "color" },
      { key: "colorC", label: "Sky", kind: "color" },
      P.speed(3), P.zoom(), P.mouseControls(), P.touchControls(),
    ],
    defaults: { colorA: "#00ffa3", colorB: "#0396ff", colorC: "#020014", speed: 1, zoom: 1, mouseControls: true, touchControls: true },
  },
  {
    id: "fx-plasma",
    name: "Plasma",
    family: "shader",
    category: "abstract",
    description: "Classic plasma field melting colors into each other.",
    swatch: "conic-gradient(from 0deg, #ff00cc, #3333ff, #00ffcc, #ffcc00, #ff00cc)",
    shaderId: "plasma",
    params: [
      { key: "colorA", label: "Color A", kind: "color" },
      { key: "colorB", label: "Color B", kind: "color" },
      { key: "colorC", label: "Color C", kind: "color" },
      P.speed(3), P.zoom(), P.mouseControls(), P.touchControls(),
    ],
    defaults: { colorA: "#ff00cc", colorB: "#3333ff", colorC: "#00ffcc", speed: 1, zoom: 1, mouseControls: false, touchControls: true },
  },
  {
    id: "fx-nebula",
    name: "Nebula",
    family: "shader",
    category: "nature",
    description: "Deep-space gas clouds lit from within.",
    swatch: "radial-gradient(circle at 60% 40%, #6a11cb55 0 30%, transparent 45%), radial-gradient(circle at 30% 65%, #2575fc55 0 25%, transparent 40%), linear-gradient(160deg, #0b0014 0%, #05010a 100%)",
    shaderId: "nebula",
    params: [
      { key: "colorA", label: "Cloud A", kind: "color" },
      { key: "colorB", label: "Cloud B", kind: "color" },
      { key: "colorC", label: "Stars", kind: "color" },
      P.speed(3), P.zoom(), P.mouseControls(), P.touchControls(),
    ],
    defaults: { colorA: "#6a11cb", colorB: "#2575fc", colorC: "#ffffff", speed: 0.8, zoom: 1, mouseControls: true, touchControls: true },
  },
  {
    id: "fx-lava",
    name: "Lamp",
    family: "shader",
    category: "abstract",
    description: "Slow lava-lamp blobs bleeding color into darkness.",
    swatch: "radial-gradient(circle at 35% 40%, #ff6a00 0 18%, transparent 35%), radial-gradient(circle at 65% 60%, #ee0979 0 15%, transparent 32%), linear-gradient(160deg, #14000a 0%, #030006 100%)",
    shaderId: "lava",
    params: [
      { key: "colorA", label: "Blob A", kind: "color" },
      { key: "colorB", label: "Blob B", kind: "color" },
      { key: "colorC", label: "Base", kind: "color" },
      P.speed(3), P.zoom(), P.mouseControls(), P.touchControls(),
    ],
    defaults: { colorA: "#ff6a00", colorB: "#ee0979", colorC: "#050008", speed: 0.7, zoom: 1, mouseControls: false, touchControls: true },
  },
  {
    id: "fx-grid",
    name: "Retro Grid",
    family: "shader",
    category: "animated",
    description: "A synthwave horizon grid racing toward the sunset.",
    swatch: "linear-gradient(180deg, #1a0533 0%, #ff2d95 55%, #0d001f 55%, #0d001f 100%)",
    shaderId: "grid",
    params: [
      { key: "colorA", label: "Grid", kind: "color" },
      { key: "colorB", label: "Sun", kind: "color" },
      { key: "colorC", label: "Sky", kind: "color" },
      P.speed(3), P.zoom(), P.mouseControls(), P.touchControls(),
    ],
    defaults: { colorA: "#ff2d95", colorB: "#ffb347", colorC: "#1a0533", speed: 1, zoom: 1, mouseControls: true, touchControls: true },
  },
  {
    id: "fx-ocean-wire",
    name: "Wire Ocean",
    family: "shader",
    category: "animated",
    description: "Wireframe ocean swell rendered in glowing lines.",
    swatch: "repeating-linear-gradient(0deg, #00e5ff44 0 1px, transparent 1px 8px), linear-gradient(180deg, #04121f 0%, #083a52 100%)",
    shaderId: "oceanwire",
    params: [
      { key: "colorA", label: "Wire", kind: "color" },
      { key: "colorB", label: "Depth", kind: "color" },
      P.speed(3), P.zoom(), P.mouseControls(), P.touchControls(),
    ],
    defaults: { colorA: "#00e5ff", colorB: "#04121f", speed: 1, zoom: 1, mouseControls: true, touchControls: true },
  },
  {
    id: "fx-wormhole",
    name: "Wormhole",
    family: "shader",
    category: "abstract",
    description: "A spiraling tunnel of light pulling you in.",
    swatch: "repeating-conic-gradient(from 0deg at 50% 50%, #7f5cff 0 8deg, #090313 8deg 18deg)",
    shaderId: "wormhole",
    params: [
      { key: "colorA", label: "Tunnel", kind: "color" },
      { key: "colorB", label: "Core", kind: "color" },
      P.speed(4), P.zoom(), P.mouseControls(), P.touchControls(),
    ],
    defaults: { colorA: "#7f5cff", colorB: "#ffffff", speed: 1.2, zoom: 1, mouseControls: true, touchControls: true },
  },
  {
    id: "fx-liquidsky",
    name: "Liquid Sky",
    family: "shader",
    category: "nature",
    description: "Oil-slick iridescence flowing across the heavens.",
    swatch: "linear-gradient(120deg, #00f5a0 0%, #00d9f5 30%, #7b2ff7 60%, #f107a3 100%)",
    shaderId: "liquidsky",
    params: [
      { key: "colorA", label: "Sheen A", kind: "color" },
      { key: "colorB", label: "Sheen B", kind: "color" },
      { key: "colorC", label: "Sheen C", kind: "color" },
      P.speed(3), P.zoom(), P.mouseControls(), P.touchControls(),
    ],
    defaults: { colorA: "#00f5a0", colorB: "#00d9f5", colorC: "#7b2ff7", speed: 0.9, zoom: 1, mouseControls: false, touchControls: true },
  },
  {
    id: "fx-particles",
    name: "Starfield",
    family: "shader",
    description: "Warp-speed stars streaming past the camera.",
    swatch: "radial-gradient(circle at 50% 50%, #ffffff 0 1%, transparent 3%), linear-gradient(160deg, #000010 0%, #101030 100%)",
    category: "particles",
    shaderId: "starfield",
    params: [
      { key: "colorA", label: "Star", kind: "color" },
      { key: "colorB", label: "Space", kind: "color" },
      P.speed(4), P.zoom(), P.mouseControls(), P.touchControls(),
    ],
    defaults: { colorA: "#ffffff", colorB: "#000010", speed: 1, zoom: 1, mouseControls: true, touchControls: true },
  },
  {
    id: "fx-snow",
    name: "Snowfall",
    family: "shader",
    description: "Gentle snow drifting down through soft light.",
    category: "particles",
    swatch: "radial-gradient(circle at 40% 30%, #ffffff 0 1.5%, transparent 3%), linear-gradient(180deg, #283e51 0%, #0c1622 100%)",
    shaderId: "snow",
    params: [
      { key: "colorA", label: "Flake", kind: "color" },
      { key: "colorB", label: "Sky", kind: "color" },
      P.speed(3), P.zoom(), P.mouseControls(), P.touchControls(),
    ],
    defaults: { colorA: "#ffffff", colorB: "#16283a", speed: 0.6, zoom: 1, mouseControls: false, touchControls: true },
  },
  {
    id: "fx-embers",
    name: "Embers",
    family: "shader",
    category: "particles",
    description: "Sparks rising from an unseen fire below.",
    swatch: "radial-gradient(circle at 50% 90%, #ff7b00 0 8%, transparent 20%), linear-gradient(180deg, #1a0500 0%, #000000 100%)",
    shaderId: "embers",
    params: [
      { key: "colorA", label: "Ember", kind: "color" },
      { key: "colorB", label: "Night", kind: "color" },
      P.speed(3), P.zoom(), P.mouseControls(), P.touchControls(),
    ],
    defaults: { colorA: "#ff7b00", colorB: "#0d0200", speed: 1, zoom: 1, mouseControls: false, touchControls: true },
  },
  {
    id: "fx-caustics",
    name: "Caustics",
    category: "particles",
    family: "shader",
    description: "Underwater light dancing on a sandy floor.",
    swatch: "linear-gradient(135deg, #0cebeb 0%, #20e3b2 45%, #0a6b8a 100%)",
    shaderId: "caustics",
    params: [
      { key: "colorA", label: "Light", kind: "color" },
      { key: "colorB", label: "Water", kind: "color" },
      P.speed(3), P.zoom(), P.mouseControls(), P.touchControls(),
    ],
    defaults: { colorA: "#bff8ff", colorB: "#0a6b8a", speed: 1, zoom: 1, mouseControls: true, touchControls: true },
  },
  {
    id: "fx-metaballs",
    category: "particles",
    name: "Metaball",
    family: "shader",
    description: "Mercury blobs merging and splitting in zero-g.",
    swatch: "radial-gradient(circle at 42% 45%, #e0e6f0 0 14%, transparent 26%), radial-gradient(circle at 60% 60%, #9aa8c0 0 10%, transparent 22%), linear-gradient(160deg, #1a1f2b 0%, #0b0d13 100%)",
    shaderId: "metaballs",
    params: [
      { key: "colorA", label: "Metal", kind: "color" },
      { key: "colorB", label: "Void", kind: "color" },
      P.speed(3), P.zoom(), P.mouseControls(), P.touchControls(),
    ],
    defaults: { colorA: "#e0e6f0", colorB: "#10131a", speed: 0.8, zoom: 1, mouseControls: true, touchControls: true },
  },
  {
    category: "particles",
    id: "fx-silk",
    name: "Silk",
    family: "shader",
    description: "Flowing silk sheets catching a soft sheen.",
    swatch: "linear-gradient(115deg, #f3ec78 0%, #da4453 50%, #7c3aed 100%)",
    shaderId: "silk",
    params: [
      { key: "colorA", label: "Sheen", kind: "color" },
      { key: "colorB", label: "Shade", kind: "color" },
      P.speed(3), P.zoom(), P.mouseControls(), P.touchControls(),
    ],
    defaults: { colorA: "#f3ec78", colorB: "#7c3aed", speed: 0.8, zoom: 1, mouseControls: false, touchControls: true },
  },
  {
    id: "fx-kaleido",
    name: "Kaleidoscope",
    family: "shader",
    description: "Mirrored fractal petals blooming in rhythm.",
    swatch: "conic-gradient(from 0deg at 50% 50%, #ff9a9e 0 45deg, #fad0c4 45deg 90deg, #a18cd1 90deg 135deg, #fbc2eb 135deg 180deg, #ff9a9e 180deg)",
    shaderId: "kaleido",
    params: [
      { key: "colorA", label: "Petal A", kind: "color" },
      { key: "colorB", label: "Petal B", kind: "color" },
      P.speed(3), P.zoom(), P.mouseControls(), P.touchControls(),
    ],
    defaults: { colorA: "#a18cd1", colorB: "#fbc2eb", speed: 1, zoom: 1, mouseControls: true, touchControls: true },
    category: "particles",
  },
  {
    category: "abstract",
    id: "fx-voronoi",
    name: "Crystal",
    family: "shader",
    description: "Faceted crystal cells refracting quiet light.",
    swatch: "conic-gradient(from 210deg at 50% 50%, #232526 0deg, #414345 60deg, #8e9eab 120deg, #232526 180deg)",
    shaderId: "voronoi",
    params: [
      { key: "colorA", label: "Crystal", kind: "color" },
      { key: "colorB", label: "Shadow", kind: "color" },
      P.speed(3), P.zoom(), P.mouseControls(), P.touchControls(),
    ],
    defaults: { colorA: "#8e9eab", colorB: "#232526", speed: 0.6, zoom: 1, mouseControls: false, touchControls: true },
  },
];

/** Object-stage scenes (three.js geometry, customizable like the originals). */
const OBJECT_PRESETS: Effect3DPreset[] = [
  {
    id: "obj-torus",
    name: "Torus Knot",
    family: "objects",
    category: "objects",
    description: "The classic twisting knot, fully material-customizable.",
    swatch: "radial-gradient(circle at 45% 45%, transparent 0 18%, #2dd4bf 19% 30%, transparent 31% 38%, #2dd4bf55 39% 44%, transparent 45%), linear-gradient(160deg, #0c1216 0%, #071013 100%)",
    shaderId: "objects",
    params: [
      P.color(),
      P.bgColor(),
      { key: "metalness", label: "Metalness", kind: "number", min: 0, max: 1, step: 0.05 },
      { key: "roughness", label: "Roughness", kind: "number", min: 0, max: 1, step: 0.05 },
      { key: "rotationSpeed", label: "Spin", kind: "number", min: 0, max: 2, step: 0.05 },
      { key: "floatAmplitude", label: "Float", kind: "number", min: 0, max: 1, step: 0.05 },
      { key: "cameraDistance", label: "Camera", kind: "number", min: 2.5, max: 12, step: 0.25 },
      P.mouseControls(), P.touchControls(), P.gyroControls(),
    ],
    defaults: { color: "#2dd4bf", backgroundColor: "#0c1216", metalness: 0.55, roughness: 0.28, rotationSpeed: 0.4, floatAmplitude: 0.25, cameraDistance: 5, mouseControls: true, touchControls: true, gyroControls: false },
  },
  {
    id: "obj-crystal",
    name: "Crystal",
    family: "objects",
    category: "objects",
    description: "A faceted icosahedron gem catching rim light.",
    swatch: "conic-gradient(from 30deg at 50% 50%, transparent 0 40deg, #818cf866 41deg 80deg, transparent 81deg 120deg, #818cf866 121deg 160deg, transparent 161deg), linear-gradient(160deg, #0c0f1c 0%, #070810 100%)",
    shaderId: "objects",
    params: [
      P.color(),
      P.bgColor(),
      { key: "metalness", label: "Metalness", kind: "number", min: 0, max: 1, step: 0.05 },
      { key: "roughness", label: "Roughness", kind: "number", min: 0, max: 1, step: 0.05 },
      { key: "rotationSpeed", label: "Spin", kind: "number", min: 0, max: 2, step: 0.05 },
      { key: "floatAmplitude", label: "Float", kind: "number", min: 0, max: 1, step: 0.05 },
      { key: "cameraDistance", label: "Camera", kind: "number", min: 2.5, max: 12, step: 0.25 },
      P.mouseControls(), P.touchControls(), P.gyroControls(),
    ],
    defaults: { color: "#818cf8", backgroundColor: "#0c0f1c", metalness: 0.8, roughness: 0.15, rotationSpeed: 0.35, floatAmplitude: 0.3, cameraDistance: 5.5, mouseControls: true, touchControls: true, gyroControls: false },
  },
];

export const EFFECTS_3D: Effect3DPreset[] = [
  ...VANTA_PRESETS,
  ...SHADER_PRESETS,
  ...OBJECT_PRESETS,
];

export const EFFECT_CATEGORIES: { id: EffectCategory | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "animated", label: "Animated" },
  { id: "particles", label: "Particles" },
  { id: "nature", label: "Nature" },
  { id: "abstract", label: "Abstract" },
  { id: "objects", label: "Objects" },
  { id: "interactive", label: "Interactive" },
];

const BY_ID = new Map(EFFECTS_3D.map((e) => [e.id, e]));

export function getEffect3D(id: string): Effect3DPreset | undefined {
  return BY_ID.get(id);
}

/* ------------------------------------------------------------------ */
/* Schema glue                                                         */
/* ------------------------------------------------------------------ */

/** Hex color → 0xRRGGBB int (vanta option format). */
export function hexToInt(hex: string): number {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  return parseInt(full, 16) || 0;
}

/**
 * Builds the runtime option object for an effect: schema params merged over
 * the preset defaults, with colors converted to the format each family wants.
 */
export function effectOptions(preset: Effect3DPreset, params: Record<string, unknown> | undefined): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...preset.defaults, ...(params ?? {}) };
  const out: Record<string, unknown> = {};
  for (const p of preset.params) {
    const v = merged[p.key];
    if (v === undefined) continue;
    if (p.kind === "color" && p.intColor && typeof v === "string") out[p.key] = hexToInt(v);
    else out[p.key] = v;
  }
  return out;
}

/** A Scene3DConfig value for a freshly-applied effect preset. */
export function effectConfig(preset: Effect3DPreset): Scene3DConfig {
  return {
    ...structuredClone(DEFAULT_SCENE_3D),
    mode: "effect",
    effectId: preset.id,
    effectParams: { ...preset.defaults },
  };
}

/** True when a scene3d node should render a background effect. */
export function isEffectScene(scene3d: Partial<Scene3DConfig> | undefined): boolean {
  return !!scene3d?.effectId && scene3d.effectId !== "custom";
}
