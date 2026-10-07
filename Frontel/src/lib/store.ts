import { create } from "zustand";
import { get as idbGet, set as idbSet } from "idb-keyval";
import {
  cloneProject,
  makeNode,
  makePage,
  makeScratchProject,
  uid,
} from "@/schemas/factory";
import { isContainerType } from "@/schemas/registry";
import { buildSection } from "@/schemas/sections";
import {
  cloneSubtree,
  detachNode,
  findParentId,
  insertIntoParent,
  mergeStyle,
  moveWithinParent,
  removeSubtree,
  subtreeIds,
} from "./tree";
import { DEFAULT_SCENE_3D } from "@/schemas/types";
import type { Scene3DConfig } from "@/schemas/types";
import { createNodeAt, ensureFreeformLayer, ensureLayerHost, isFreeformLayer, normalizeProjects } from "@/lib/freeform";
import { canvasLayerId, GRID_CELL, snap as gridSnap } from "./grid";
import { nodeRectInFrame } from "./frame";
import type {
  Asset,
  AssetId,
  AssetKind,
  Breakpoint,
  ElementNode,
  ElementType,
  Interaction,
  NodeId,
  Page,
  PageId,
  Project,
  ProjectTheme,
  StyleProps,
} from "@/schemas/types";

/* ------------------------------------------------------------------ */
/* Storage layer (IndexedDB via idb-keyval)                            */
/* ------------------------------------------------------------------ */

const STORE_KEY = "frontel:projects";

async function loadProjects(): Promise<Project[]> {
  try {
    const raw = (await idbGet(STORE_KEY)) as Project[] | undefined;
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

async function saveOne(project: Project): Promise<void> {
  try {
    const all = await loadProjects();
    const idx = all.findIndex((p) => p.id === project.id);
    if (idx >= 0) all[idx] = project;
    else all.push(project);
    await idbSet(STORE_KEY, all);
  } catch {
    /* storage unavailable — session-only editing */
  }
}

async function deleteStored(id: string): Promise<void> {
  try {
    const all = await loadProjects();
    await idbSet(STORE_KEY, all.filter((p) => p.id !== id));
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------------------ */
/* Store                                                               */
/* ------------------------------------------------------------------ */

export type Viewport = Breakpoint;

export type SaveState = "idle" | "saving" | "saved";

/** Canvas creation tools. "select" is the default cursor tool. */
export type CanvasTool = "select" | "text" | "heading" | "button" | "image" | "scene3d";

export const TOOL_ELEMENT: Record<Exclude<CanvasTool, "select">, ElementType> = {
  text: "text",
  heading: "heading",
  button: "button",
  image: "image",
  scene3d: "scene3d",
};

export interface EditorState {
  /** Autosave status, shown in the topbar. */
  saveState: SaveState;
  /** Live drag payload while dragging on the canvas or from the palette. */
  drag: {
    kind: "node" | "new" | "asset" | "effect";
    id?: NodeId;
    type?: ElementType;
    section?: string;
    assetId?: string;
    effectId?: string;
    label: string;
    /** Style patch carried by style presets (text variants, surfaces). */
    style?: Partial<StyleProps>;
    /** Props for the created node (text, level, label, href…). */
    props?: Partial<ElementNode["props"]>;
  } | null;
  /** Where a canvas/tree drop would land; drives insertion indicators. "absolute" = freeform placement. */
  dropTarget: { parentId: NodeId; index: number; mode: "inside" | "before" | "after" | "absolute"; rectKey: string } | null;
  setDrag: (d: EditorState["drag"]) => void;
  setDropTarget: (d: EditorState["dropTarget"]) => void;

  /** Active canvas creation tool ("select" = default cursor). */
  tool: CanvasTool;
  setTool: (t: CanvasTool) => void;

  /** Snap placement, sizing and nudging to the box grid (toggle with G). */
  snapToGrid: boolean;
  toggleSnapToGrid: () => void;

  projects: Project[];
  activeProjectId: string | null;
  activePageId: PageId | null;
  selectedId: NodeId | null;
  hoveredId: NodeId | null;
  viewport: Viewport;
  past: Project[];
  future: Project[];
  loaded: boolean;

  bootstrap: () => Promise<void>;
  getProject: () => Project | null;
  getPage: () => Page | null;

  createProject: (name: string, project?: Project) => Project;
  importProject: (project: Project) => void;
  renameProject: (id: string, name: string) => void;
  duplicateProject: (id: string) => void;
  deleteProject: (id: string) => void;
  resetProject: (id: string) => void;
  openProject: (id: string) => void;
  closeProject: () => void;

  select: (id: NodeId | null) => void;
  hover: (id: NodeId | null) => void;
  setViewport: (v: Viewport) => void;

  /**
   * Direct creation: place a brand-new node freely at absolute (left, top).
   * Sizing comes from the drawn rectangle (draw-to-create) or a default box.
   * `parentId` is the host box under the pointer; without it the page's canvas
   * layer hosts the node. Either way the host is promoted to position:relative
   * and grown so the new box is never clipped.
   */
  createAtPoint: (type: ElementType, opts?: {
    left?: number;
    top?: number;
    width?: number;
    height?: number;
    /** Host container for the free placement. */
    parentId?: NodeId;
    /** Min-height the host needs so the new box is never clipped. */
    hostMinHeight?: number;
    props?: ElementNode["props"];
    style?: Partial<StyleProps>;
    /** Display name (style presets name their node after the variant). */
    name?: string;
    /** 3D scene config (effect/model) applied in the SAME history step. */
    scene3d?: Partial<Scene3DConfig>;
  }) => NodeId | null;
  /**
   * Moves an absolutely-positioned node by setting left/top on the active
   * responsive layer. Flow layout is untouched.
   */
  placeAbsolute: (id: NodeId, left: number, top: number, opts?: { zIndex?: number; snap?: boolean }) => void;
  /** Nudges an absolute node with arrow keys (shift = bigger steps). */
  nudgeAbsolute: (id: NodeId, dx: number, dy: number) => void;
  /**
   * Resizes an absolute node by dragging its overlay handles. `startPx` is
   * the measured box size at drag start — %-sized nodes convert to px
   * instead of compounding percentages. `start` carries the node's left/top so
   * the left/top edges move the box as they resize.
   */
  resizeAbsolute: (
    id: NodeId,
    edge: "left" | "right" | "top" | "bottom",
    deltaPx: number,
    startPx: number,
    start?: { left: number; top: number },
    opts?: { snap?: boolean },
  ) => void;
  /** Reorders an absolutely-positioned node among its positioned siblings. */
  reorderAbsolute: (id: NodeId, dir: 1 | -1) => void;
  /** Sets z-index for layering among positioned siblings. */
  setZIndex: (id: NodeId, z: number | undefined) => void;
  /** Finds the absolute-positioned layer a node should live in. */
  findFreeformLayerFor: (pageId: PageId) => NodeId | null;
  /** Adds (or focuses) the page's canvas layer as the page's first child. */
  addFreeformLayer: () => NodeId | null;

  /**
   * Free placement — the editor's default drop. Reparents `id` into `hostId`
   * (any container; promoted to position:relative when needed), positions it
   * absolutely at (left, top) on the box grid, brings it to the front of its
   * new host and grows the host so the box is never clipped.
   * ONE history entry: a drop is a single undo step.
   */
  dropFree: (id: NodeId, opts: {
    hostId: NodeId;
    left: number;
    top: number;
    /**
     * Min-height the host needs so this box is not clipped. Callers measure the
     * host first and only pass a value when it is genuinely too short, so the
     * growth rides along in the same undo step as the drop.
     */
    hostMinHeight?: number;
    /** Explicit stacking order; defaults to the top of the host. */
    zIndex?: number;
    /** false = exact placement, no box snapping (Alt). */
    snap?: boolean;
    /**
     * Fixes the box's rendered size at drop time. Flow children stretched by
     * their host shrink-wrap once freed — pinning keeps the promise the ghost
     * made (what the outline showed is exactly what lands).
     */
    pinSize?: { w: number; h: number };
  }) => void;
  /**
   * Layout drop (Shift): reparents a node AND lets go of its free placement in
   * one transaction, so an element dragged from anywhere really joins the flow
   * of the box it was dropped on.
   */
  dropToLayout: (id: NodeId, parentId: NodeId, index: number) => void;
  /** Converts any node to free placement, keeping it where it currently sits. */
  makeFree: (id: NodeId, at?: { left: number; top: number }, opts?: { pinSize?: { w: number; h: number } }) => void;
  /** Returns a free node to its host's flow layout. */
  makeFlow: (id: NodeId) => void;
  /** Grows a host's min-height so free children are never clipped. */
  fitHostHeight: (hostId: NodeId, neededPx: number) => void;
  /**
   * Grows a host so one of its free children fits. Measures the child's height
   * from the DOM (accurate for auto/% sizes) and positions from the schema, so
   * it stays correct even before React re-renders the move.
   */
  fitHostToNode: (id: NodeId, hostId: NodeId) => void;

  /**
   * Adds an element in flow at the end of a container. `opts` carries the
   * style preset / props a gallery card wants (applied inside the same
   * history step, so adding a styled variant is one undo).
   */
  addElement: (type: ElementType, parentId?: NodeId | null, opts?: NewNodeOptions) => NodeId | null;
  /** Adds a node at a precise sibling position (drop targets / arrows). */
  addElementAt: (type: ElementType, parentId: NodeId, index: number, opts?: NewNodeOptions) => NodeId | null;
  /** Adds a ready-made section preset as a top-level block of the page. */
  addSectionAt: (presetId: string, index?: number) => NodeId | null;
  /** Resizes the selected node within its flex/grid layout (layout-aware). */
  resizeNode: (id: NodeId, deltaPx: number, edge: "left" | "right" | "top" | "bottom", startPx: number) => void;
  deleteElement: (id: NodeId) => void;
  duplicateElement: (id: NodeId) => NodeId | null;
  renameElement: (id: NodeId, name: string) => void;
  reorder: (id: NodeId, dir: -1 | 1) => void;
  moveRelative: (id: NodeId, parentId: NodeId, index: number) => void;
  setProp: (id: NodeId, key: string, value: unknown) => void;
  setStyle: (id: NodeId, bp: "base" | "tablet" | "mobile", patch: Partial<StyleProps>) => void;
  clearStyleLayer: (id: NodeId, bp: "tablet" | "mobile") => void;
  setInteraction: (id: NodeId, onClick: Interaction | undefined) => void;
  setAnimation: (id: NodeId, animation: ElementNode["animation"]) => void;
  setScene3D: (id: NodeId, patch: Partial<ElementNode["scene3d"]>) => void;
  /**
   * Applies a 3D effect as the BACKGROUND of a box, in ONE history step: the
   * scene fills the host (absolute inset 0) and paints behind the host's own
   * content, so nothing moves and a single Ctrl+Z removes the whole effect
   * instead of leaving a default 3D model behind. When the host is the page
   * root, the scene lives in the page's canvas layer (a real page background).
   */
  addSceneBackdrop: (hostId: NodeId, config: Partial<Scene3DConfig>, name?: string) => NodeId | null;
  setAnchor: (id: NodeId, anchorId: string) => void;

  addPage: (name: string, path: string) => void;
  deletePage: (pageId: PageId) => void;
  setActivePage: (pageId: PageId) => void;

  addAsset: (asset: Asset) => void;
  removeAsset: (id: string) => void;
  /** Adds an uploaded file, auto-classifying its kind. Returns the asset id. */
  addAssetFromFile: (file: File) => Promise<AssetId | null>;

  setTheme: (patch: Partial<ProjectTheme>) => void;

  undo: () => void;
  redo: () => void;
}

const HISTORY_LIMIT = 50;
let saveTimer: number | undefined;

/**
 * Classifies an uploaded file into an asset kind by MIME type, falling back
 * to extension sniffing for files the browser reports generically.
 */
export function assetKindFor(file: File): AssetKind {
  const type = (file.type || "").toLowerCase();
  if (type.startsWith("image/")) {
    return /svg|icon/.test(type) || /(^|\.)(favicon|apple-touch-icon)/i.test(file.name)
      ? "favicon"
      : "image";
  }
  if (type === "video/mp4" || type === "video/webm") return "video";
  if (type === "model/gltf-binary" || type === "model/gltf+json") return "model";
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  if (["png", "jpg", "jpeg", "webp", "avif", "gif", "bmp"].includes(ext)) return "image";
  if (["svg", "ico"].includes(ext)) return "favicon";
  if (["mp4", "webm", "mov", "m4v"].includes(ext)) return "video";
  if (["glb", "gltf"].includes(ext)) return "model";
  return "other";
}

function schedulePersist(get: () => EditorState, set: (partial: Partial<EditorState>) => void) {
  window.clearTimeout(saveTimer);
  const begin = get();
  if (begin.saveState !== "saving") set({ saveState: "saving" });
  saveTimer = window.setTimeout(() => {
    const active = get().getProject();
    if (active) {
      void saveOne(active).then(() => set({ saveState: "saved" }));
    }
  }, 400);
}

function withHistory(
  state: EditorState,
  mutator: (project: Project) => Project,
): Partial<EditorState> {
  const project = state.getProject();
  if (!project) return {};
  const next = mutator(structuredClone(project));
  next.updatedAt = Date.now();
  return {
    past: [...state.past, project].slice(-HISTORY_LIMIT),
    future: [],
    projects: state.projects.map((p) => (p.id === next.id ? next : p)),
  };
}

/** Highest z-index among a host's children, +1 — new drops land on top. */
function topZ(nodes: Record<NodeId, ElementNode>, children: NodeId[]): number {
  let max = 0;
  for (const childId of children) {
    const z = nodes[childId]?.style.base.zIndex;
    if (typeof z === "number" && z > max) max = z;
  }
  return max + 1;
}

/** Applies a style preset / props bundle to a node before it is inserted. */
function applyNewNodeOptions(node: ElementNode, opts: NewNodeOptions | undefined): void {
  if (!opts) return;
  if (opts.name) node.name = opts.name;
  if (opts.props) node.props = { ...node.props, ...opts.props };
  if (opts.style) node.style = { base: { ...node.style.base, ...opts.style } };
}

/** Style without any free-placement properties (returns a node to flow). */
function withoutPosition(style: StyleProps | undefined): StyleProps {
  const out: StyleProps = { ...(style ?? {}) };
  delete out.position;
  delete out.left;
  delete out.top;
  delete out.zIndex;
  return out;
}

/** Style preset / props applied to a freshly created node, in one history step. */
export interface NewNodeOptions {
  /** Display name, e.g. the text variant's label. */
  name?: string;
  props?: Partial<ElementNode["props"]>;
  style?: Partial<StyleProps>;
}

interface FreePlacement {
  /** Target container. The page root is allowed — it resolves to the canvas layer. */
  hostId: NodeId;
  pageRootId: NodeId;
  /** Host-relative top-left, already snapped. */
  left: number;
  top: number;
  /** Breakpoint layer the placement is authored on (mirrored onto base). */
  layer: "base" | "tablet" | "mobile";
  zIndex?: number;
  /** Min-height the host needs so the box is never clipped. */
  hostMinHeight?: number;
  /**
   * Pins the box's rendered size at drop time: a flow child stretched by its
   * host would shrink-wrap once freed, landing smaller than the ghost promised.
   * Axes the node itself declares as `fill` are left fluid — see placeFreeNodes.
   */
  pinSize?: { w: number; h: number };
}

/**
 * True when the node's axis is authored as `fill` on the layer being edited:
 * an explicit "stretch to my host" instruction that free placement must not
 * overwrite with a pixel size. `width: 100%` on an absolutely-positioned box
 * still resolves against its host, so the intent survives freeing.
 */
function fillsAxis(
  style: ElementNode["style"],
  layer: "base" | "tablet" | "mobile",
  axis: "width" | "height",
): boolean {
  const bp = layer === "base" ? "desktop" : layer;
  const effective = mergeStyle(style.base, style.tablet, style.mobile, bp);
  const size = effective[axis];
  // A percentage is a host-relative instruction too: pinning a 100%-wide
  // backdrop to its current pixels is what turned a full-bleed background into
  // a 1280px slab the moment it was dragged into a section.
  return size?.kind === "fill" || (size?.kind === "fixed" && size.unit === "%");
}

/**
 * Places an existing node freely inside a container. Any container can host
 * free children: a static one is promoted to position:relative here, because
 * only a positioned host can anchor absolutely-positioned children. The drop
 * lands on top of its new siblings and grows the host past its own bottom edge.
 *
 * Mutator-style: takes the cloned project from withHistory, returns the next
 * nodes map (unchanged when the placement is invalid — e.g. dropping a node
 * into its own subtree).
 */
function placeFreeNodes(p: Project, nodeId: NodeId, place: FreePlacement): Project["nodes"] {
  let nodes = p.nodes;
  if (!nodes[nodeId]) return nodes;

  let hostId = place.hostId;
  // Empty page space has no box of its own: the page's canvas layer becomes the
  // host, created on demand as the page's first child (behind the flow).
  if (hostId === place.pageRootId) {
    const { layerId, created } = ensureFreeformLayer(p, place.pageRootId);
    if (created[layerId]) {
      nodes = insertIntoParent({ ...nodes, ...created }, place.pageRootId, layerId, 0);
    }
    nodes = ensureLayerHost(nodes, place.pageRootId);
    hostId = layerId;
  }
  // Never place a node inside its own subtree, and never into a missing host.
  if (!nodes[hostId] || subtreeIds(nodes, nodeId).includes(hostId)) return nodes;

  const host = nodes[hostId];
  const hostPosition = host.style.base.position;
  if (hostPosition !== "relative" && hostPosition !== "absolute") {
    nodes = {
      ...nodes,
      [hostId]: {
        ...host,
        style: { ...host.style, base: { ...host.style.base, position: "relative" } },
      },
    };
  }

  const patch: Partial<StyleProps> = {
    position: "absolute",
    left: place.left,
    top: place.top,
    zIndex: place.zIndex ?? topZ(nodes, nodes[hostId].children),
  };
  // Pin the promised size: what the ghost outlined is exactly what lands. An
  // axis the box itself declares as `fill` keeps filling instead — freezing it
  // to today's pixels is what made freed full-width bars stop following the
  // window (they stayed ~1200px wide while the page around them grew).
  if (place.pinSize) {
    if (!fillsAxis(nodes[nodeId].style, place.layer, "width")) {
      patch.width = { kind: "fixed", value: Math.max(GRID_CELL, Math.round(place.pinSize.w)), unit: "px" };
    }
    if (!fillsAxis(nodes[nodeId].style, place.layer, "height")) {
      patch.height = { kind: "fixed", value: Math.max(GRID_CELL, Math.round(place.pinSize.h)), unit: "px" };
    }
  }
  nodes = detachNode(nodes, nodeId);
  const node = nodes[nodeId];
  const style = { ...node.style };
  style.base = { ...style.base, ...patch };
  // Mirror onto the active breakpoint layer so free placement feels 1:1 at
  // every width (the same rule placeAbsolute follows).
  if (place.layer !== "base") style[place.layer] = { ...style[place.layer], ...patch };
  nodes = { ...nodes, [nodeId]: { ...node, style } };
  nodes = insertIntoParent(nodes, hostId, nodeId, nodes[hostId].children.length);

  // Never clip free children: grow past the box's bottom edge. The canvas layer
  // is out of flow, so its growth has to be applied to the page it overlays —
  // growing the layer itself would just let the box spill out of the page.
  const growthId = isFreeformLayer(nodes[hostId])
    ? (findParentId(nodes, hostId) ?? hostId)
    : hostId;
  if (place.hostMinHeight !== undefined) {
    nodes = growMinHeight(nodes, growthId, place.hostMinHeight);
  }
  return nodes;
}

/**
 * Raises a box's min-height to `neededPx`, never lowering it. A viewport-relative
 * min-height ("100vh", the page root's default) is preserved as a CSS max() so
 * the page keeps filling the window while still growing for its content.
 */
function growMinHeight(
  nodes: Record<NodeId, ElementNode>,
  hostId: NodeId,
  neededPx: number,
): Record<NodeId, ElementNode> {
  const host = nodes[hostId];
  if (!host) return nodes;
  const needed = Math.max(0, Math.round(neededPx));
  const current = host.style.base.minHeight;
  let next: number | string;
  if (typeof current === "number") {
    if (needed <= current) return nodes;
    next = needed;
  } else if (typeof current === "string") {
    const px = /(\d+)px\s*\)?$/.exec(current);
    if (px && Number(px[1]) >= needed) return nodes;
    next = px ? current.replace(/\d+px(\s*\))?$/, `${needed}px$1`) : `max(${current}, ${needed}px)`;
  } else {
    next = needed;
  }
  return {
    ...nodes,
    [hostId]: {
      ...host,
      style: { ...host.style, base: { ...host.style.base, minHeight: next } },
    },
  };
}

export const useEditor = create<EditorState>((set, get) => ({
  projects: [],
  activeProjectId: null,
  activePageId: null,
  selectedId: null,
  hoveredId: null,
  viewport: "desktop",
  past: [],
  future: [],
  loaded: false,
  saveState: "idle",
  drag: null,
  dropTarget: null,

  setDrag: (d) => set({ drag: d }),
  setDropTarget: (d) => set({ dropTarget: d }),

  bootstrap: async () => {
    // Stored projects predate the overlay canvas layer; normalize on load so an
    // old page background stops shoving its sections down the page.
    set({ projects: normalizeProjects(await loadProjects()), loaded: true });
  },

  getProject: () => {
    const s = get();
    return s.projects.find((p) => p.id === s.activeProjectId) ?? null;
  },

  getPage: () => {
    const s = get();
    const project = s.getProject();
    if (!project) return null;
    return project.pages.find((p) => p.id === s.activePageId) ?? null;
  },

  /* ---------------- project management ---------------- */

  createProject: (name, project) => {
    const p = project ? normalizeProjects([project])[0] : makeScratchProject(name);
    if (!project) p.name = name;
    p.updatedAt = Date.now();
    set((s) => ({
      projects: [...s.projects, p],
      activeProjectId: p.id,
      activePageId: p.homePageId,
      selectedId: null,
      past: [],
      future: [],
    }));
    void saveOne(p);
    return p;
  },

  importProject: (project) => {
    get().createProject(project.name, { ...project, id: uid("prj") });
  },

  renameProject: (id, name) =>
    set((s) => ({
      projects: s.projects.map((p) =>
        p.id === id ? { ...p, name, updatedAt: Date.now() } : p,
      ),
    })),

  duplicateProject: (id) =>
    set((s) => {
      const src = s.projects.find((p) => p.id === id);
      if (!src) return {};
      const copy = cloneProject(src, `${src.name} copy`);
      return { projects: [...s.projects, copy] };
    }),

  deleteProject: (id) =>
    set((s) => {
      void deleteStored(id);
      const wasActive = s.activeProjectId === id;
      return {
        projects: s.projects.filter((p) => p.id !== id),
        activeProjectId: wasActive ? null : s.activeProjectId,
        activePageId: wasActive ? null : s.activePageId,
      };
    }),

  resetProject: (id) =>
    set((s) => {
      const src = s.projects.find((p) => p.id === id);
      if (!src) return {};
      const fresh = makeScratchProject(src.name);
      fresh.id = src.id;
      const isActive = s.activeProjectId === id;
      void saveOne(fresh);
      return {
        projects: s.projects.map((p) => (p.id === id ? fresh : p)),
        past: isActive ? [] : s.past,
        future: isActive ? [] : s.future,
        activePageId: isActive ? fresh.homePageId : s.activePageId,
        selectedId: isActive ? null : s.selectedId,
      };
    }),

  openProject: (id) =>
    set((s) => {
      const p = s.projects.find((x) => x.id === id);
      if (!p) return {};
      return {
        activeProjectId: id,
        activePageId: p.homePageId,
        selectedId: null,
        past: [],
        future: [],
      };
    }),

  closeProject: () =>
    set({ activeProjectId: null, activePageId: null, selectedId: null, past: [], future: [] }),

  /* ---------------- selection / viewport ---------------- */

  tool: "select",
  setTool: (t) => set({ tool: t }),

  snapToGrid: true,
  toggleSnapToGrid: () => set((s) => ({ snapToGrid: !s.snapToGrid })),

  select: (id) => set({ selectedId: id, dropTarget: null }),
  hover: (id) => set({ hoveredId: id }),
  setViewport: (v) => set({ viewport: v }),

  /* ---------------- direct creation / freeform ---------------- */

  findFreeformLayerFor: (pageId) => {
    const s = get();
    const project = s.getProject();
    const page = project?.pages.find((p) => p.id === pageId);
    if (!project || !page) return null;
    for (const childId of project.nodes[page.rootId]?.children ?? []) {
      const node = project.nodes[childId];
      if (node && node.props?.freeformLayer === true) return node.id;
    }
    return null;
  },

  createAtPoint: (type, opts = {}) => {
    const state = get();
    const project = state.getProject();
    const page = state.getPage();
    if (!project || !page) return null;
    // Draw-to-create lands on box edges too, so new boxes line up with the grid
    // and with everything dragged into place.
    const placed =
      state.snapToGrid && opts.left !== undefined
        ? { ...opts, left: gridSnap(opts.left), top: gridSnap(opts.top ?? 0) }
        : opts;
    const node = createNodeAt(project, type, placed);
    const layer: "base" | "tablet" | "mobile" =
      state.viewport === "desktop" ? "base" : (state.viewport as "tablet" | "mobile");
    // Fresh nodes are free by default: positioned absolutely inside the host
    // under the pointer (`parentId`), or inside the page's canvas layer.
    const next = withHistory(state, (p) => ({
      ...p,
      nodes: placeFreeNodes({ ...p, nodes: { ...p.nodes, [node.id]: node } }, node.id, {
        hostId: opts.parentId ?? page.rootId,
        pageRootId: page.rootId,
        left: Math.round(placed.left ?? 0),
        top: Math.round(placed.top ?? 0),
        layer,
        zIndex: opts.style?.zIndex,
        hostMinHeight: opts.hostMinHeight,
      }),
    }));
    set({ ...next, selectedId: node.id });
    schedulePersist(get, set);
    return node.id;
  },

  /**
   * Applies a 3D effect as the background of a box — one history step.
   *
   * The scene is a child of the host, pinned to its edges and painted behind the
   * host's content (z-index -1 inside the host's own stacking context), so the
   * host's size never changes: adding a "background" moves nothing, and a single
   * Ctrl+Z removes the effect whole (it used to take four steps, so undoing once
   * re-exposed the scene node with its DEFAULT torus-knot model — the 3D model
   * that "appeared by itself" after undo).
   */
  addSceneBackdrop: (hostId, config, name) => {
    const state = get();
    const project = state.getProject();
    const page = state.getPage();
    if (!project || !page) return null;
    // A page-level background belongs in the page's canvas layer, which is the
    // one box the app keeps behind every section.
    const targetId =
      hostId === page.rootId ? (canvasLayerId(project, page.rootId) ?? page.rootId) : hostId;
    const host = project.nodes[targetId];
    if (!host || !isContainerType(host.type)) return null;

    // One backdrop per box: picking another effect updates it in place instead
    // of stacking a second, invisible scene on top of the first.
    const existing = host.children
      .map((cid) => project.nodes[cid])
      .find(
        (n) =>
          n &&
          n.type === "scene3d" &&
          n.style.base.position === "absolute" &&
          n.style.base.zIndex === -1,
      );
    const sceneId = existing?.id ?? uid("scene3d");

    const next = withHistory(state, (p) => {
      let nodes = { ...p.nodes };
      const hostNode = nodes[targetId];
      if (!hostNode) return p;
      nodes[targetId] = {
        ...hostNode,
        style: {
          ...hostNode.style,
          base: {
            ...hostNode.style.base,
            position: hostNode.style.base.position ?? "relative",
            isolation: true,
          },
        },
        children: existing ? hostNode.children : [sceneId, ...hostNode.children],
      };
      if (existing) {
        nodes[sceneId] = {
          ...existing,
          scene3d: { ...DEFAULT_SCENE_3D, ...existing.scene3d, ...config },
        };
      } else {
        // Named through the factory so "3D Background 2", "3D Background 3" …
        // stay unique in the structure tree.
        const fresh = makeNode("scene3d", p.nodes);
        nodes[sceneId] = {
          ...fresh,
          id: sceneId,
          name: name ?? fresh.name,
          props: {},
          style: {
            base: {
              position: "absolute",
              left: 0,
              top: 0,
              width: { kind: "fill" },
              height: { kind: "fill" },
              zIndex: -1,
              overflow: "hidden",
            },
          },
          scene3d: { ...DEFAULT_SCENE_3D, ...config },
          children: [],
        };
      }
      return { ...p, nodes };
    });
    set({ ...next, selectedId: sceneId });
    schedulePersist(get, set);
    return sceneId;
  },

  addFreeformLayer: () => {
    const state = get();
    const project = state.getProject();
    const page = state.getPage();
    if (!project || !page) return null;
    const existing = state.findFreeformLayerFor(page.id);
    if (existing) {
      set({ selectedId: existing });
      return existing;
    }
    const { layerId, created } = ensureFreeformLayer(project, page.rootId);
    const next = withHistory(state, (p) => ({
      ...p,
      // First child: the canvas layer starts at the top of the page and stays
      // behind the flow sections below it.
      nodes: ensureLayerHost(
        insertIntoParent({ ...p.nodes, ...created }, page.rootId, layerId, 0),
        page.rootId,
      ),
    }));
    set({ ...next, selectedId: layerId });
    schedulePersist(get, set);
    return layerId;
  },

  placeAbsolute: (id, left, top, opts) => {
    const state = get();
    const project = state.getProject();
    if (!project || !project.nodes[id]) return;
    const layer: "base" | "tablet" | "mobile" =
      state.viewport === "desktop" ? "base" : (state.viewport as "tablet" | "mobile");
    // Grid snap keeps free placements aligned with the box grid.
    // Live pointer drags pass snap:false for smooth motion and snap once on
    // release; everything else lands directly on a cell.
    const useSnap = state.snapToGrid && opts?.snap !== false;
    const patch: Partial<StyleProps> = {
      position: "absolute",
      left: useSnap ? gridSnap(left) : Math.round(left),
      top: useSnap ? gridSnap(top) : Math.round(top),
    };
    if (opts?.zIndex !== undefined) patch.zIndex = opts.zIndex;
    // Coalesce rapid pointer-move drags into one undo step.
    const last = state.past[state.past.length - 1];
    const coalesce = !!last && last.nodes[id] !== undefined;
    // Mirror onto base when editing a breakpoint layer so moves feel 1:1.
    const next = withHistory(state, (p) => {
      const node = p.nodes[id];
      const style = { ...node.style };
      style.base = { ...style.base, ...patch };
      if (layer !== "base") style[layer] = { ...style[layer], ...patch };
      return { ...p, nodes: { ...p.nodes, [id]: { ...node, style } } };
    });
    set(coalesce ? { ...next, past: state.past } : next);
    schedulePersist(get, set);
  },

  nudgeAbsolute: (id, dx, dy) => {
    const s = get();
    const node = s.getProject()?.nodes[id];
    if (!node) return;
    // Never nudge a box above/left of its host — negative space is unreachable
    // and unselectable, which is exactly how elements got stranded off-canvas.
    const left = Math.max(0, (node.style.base.left ?? 0) + dx);
    const top = Math.max(0, (node.style.base.top ?? 0) + dy);
    s.placeAbsolute(id, left, top);
  },

  resizeAbsolute: (id, edge, deltaPx, startPx, start, opts) => {
    const s = get();
    const project = s.getProject();
    if (!project || !project.nodes[id]) return;
    const layer: "base" | "tablet" | "mobile" =
      s.viewport === "desktop" ? "base" : (s.viewport as "tablet" | "mobile");
    // Resize steps in boxes too — the grid is the unit for size as well as
    // position. Alt (snap:false) gives pixel-exact resizing.
    const snapping = s.snapToGrid && opts?.snap !== false;
    const round = (v: number) =>
      Math.max(GRID_CELL, snapping ? Math.round(v / GRID_CELL) * GRID_CELL : Math.round(v));
    const grow = edge === "right" || edge === "bottom" ? 1 : -1;
    const patch: Partial<StyleProps> = {};
    if (edge === "right" || edge === "left") {
      patch.width = { kind: "fixed", value: round(startPx + grow * deltaPx), unit: "px" };
    } else {
      patch.height = { kind: "fixed", value: round(startPx + grow * deltaPx), unit: "px" };
    }
    // The left/top edges must move the box as they resize, or it would grow
    // away from the pixels the user grabbed.
    if (edge === "left" && start) patch.left = Math.max(0, round(start.left + deltaPx));
    if (edge === "top" && start) patch.top = Math.max(0, round(start.top + deltaPx));
    s.setStyle(id, layer, patch);
    if (layer !== "base") s.setStyle(id, "base", patch);
  },

  reorderAbsolute: (id, dir) => {
    const s = get();
    const project = s.getProject();
    const node = project?.nodes[id];
    if (!project || !node) return;
    const zSiblings = Object.values(project.nodes)
      .filter((n) => n.style.base.position === "absolute" && n.id !== node.id)
      .map((n) => n.style.base.zIndex ?? 0)
      .sort((a, b) => a - b);
    const cur = node.style.base.zIndex ?? 0;
    if (dir === 1) {
      const nextZ = zSiblings.find((z) => z > cur);
      s.setZIndex(id, nextZ !== undefined ? nextZ + 1 : cur + 1);
    } else {
      const prevZ = [...zSiblings].reverse().find((z) => z < cur);
      s.setZIndex(id, prevZ !== undefined ? Math.max(0, prevZ - 1) : Math.max(0, cur - 1));
    }
  },

  setZIndex: (id, z) => {
    const next = withHistory(get(), (p) => {
      const node = p.nodes[id];
      if (!node) return p;
      const base = { ...node.style.base };
      if (z === undefined) delete base.zIndex;
      else base.zIndex = z;
      return { ...p, nodes: { ...p.nodes, [id]: { ...node, style: { ...node.style, base } } } };
    });
    set(next);
    schedulePersist(get, set);
  },

  /* ---------------- free placement (the default drop) ---------------- */

  dropFree: (id, opts) => {
    const state = get();
    const project = state.getProject();
    const page = state.getPage();
    if (!project || !page || !project.nodes[id] || id === page.rootId) return;
    const layer: "base" | "tablet" | "mobile" =
      state.viewport === "desktop" ? "base" : (state.viewport as "tablet" | "mobile");
    const snapping = state.snapToGrid && opts.snap !== false;
    const next = withHistory(state, (p) => ({
      ...p,
      nodes: placeFreeNodes(p, id, {
        hostId: opts.hostId,
        pageRootId: page.rootId,
        left: snapping ? gridSnap(opts.left) : Math.round(opts.left),
        top: snapping ? gridSnap(opts.top) : Math.round(opts.top),
        layer,
        zIndex: opts.zIndex,
        hostMinHeight: opts.hostMinHeight,
        pinSize: opts.pinSize,
      }),
    }));
    set({ ...next, selectedId: id });
    schedulePersist(get, set);
  },

  dropToLayout: (id, parentId, index) => {
    const state = get();
    const project = state.getProject();
    const page = state.getPage();
    if (!project || !page || id === page.rootId) return;
    if (!project.nodes[id] || !project.nodes[parentId]) return;
    if (subtreeIds(project.nodes, id).includes(parentId)) return;
    const currentParent = findParentId(project.nodes, id);
    let effectiveIndex = index;
    if (currentParent === parentId) {
      const currentIndex = project.nodes[parentId].children.indexOf(id);
      if (currentIndex < index) effectiveIndex = index - 1;
      // Already in place and already in the flow: nothing to do.
      if (effectiveIndex === currentIndex && project.nodes[id].style.base.position !== "absolute") return;
    }
    const next = withHistory(state, (p) => {
      let nodes = { ...p.nodes };
      if (currentParent && nodes[currentParent]) {
        nodes[currentParent] = {
          ...nodes[currentParent],
          children: nodes[currentParent].children.filter((c) => c !== id),
        };
      }
      nodes = insertIntoParent(nodes, parentId, id, effectiveIndex);
      // Joining the flow means giving up free placement on every breakpoint.
      const node = nodes[id];
      const style = { ...node.style, base: withoutPosition(node.style.base) };
      if (style.tablet) style.tablet = withoutPosition(style.tablet);
      if (style.mobile) style.mobile = withoutPosition(style.mobile);
      nodes[id] = { ...node, style };
      return { ...p, nodes };
    });
    set(next);
    schedulePersist(get, set);
  },

  makeFree: (id, at, opts) => {
    const s = get();
    const project = s.getProject();
    const page = s.getPage();
    if (!project || !page || !project.nodes[id] || id === page.rootId) return;
    // Stays in the container it already lives in — only its positioning changes.
    const hostId = findParentId(project.nodes, id) ?? page.rootId;
    s.dropFree(id, { hostId, left: at?.left ?? 0, top: at?.top ?? 0, pinSize: opts?.pinSize });
  },

  makeFlow: (id) => {
    const s = get();
    const project = s.getProject();
    const page = s.getPage();
    if (!project || !page || !project.nodes[id] || id === page.rootId) return;
    if (project.nodes[id].style.base.position !== "absolute") return;
    const next = withHistory(s, (p) => {
      const node = p.nodes[id];
      if (!node) return p;
      const style = { ...node.style, base: withoutPosition(node.style.base) };
      if (style.tablet) style.tablet = withoutPosition(style.tablet);
      if (style.mobile) style.mobile = withoutPosition(style.mobile);
      return { ...p, nodes: { ...p.nodes, [id]: { ...node, style } } };
    });
    set(next);
    schedulePersist(get, set);
  },

  fitHostHeight: (hostId, neededPx) => {
    const s = get();
    const project = s.getProject();
    const host = project?.nodes[hostId];
    if (!project || !host) return;
    // The canvas layer is out of flow: growing IT would let free boxes spill
    // past the page. Grow the page it overlays instead.
    if (isFreeformLayer(host)) {
      const page = s.getPage();
      const rootId = page?.rootId ?? findParentId(project.nodes, hostId);
      if (!rootId) return;
      const next = withHistory(s, (p) => ({
        ...p,
        nodes: growMinHeight(p.nodes, rootId, neededPx),
      }));
      set(next);
      schedulePersist(get, set);
      return;
    }
    const current = typeof host.style.base.minHeight === "number" ? host.style.base.minHeight : 0;
    const needed = Math.max(0, Math.round(neededPx));
    if (needed <= current) return;
    s.setStyle(hostId, "base", { minHeight: needed });
  },

  fitHostToNode: (id, hostId) => {
    const s = get();
    const node = s.getProject()?.nodes[id];
    if (!node || node.style.base.position !== "absolute") return;
    // The child's height comes from the DOM (honest for auto/% sizes) while its
    // offset comes from the schema, so this is right even before React has
    // re-rendered the move.
    const measured = nodeRectInFrame(id);
    const height = measured ? measured.bottom - measured.top : 0;
    const needed = (node.style.base.top ?? 0) + height + GRID_CELL * 2;
    const hostRect = nodeRectInFrame(hostId);
    // min-height can only ever grow a box, so skip hosts that are already tall
    // enough — no pointless declarations in the exported CSS.
    if (hostRect && needed <= hostRect.bottom - hostRect.top) return;
    s.fitHostHeight(hostId, needed);
  },

  /* ---------------- element mutations ---------------- */

  addElementAt: (type, parentId, index, opts) => {
    const state = get();
    const project = state.getProject();
    const page = state.getPage();
    if (!project || !page) return null;
    const parentNode = project.nodes[parentId];
    if (!parentNode || !isContainerType(parentNode.type)) return null;

    const node = makeNode(type, project.nodes);
    if (type === "scene3d") node.scene3d = { ...DEFAULT_SCENE_3D };
    applyNewNodeOptions(node, opts);
    const next = withHistory(state, (p) => ({
      ...p,
      nodes: insertIntoParent({ ...p.nodes, [node.id]: node }, parentId, node.id, index),
    }));
    set({ ...next, selectedId: node.id });
    schedulePersist(get, set);
    return node.id;
  },

  addSectionAt: (presetId, index) => {
    const state = get();
    const project = state.getProject();
    const page = state.getPage();
    if (!project || !page) return null;
    const root = project.nodes[page.rootId];
    if (!root) return null;

    const { nodes, rootId } = buildSection(presetId, project.nodes);
    const node = nodes[rootId];
    if (!node) return null;
    const at = index ?? root.children.length;
    const next = withHistory(state, (p) => ({
      ...p,
      nodes: insertIntoParent({ ...p.nodes, ...nodes }, page.rootId, rootId, at),
    }));
    set({ ...next, selectedId: rootId });
    schedulePersist(get, set);
    return rootId;
  },

  addElement: (type, parentId = null, opts) => {
    const state = get();
    const project = state.getProject();
    const page = state.getPage();
    if (!project || !page) return null;

    let targetParent: NodeId | null = parentId;
    if (!targetParent) {
      const sel = state.selectedId ? project.nodes[state.selectedId] : null;
      if (sel) {
        targetParent = isContainerType(sel.type)
          ? sel.id
          : findParentId(project.nodes, sel.id) ?? page.rootId;
      } else {
        targetParent = page.rootId;
      }
    }
    let parentNode = project.nodes[targetParent];
    if (!parentNode || !isContainerType(parentNode.type)) {
      targetParent = findParentId(project.nodes, targetParent) ?? page.rootId;
      parentNode = project.nodes[targetParent];
    }
    if (!parentNode) return null;

    const node = makeNode(type, project.nodes);
    if (type === "scene3d") {
      node.scene3d = { ...DEFAULT_SCENE_3D };
    }
    applyNewNodeOptions(node, opts);
    const finalParent = targetParent;
    const next = withHistory(state, (p) => ({
      ...p,
      nodes: insertIntoParent(
        { ...p.nodes, [node.id]: node },
        finalParent,
        node.id,
        p.nodes[finalParent].children.length,
      ),
    }));
    set({ ...next, selectedId: node.id });
    schedulePersist(get, set);
    return node.id;
  },

  deleteElement: (id) => {
    const state = get();
    const project = state.getProject();
    const page = state.getPage();
    if (!project || !page || id === page.rootId) return;
    const parent = findParentId(project.nodes, id);
    const ids = subtreeIds(project.nodes, id);
    const nextNodes = removeSubtree(project.nodes, id);
    if (parent && nextNodes[parent]) {
      nextNodes[parent] = {
        ...nextNodes[parent],
        children: nextNodes[parent].children.filter((c) => c !== id),
      };
    }
    const next = withHistory(state, (p) => ({ ...p, nodes: nextNodes }));
    set({
      ...next,
      selectedId:
        state.selectedId && ids.includes(state.selectedId)
          ? parent ?? page.rootId
          : state.selectedId,
    });
    schedulePersist(get, set);
  },

  duplicateElement: (id) => {
    const state = get();
    const project = state.getProject();
    const page = state.getPage();
    if (!project || !page || id === page.rootId) return null;
    const parent = findParentId(project.nodes, id);
    if (!parent) return null;
    const { cloned, newRootId } = cloneSubtree(project.nodes, id, () => uid());
    const index = project.nodes[parent].children.indexOf(id) + 1;
    const next = withHistory(state, (p) => ({
      ...p,
      nodes: insertIntoParent({ ...p.nodes, ...cloned }, parent, newRootId, index),
    }));
    set({ ...next, selectedId: newRootId });
    schedulePersist(get, set);
    return newRootId;
  },

  resizeNode: (id, deltaPx, edge, startPx) => {
    const project = get().getProject();
    if (!project) return;
    const node = project.nodes[id];
    if (!node) return;
    const layer: "base" | "tablet" | "mobile" =
      get().viewport === "desktop" ? "base" : (get().viewport as "tablet" | "mobile");
    const horizontal = edge === "left" || edge === "right";
    // Anchor on the measured size at drag start: %-sized nodes become px
    // (Wix-style) instead of compounding into runaway percentages.
    const start = Math.max(16, Math.round(startPx));
    const step = get().snapToGrid ? GRID_CELL : 2;
    let value = start + (edge === "left" || edge === "top" ? -deltaPx : deltaPx);
    value = Math.max(Math.max(GRID_CELL, step), Math.round(value / step) * step);
    get().setStyle(id, layer, horizontal ? { width: { kind: "fixed", value, unit: "px" } } : { height: { kind: "fixed", value, unit: "px" } });
  },

  renameElement: (id, name) => {
    const next = withHistory(get(), (p) => ({
      ...p,
      nodes: { ...p.nodes, [id]: { ...p.nodes[id], name } },
    }));
    set(next);
    schedulePersist(get, set);
  },

  reorder: (id, dir) => {
    const state = get();
    const project = state.getProject();
    if (!project) return;
    const parent = findParentId(project.nodes, id);
    if (!parent) return;
    const children = project.nodes[parent].children;
    const idx = children.indexOf(id);
    const to = idx + dir;
    if (to < 0 || to >= children.length) return;
    const next = withHistory(state, (p) => ({
      ...p,
      nodes: moveWithinParent(p.nodes, parent, idx, to),
    }));
    set(next);
    schedulePersist(get, set);
  },

  moveRelative: (id, parentId, index) => {
    const state = get();
    const project = state.getProject();
    const page = state.getPage();
    if (!project || !page || id === page.rootId) return;
    if (subtreeIds(project.nodes, id).includes(parentId)) return;
    const currentParent = findParentId(project.nodes, id);
    let effectiveIndex = index;
    if (currentParent === parentId) {
      const curIdx = project.nodes[parentId].children.indexOf(id);
      if (curIdx < index) effectiveIndex = index - 1;
      if (effectiveIndex === curIdx) return;
    }
    let nodes = { ...project.nodes };
    if (currentParent && nodes[currentParent]) {
      nodes[currentParent] = {
        ...nodes[currentParent],
        children: nodes[currentParent].children.filter((c) => c !== id),
      };
    }
    nodes = insertIntoParent(nodes, parentId, id, effectiveIndex);
    const next = withHistory(state, (p) => ({ ...p, nodes }));
    set(next);
    schedulePersist(get, set);
  },

  setProp: (id, key, value) => {
    const next = withHistory(get(), (p) => ({
      ...p,
      nodes: {
        ...p.nodes,
        [id]: { ...p.nodes[id], props: { ...p.nodes[id].props, [key]: value } },
      },
    }));
    set(next);
    schedulePersist(get, set);
  },

  setStyle: (id, bp, patch) => {
    const state = get();
    // Coalesce rapid slider drags into one undo step.
    const last = state.past[state.past.length - 1];
    const coalesce =
      !!last &&
      last.nodes[id] !== undefined &&
      Date.now() - (last.updatedAt ?? 0) < 800;
    const next = withHistory(state, (p) => {
      const node = p.nodes[id];
      if (!node) return p;
      const style = { ...node.style };
      if (bp === "base") style.base = { ...style.base, ...patch };
      else style[bp] = { ...style[bp], ...patch };
      return { ...p, nodes: { ...p.nodes, [id]: { ...node, style } } };
    });
    set(coalesce ? { ...next, past: state.past } : next);
    schedulePersist(get, set);
  },

  clearStyleLayer: (id, bp) => {
    const next = withHistory(get(), (p) => {
      const node = p.nodes[id];
      if (!node) return p;
      const style = { ...node.style };
      delete style[bp];
      return { ...p, nodes: { ...p.nodes, [id]: { ...node, style } } };
    });
    set(next);
    schedulePersist(get, set);
  },

  setInteraction: (id, onClick) => {
    const next = withHistory(get(), (p) => ({
      ...p,
      nodes: { ...p.nodes, [id]: { ...p.nodes[id], onClick } },
    }));
    set(next);
    schedulePersist(get, set);
  },

  setAnimation: (id, animation) => {
    const next = withHistory(get(), (p) => ({
      ...p,
      nodes: { ...p.nodes, [id]: { ...p.nodes[id], animation } },
    }));
    set(next);
    schedulePersist(get, set);
  },

  setScene3D: (id, patch) => {
    const next = withHistory(get(), (p) => {
      const node = p.nodes[id];
      if (!node) return p;
      return {
        ...p,
        nodes: {
          ...p.nodes,
          [id]: { ...node, scene3d: { ...DEFAULT_SCENE_3D, ...node.scene3d, ...patch } },
        },
      };
    });
    set(next);
    schedulePersist(get, set);
  },

  setAnchor: (id, anchorId) => {
    const next = withHistory(get(), (p) => ({
      ...p,
      nodes: { ...p.nodes, [id]: { ...p.nodes[id], anchorId: anchorId || undefined } },
    }));
    set(next);
    schedulePersist(get, set);
  },

  /* ---------------- pages ---------------- */

  addPage: (name, path) => {
    const state = get();
    const project = state.getProject();
    if (!project) return;
    const rootId = uid("page");
    const rootNode: ElementNode = {
      id: rootId,
      type: "section",
      name,
      props: {},
      style: {
        base: {
          display: "flex",
          flexDirection: "column",
          width: { kind: "fill" },
          minHeight: "100vh",
        },
      },
      children: [],
    };
    const page = makePage(name, path, rootId);
    const next = withHistory(state, (p) => ({
      ...p,
      pages: [...p.pages, page],
      nodes: { ...p.nodes, [rootId]: rootNode },
    }));
    set(next);
    schedulePersist(get, set);
  },

  deletePage: (pageId) => {
    const state = get();
    const project = state.getProject();
    if (!project || project.pages.length <= 1) return;
    const page = project.pages.find((x) => x.id === pageId);
    if (!page) return;
    const pages = project.pages.filter((x) => x.id !== pageId);
    const next = withHistory(state, (p) => {
      const nodes = { ...p.nodes };
      for (const nid of subtreeIds(p.nodes, page.rootId)) delete nodes[nid];
      return {
        ...p,
        pages,
        homePageId: p.homePageId === pageId ? pages[0].id : p.homePageId,
        nodes,
      };
    });
    const updated = next.projects?.find((p) => p.id === state.activeProjectId);
    set({
      ...next,
      activePageId:
        state.activePageId === pageId
          ? updated?.homePageId ?? pages[0].id
          : state.activePageId,
    });
    schedulePersist(get, set);
  },

  setActivePage: (pageId) => set({ activePageId: pageId, selectedId: null }),

  /* ---------------- assets / theme ---------------- */

  addAsset: (asset) => {
    const next = withHistory(get(), (p) => ({
      ...p,
      assets: { ...p.assets, [asset.id]: asset },
    }));
    set(next);
    schedulePersist(get, set);
  },

  addAssetFromFile: (file) => {
    return new Promise((resolve) => {
      const kind = assetKindFor(file);
      const reader = new FileReader();
      reader.onload = () => {
        const src = String(reader.result);
        const asset: Asset = {
          id: uid("asset"),
          name: file.name,
          type: kind,
          src,
        };
        // Measure images to show dimensions in the assets panel.
        if (kind === "image" && /^data:image\//.test(src)) {
          const img = new Image();
          img.onload = () => {
            asset.width = img.naturalWidth;
            asset.height = img.naturalHeight;
            get().addAsset(asset);
            resolve(asset.id);
          };
          img.onerror = () => {
            get().addAsset(asset);
            resolve(asset.id);
          };
          img.src = src;
        } else {
          get().addAsset(asset);
          resolve(asset.id);
        }
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  },

  removeAsset: (id) => {
    const next = withHistory(get(), (p) => {
      const assets = { ...p.assets };
      delete assets[id];
      return { ...p, assets };
    });
    set(next);
    schedulePersist(get, set);
  },

  setTheme: (patch) => {
    const next = withHistory(get(), (p) => ({
      ...p,
      theme: {
        ...p.theme,
        ...("colors" in patch ? { colors: { ...p.theme.colors, ...patch.colors } } : {}),
        ...("font" in patch ? { font: patch.font } : {}),
        ...("fontId" in patch ? { fontId: patch.fontId } : {}),
        ...("radius" in patch ? { radius: patch.radius } : {}),
        ...("templateId" in patch ? { templateId: patch.templateId } : {}),
      },
    }));
    set(next);
    schedulePersist(get, set);
  },

  /* ---------------- history ---------------- */

  undo: () => {
    const s = get();
    if (!s.past.length) return;
    const previous = s.past[s.past.length - 1];
    const selected = s.selectedId;
    set({
      past: s.past.slice(0, -1),
      future: [...s.future, s.getProject() ?? previous].slice(-HISTORY_LIMIT),
      projects: s.projects.map((p) => (p.id === previous.id ? previous : p)),
      selectedId: selected && previous.nodes[selected] ? selected : null,
    });
    schedulePersist(get, set);
  },

  redo: () => {
    const s = get();
    if (!s.future.length) return;
    const nextProject = s.future[s.future.length - 1];
    const current = s.getProject();
    const selected = s.selectedId;
    set({
      future: s.future.slice(0, -1),
      past: current ? [...s.past, current].slice(-HISTORY_LIMIT) : s.past,
      projects: s.projects.map((p) => (p.id === nextProject.id ? nextProject : p)),
      selectedId: selected && nextProject.nodes[selected] ? selected : null,
    });
    schedulePersist(get, set);
  },
}));
