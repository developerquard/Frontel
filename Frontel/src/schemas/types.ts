/**
 * Frontel project schema — the single source of truth.
 *
 * Two pure consumers read this schema:
 *   1. the live renderer  (src/components/NodeView.tsx)
 *   2. the code generator (src/code/generator.ts)
 *
 * Nothing else may store user intent. If a property isn't here, it
 * doesn't exist and cannot appear in generated code.
 */

export type NodeId = string;
export type PageId = string;
export type AssetId = string;

export type Breakpoint = "desktop" | "tablet" | "mobile";

export const BREAKPOINT_ORDER: Breakpoint[] = ["desktop", "tablet", "mobile"];

export const DEFAULT_BREAKPOINTS: Record<Breakpoint, number> = {
  desktop: 1440,
  tablet: 768,
  mobile: 390,
};

/** Supported element types. Every entry must have: renderer, inspector, codegen. */
export type ElementType =
  // layout
  | "section"
  | "container"
  | "flex"
  | "grid"
  | "stack"
  // content
  | "heading"
  | "text"
  | "image"
  | "gif"
  | "video"
  | "icon"
  | "logo"
  // interactive
  | "button"
  | "link"
  | "input"
  | "select"
  | "checkbox"
  | "form"
  // visual
  | "divider"
  | "scene3d";

/** Elements that are shown as <form> controls and participate in form submission. */
export const FORM_CONTROL_TYPES: ElementType[] = [
  "input",
  "select",
  "checkbox",
  "form",
];

export interface Page {
  id: PageId;
  name: string; // display name ("Home", "Pricing")
  path: string; // route path ("/", "/pricing")
  rootId: NodeId;
}

export type AssetKind = "image" | "video" | "model" | "favicon" | "other";

export interface Asset {
  id: AssetId;
  name: string;
  type: AssetKind;
  /** Data URL for local uploads; https URL for remote assets. */
  src: string;
  /** Object URL for editor-only preview of local files; not serialized. */
  blobUrl?: string;
  /** Image pixel width when detectable (images only; optional). */
  width?: number;
  height?: number;
}

/* ------------------------------------------------------------------ */
/* Style model                                                         */
/* ------------------------------------------------------------------ */

export type DisplayValue = "flex" | "grid" | "block";

export type JustifyValue =
  | "flex-start"
  | "center"
  | "flex-end"
  | "space-between"
  | "space-around"
  | "space-evenly";

export type AlignValue = "stretch" | "flex-start" | "center" | "flex-end";

export type SizeValue =
  | { kind: "auto" }
  | { kind: "fill" }
  | { kind: "hug" }
  | { kind: "fixed"; value: number; unit: "px" | "%" | "vh" | "vw" };

export interface StyleProps {
  display?: DisplayValue;
  flexDirection?: "row" | "column";
  justify?: JustifyValue;
  align?: AlignValue;
  wrap?: boolean;
  gap?: number;
  padding?: [number, number, number, number]; // top right bottom left
  margin?: [number, number, number, number];
  width?: SizeValue;
  height?: SizeValue;
  maxWidth?: number | null;
  background?: string; // any CSS color / gradient string
  borderRadius?: number;
  borderWidth?: number;
  borderColor?: string;
  opacity?: number; // 0..1
  overflow?: "visible" | "hidden";
  position?: "static" | "relative" | "absolute";
  /** Free-form offset from the containing block's left edge (px). Used with position absolute. */
  left?: number;
  /** Free-form offset from the containing block's top edge (px). Used with position absolute. */
  top?: number;
  /** Stack order among positioned siblings. */
  zIndex?: number;
  cursor?: "auto" | "pointer";
  /**
   * Creates a stacking context (CSS `isolation: isolate`). Set on a box that
   * hosts a 3D backdrop: the scene sits at z-index -1, so it paints above the
   * host's own background but behind the host's content — and can never escape
   * behind an ancestor's background instead.
   */
  isolation?: boolean;

  // typography
  fontSize?: number;
  fontWeight?: number;
  lineHeight?: number;
  letterSpacing?: number;
  color?: string;
  textAlign?: "left" | "center" | "right";
  /**
   * Font id from schemas/fonts ("inter", "space-grotesk", "playfair", …).
   * Unknown values are treated as a literal CSS font stack, so imported
   * projects keep working.
   */
  fontFamily?: string;
  textTransform?: "none" | "uppercase" | "lowercase" | "capitalize";
  fontStyle?: "normal" | "italic";
  textDecoration?: "none" | "underline" | "line-through";
  /**
   * Gradient text: any CSS gradient string (or theme token). Rendered by
   * clipping the background to the glyphs — the browser port of the same
   * declaration, so editor and export agree.
   */
  textGradient?: string;
  /** Outline thickness in px, drawn with -webkit-text-stroke. 0 = off. */
  textStrokeWidth?: number;
  textStrokeColor?: string;
  /** Any CSS text-shadow. Takes precedence over textGlow when both are set. */
  textShadow?: string;
  /**
   * Structured glow: a colored halo behind the glyphs. Stored as numbers so
   * the Inspector can offer real sliders instead of a CSS string to hand-edit.
   * `spread` is the radius multiplier of the second (wider) halo, 0 = single.
   */
  textGlow?: { color: string; blur: number; spread?: number };
  /** Any CSS box-shadow. */
  boxShadow?: string;
  /** Backdrop blur radius in px (frosted glass). */
  backdropBlur?: number;
  /** Element blur radius in px. */
  blur?: number;
  /** Rotation in degrees (independent CSS rotate, so it mixes with animations). */
  rotate?: number;
  /** Uniform scale (independent CSS scale property). */
  scale?: number;

  // grid
  gridColumns?: number;
  gridRows?: number;

  // visibility override
  visible?: boolean;

  // image-specific
  objectFit?: "cover" | "contain" | "fill";
  objectPosition?: string;

  // divider-specific
  thickness?: number;
  orientation?: "horizontal" | "vertical";

  minHeight?: number | string;
}

export interface StyleSet {
  base: StyleProps;
  /** Overrides merged over base when viewport is at most the tablet breakpoint. */
  tablet?: StyleProps;
  /** Overrides merged over base+tablet when viewport is at most the mobile breakpoint. */
  mobile?: StyleProps;
}

/* ------------------------------------------------------------------ */
/* Animation model                                                     */
/* ------------------------------------------------------------------ */

export type AnimationType =
  | "fade"
  | "fade-up"
  | "fade-down"
  | "slide-left"
  | "slide-right"
  | "zoom-in"
  | "hover-lift"
  | "hover-glow"
  | "hover-scale"
  | "hover-brighten"
  | "parallax"
  | "scroll-progress"
  | "background-transition";

export type AnimationTrigger = "on-load" | "on-scroll" | "continuous";

export type Easing =
  | "ease-out"
  | "ease-in"
  | "ease-in-out"
  | "linear"
  | "spring";

export interface AnimationSpec {
  type: AnimationType;
  trigger: AnimationTrigger;
  duration: number; // ms
  delay: number; // ms
  easing: Easing;
  /** Parallax intensity multiplier, 0..1 (1 = full viewport-relative drift). */
  intensity?: number;
  /** Background transition colors [from, to]. */
  colors?: [string, string];
}

/* ------------------------------------------------------------------ */
/* Interaction model                                                   */
/* ------------------------------------------------------------------ */

export type Interaction =
  | { kind: "navigate"; path: string }
  | { kind: "scroll-to"; anchorId: string }
  | { kind: "open-url"; url: string }
  | { kind: "submit-api"; method: "POST" | "PUT" | "PATCH"; url: string }
  | { kind: "none" };

/** What a <form> does when submitted. API calls are honest: no fabricated success. */
export type FormAction =
  | { kind: "none" }
  | { kind: "navigate"; path: string }
  | { kind: "submit-api"; method: "POST" | "PUT" | "PATCH"; url: string };

/* ------------------------------------------------------------------ */
/* Element props (non-style content)                                   */
/* ------------------------------------------------------------------ */

export interface ElementProps {
  // heading / text
  text?: string;
  // heading
  level?: 1 | 2 | 3 | 4 | 5 | 6;
  // image / gif / video / logo
  assetId?: AssetId | null;
  alt?: string;
  // icon
  icon?: string; // icon name from registry
  // button / link
  label?: string;
  href?: string; // internal path or external URL
  variant?: "primary" | "secondary" | "ghost" | "outline";
  // video
  autoplay?: boolean;
  loop?: boolean;
  muted?: boolean;
  controls?: boolean;
  // input
  placeholder?: string;
  inputType?: "text" | "email" | "password" | "number" | "tel";
  required?: boolean;
  // select
  options?: string[];
  // form
  action?: FormAction;
  // generic key/value passthrough (future-proof, currently unused)
  [key: string]: unknown;
}

/* ------------------------------------------------------------------ */
/* 3D scene                                                            */
/* ------------------------------------------------------------------ */

export type Object3DShape = "torus-knot" | "icosahedron" | "box" | "sphere";

/** How the scene renders: procedural shape, preset effect, or raw GLSL shader. */
export type Scene3DMode = "shape" | "effect" | "shader";

export interface Scene3DConfig {
  shape: Object3DShape;
  /**
   * Rendering mode. "shape" = procedural three.js object (classic behavior);
   * "effect" = a preset 3D background effect from the effects registry
   * (vanta.js modules + in-house shaders); "shader" = raw GLSL background
   * with a custom fragment body.
   */
  mode?: Scene3DMode;
  /** Effect preset id when mode === "effect" (see schemas/effects3d.ts). */
  effectId?: string;
  /** Per-effect parameter values; keyed by EffectParamDef.key. */
  effectParams?: Record<string, number | string | boolean>;
  /** Full GLSL fragment body when mode === "shader". Receives uniforms:
   *  iTime, iResolution, iMouse, uColorA/B/C, uSpeed, uZoom. */
  shaderCode?: string;
  /** Effect backgrounds fill their box like a backdrop (no letterboxing). */
  background?: boolean;
  /** Optional GLB/GLTF model asset replacing the procedural shape. */
  modelAssetId?: string | null;
  /** Uniform scale applied to the loaded model. 1 = authored size. */
  modelScale?: number;
  /** Material color. */
  color: string;
  /** Auto-rotation speed, radians per second. 0 = off. */
  rotationSpeed: number;
  /** Vertical floating amplitude in units. 0 = off. */
  floatAmplitude: number;
  /** Camera distance. */
  cameraDistance: number;
  /** How strongly page scroll drives rotation, 0..1. */
  scrollInfluence: number;
  wireframe: boolean;
}

export const DEFAULT_SCENE_3D: Scene3DConfig = {
  mode: "shape",
  shape: "torus-knot",
  color: "#2dd4bf",
  rotationSpeed: 0.4,
  floatAmplitude: 0.25,
  cameraDistance: 5,
  scrollInfluence: 0.3,
  wireframe: false,
};

/* ------------------------------------------------------------------ */
/* Nodes                                                               */
/* ------------------------------------------------------------------ */

export interface ElementNode {
  id: NodeId;
  type: ElementType;
  /** Human name, e.g. "Hero" — drives generated component names. */
  name: string;
  props: ElementProps;
  style: StyleSet;
  children: NodeId[];
  /** Anchor for scroll-to interactions. */
  anchorId?: string;
  /** Click interaction (buttons, links, images). */
  onClick?: Interaction;
  /** Entrance / continuous animation config. */
  animation?: AnimationSpec;
  /** 3D scene config (scene3d only). */
  scene3d?: Scene3DConfig;
}

export interface Project {
  /** Schema version for forward compatibility / migrations. */
  version: 1;
  id: string;
  name: string;
  /** Route path of the page shown first. */
  homePageId: PageId;
  pages: Page[];
  nodes: Record<NodeId, ElementNode>;
  assets: Record<AssetId, Asset>;
  /** Project theme tokens referenced by generated CSS variables. */
  theme: ProjectTheme;
  updatedAt: number;
}

export interface ProjectTheme {
  colors: {
    background: string;
    surface: string;
    text: string;
    textMuted: string;
    primary: string;
    primaryContrast: string;
    border: string;
  };
  font: string;
  /** Font id from schemas/fonts, so exports can load the real webfont. */
  fontId?: string;
  radius: number;
  /** Template id when the theme came from a preset (display only). */
  templateId?: string;
}

export interface ThemeTemplate {
  id: string;
  name: string;
  description: string;
  swatch: string;
  theme: Omit<ProjectTheme, "templateId">;
}
