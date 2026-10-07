/**
 * Direct creation / free placement helpers.
 *
 * "Boxes" are the editor's placement and size unit (see lib/grid). Free
 * placement means an ordinary schema node with position:absolute and
 * left/top/zIndex in real StyleProps, hosted by any container (promoted to
 * position:relative on demand). It is first-class in codegen: the generated
 * CSS already emits position/left/top, so exported projects reproduce free
 * compositions exactly.
 *
 * The page's "canvas layer" is a plain relative section that exists so empty
 * page space has a host of its own; it is created on demand and is no longer
 * required to place anything — every container can host free children.
 */
import { defaultStyleForBox, makeNode } from "@/schemas/factory";
import { DEFAULT_SCENE_3D } from "@/schemas/types";
import { VIEWPORT_WIDTH } from "@/lib/viewport";
import type {
  ElementNode,
  ElementType,
  NodeId,
  Project,
  SizeValue,
  StyleProps,
} from "@/schemas/types";

/** Marker prop so the canvas layer can be found reliably (not a magic name). */
export const FREEFORM_PROP = "freeformLayer";

export function isFreeformLayer(node: ElementNode): boolean {
  return node.props?.[FREEFORM_PROP] === true;
}

/** Default height of an empty canvas layer (px). Legacy: pre-overlay projects. */
export const CANVAS_LAYER_MIN_HEIGHT = 560;

/**
 * The page's canvas layer used to be a flow section with a min-height, which
 * meant anything placed in it (a full-bleed 3D background, most visibly) took
 * real page space and pushed every real section down the page.
 *
 * It is now a pure overlay: absolutely positioned over the page, painted behind
 * the flow content (z-index -1 inside the page's stacking context), taking no
 * flow space at all. Anything dropped on empty page space lives in it and can
 * never displace a section again.
 */
function canvasLayerStyle(): StyleProps {
  return {
    display: "flex",
    flexDirection: "column",
    position: "absolute",
    left: 0,
    top: 0,
    width: { kind: "fill" },
    height: { kind: "fill" },
    zIndex: -1,
    overflow: "visible",
    background: "transparent",
  };
}

/**
 * Makes a page root able to host the absolutely-positioned canvas overlay: it
 * needs to be the containing block (position: relative) and its own stacking
 * context (isolation: isolate), so the layer's negative z-index paints above
 * the page background but never escapes behind it.
 */
export function ensureLayerHost(
  nodes: Record<NodeId, ElementNode>,
  pageRootId: NodeId,
): Record<NodeId, ElementNode> {
  const root = nodes[pageRootId];
  if (!root) return nodes;
  const base = root.style.base;
  if (base.position === "relative" && base.isolation === true) return nodes;
  return {
    ...nodes,
    [pageRootId]: {
      ...root,
      style: {
        ...root.style,
        base: { ...base, position: "relative", isolation: true },
      },
    },
  };
}

export interface LayerInfo {
  layerId: NodeId;
  created: Record<NodeId, ElementNode>;
}

/**
 * Finds the page's canvas layer, creating it when absent. Returns any newly
 * created nodes so callers can persist them inside their own withHistory step.
 */
export function ensureFreeformLayer(
  project: Project,
  pageRootId: NodeId,
): LayerInfo {
  const root = project.nodes[pageRootId];
  for (const childId of root?.children ?? []) {
    const node = project.nodes[childId];
    if (node && isFreeformLayer(node)) return { layerId: node.id, created: {} };
  }

  const layerId = `ffl${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
  const layer: ElementNode = {
    id: layerId,
    type: "section",
    name: "Canvas layer",
    props: { [FREEFORM_PROP]: true },
    style: { base: canvasLayerStyle() },
    children: [],
  };
  const created = { [layerId]: layer };
  return { layerId, created };
}

/**
 * Brings stored projects up to the current canvas-layer model.
 *
 * Old projects carry a flow-participating layer (`position: relative` +
 * min-height 560) which pushed every section below it down the page — the
 * "why did my text move down when I added a background?" bug. Migration moves
 * the layer out of the flow and behind the content, and freezes the size of
 * children that were authored against the old layer (a full-bleed 100% box
 * would otherwise silently grow from the old 560px band to the whole page).
 * Idempotent: layers already in the overlay model are left untouched.
 */
export function normalizeProjects(projects: Project[]): Project[] {
  let touchedAny = false;
  const out = projects.map((project) => {
    let nodes = project.nodes;
    let touched = false;
    for (const page of project.pages) {
      const root = nodes[page.rootId];
      if (!root) continue;
      for (const childId of root.children) {
        const layer = nodes[childId];
        if (!layer || !isFreeformLayer(layer)) continue;
        const base = layer.style.base;
        const alreadyOverlay =
          base.position === "absolute" && base.zIndex === -1 && base.height?.kind === "fill";
        if (alreadyOverlay) continue;

        // The old layer's own box: a 560px-tall full-width band at the top.
        const oldHeight =
          typeof base.minHeight === "number" ? base.minHeight : CANVAS_LAYER_MIN_HEIGHT;
        const nextBase: StyleProps = { ...canvasLayerStyle(), background: base.background ?? "transparent" };
        nodes = { ...nodes, [childId]: { ...layer, style: { ...layer.style, base: nextBase } } };

        for (const grandId of nodes[childId].children) {
          const child = nodes[grandId];
          if (!child) continue;
          const cb = { ...child.style.base };
          const nextW = pinPercent(cb.width, VIEWPORT_WIDTH.desktop);
          const nextH = pinPercent(cb.height, oldHeight);
          if (nextW !== cb.width) cb.width = nextW;
          if (nextH !== cb.height) cb.height = nextH;
          nodes[grandId] = { ...child, style: { ...child.style, base: cb } };
        }
        nodes = ensureLayerHost(nodes, page.rootId);
        touched = true;
        touchedAny = true;
      }
    }
    return touched ? { ...project, nodes } : project;
  });
  return touchedAny ? out : projects;
}

/** Full-bleed percentages become the pixels the box actually had (migration). */
function pinPercent(size: SizeValue | undefined, full: number): SizeValue | undefined {
  if (!size || size.kind !== "fixed" || size.unit !== "%" || size.value < 100) return size;
  return { kind: "fixed", value: Math.max(16, Math.round(full)), unit: "px" };
}

export interface CreateAtPointOptions {
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  /** 3D scene config for a scene3d node, applied in the same history step. */
  scene3d?: Partial<ElementNode["scene3d"]>;
  /** Props merged over the type defaults (text, level, label…). */
  props?: ElementNode["props"];
  /** Style merged over the drawn-box defaults (used by style presets). */
  style?: Partial<StyleProps>;
  /** Display name; style presets name their node after the variant. */
  name?: string;
  zIndex?: number;
}

/** Creates a node with default styles sized to the drawn rectangle. */
export function createNodeAt(
  project: Project,
  type: ElementType,
  opts: CreateAtPointOptions,
): ElementNode {
  const width = Math.max(16, Math.round(opts.width ?? 240));
  const height = Math.max(16, Math.round(opts.height ?? 80));
  const node = makeNode(type, project.nodes);
  if (type === "scene3d") node.scene3d = { ...DEFAULT_SCENE_3D, ...(opts.scene3d ?? {}) };
  if (opts.name) node.name = opts.name;
  if (opts.props) node.props = { ...node.props, ...opts.props };
  const base: StyleProps = {
    ...defaultStyleForBox(type, width, height),
    position: "absolute",
    // A box never meaningfully sits at a negative offset inside its host —
    // a negative coordinate would land it clipped in a corner.
    left: Math.max(0, Math.round(opts.left ?? 0)),
    top: Math.max(0, Math.round(opts.top ?? 0)),
    ...opts.style,
  };
  if (opts.zIndex !== undefined) base.zIndex = opts.zIndex;
  node.style = { base };
  return node;
}
