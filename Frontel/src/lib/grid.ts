/**
 * Box-grid drop semantics.
 *
 * The canvas is a grid of BOXES (`GRID_CELL` px). Boxes are the placement and
 * sizing unit of the whole editor — drop, resize, nudge and the Inspector's
 * width/height controls all step in boxes:
 *
 *   free drop (default)   the element lands where it was released, snapped to
 *                         the box grid, as an absolutely-positioned child of
 *                         the nearest container under the pointer
 *   layout drop (Shift)   the element joins a container's flow: before/after
 *                         a sibling, or inside a container at the nearest
 *                         child edge
 *
 * Pure functions only: the caller (Canvas) supplies measured rects.
 */
import type { ElementNode, NodeId, Project } from "@/schemas/types";
import { isContainerType } from "@/schemas/registry";
import { isFreeformLayer } from "./freeform";
import { findParentId, subtreeIds } from "./tree";

/** Box (anchor cell) size in canvas px — the editor's placement/size unit. */
export const GRID_CELL = 8;

/** Boxes ↔ pixels: the Inspector shows sizes in boxes so the grid is the unit. */
export function pxToBoxes(px: number): number {
  return Math.round(px / GRID_CELL);
}

/**
 * Rendered size of a box's outer "connector" rim. In layout mode, content
 * dropped within this distance of a box edge lands BESIDE the box rather than
 * inside it.
 */
export const EDGE_BAND = GRID_CELL * 2;

/** Snaps a value to the nearest box edge. */
export function snap(v: number): number {
  return Math.round(v / GRID_CELL) * GRID_CELL;
}

export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Free placement: the node becomes an absolute child of `hostId`. */
export interface FreeDrop {
  mode: "free";
  /** Container the element is positioned inside. */
  hostId: NodeId;
  /** Host-relative, grid-snapped top-left of the dropped box. */
  x: number;
  y: number;
  /** Stable identity of this target, so callers can avoid redundant updates. */
  rectKey: string;
}

/** Layout insertion: the node joins a container's flow at `index`. */
export interface InsertDrop {
  mode: "insert";
  parentId: NodeId;
  index: number;
  rectKey: string;
}

export type DropTarget = FreeDrop | InsertDrop;

export interface ResolveDropOptions {
  /** The dragged node (and its subtree) never targets itself. */
  excludeId?: NodeId;
  /** "free" (default) places at the pointer; "flow" joins the layout. */
  mode?: "free" | "flow";
  /** false = exact placement, no box snapping (Alt). */
  snap?: boolean;
  /**
   * Frame-local offset of the grab point inside the dragged box, so a box is
   * dragged by the exact point the user grabbed instead of recentring on the
   * cursor.
   */
  grab?: { x: number; y: number };
  /**
   * Size of the box being placed. With it, the resolved free point is clamped
   * fully inside the host — the ghost can then only promise a spot the element
   * will actually keep, never half-off the host or in clipped negative space.
   */
  size?: { w: number; h: number };
}

/** The page's canvas (freeform) layer, when one exists. */
export function canvasLayerId(project: Project, pageRootId: NodeId): NodeId | null {
  for (const childId of project.nodes[pageRootId]?.children ?? []) {
    const node = project.nodes[childId];
    if (node && isFreeformLayer(node)) return node.id;
  }
  return null;
}

/**
 * Frame-local ghost box for a resolved free drop: exactly where the element
 * will land, at the size it will keep. Null for layout (insert) drops, which
 * are communicated by the insertion bar instead.
 */
export function ghostRect(
  target: DropTarget | null,
  rects: Map<NodeId, Rect>,
  size: { w: number; h: number },
): Rect | null {
  if (!target || target.mode !== "free") return null;
  const host = rects.get(target.hostId);
  if (!host) return null;
  const left = host.left + target.x;
  const top = host.top + target.y;
  return { left, top, right: left + size.w, bottom: top + size.h };
}

/**
 * Clamps a host-relative point so the box stays fully inside its host. Without
 * a known size only the lower bound applies (the box's top-left stays on the
 * host); with one, the whole box is kept inside — placement can never promise
 * a corner/clipped landing the element won't keep.
 */
function clampIntoHost(
  x: number,
  y: number,
  hostRect: Rect | undefined,
  size: { w: number; h: number } | undefined,
): { x: number; y: number } {
  if (!hostRect) return { x, y };
  const hostW = hostRect.right - hostRect.left;
  const hostH = hostRect.bottom - hostRect.top;
  const maxX = Math.max(0, hostW - (size?.w ?? 0));
  const maxY = Math.max(0, hostH - (size?.h ?? 0));
  return {
    x: Math.min(Math.max(0, x), maxX),
    y: Math.min(Math.max(0, y), maxY),
  };
}

/**
 * Effective hit rect. An empty container renders as a zero-height box —
 * impossible to aim at — so it gets a minimal drop target extending below its
 * top edge. Empty CONTAINERS only: leaves resolve against their own rect
 * either way, and inflating them would steal nearby cells.
 */
function effectiveRect(node: ElementNode, r: Rect): Rect {
  if (!isContainerType(node.type) || node.children.length > 0) return r;
  const min = GRID_CELL * 2;
  return {
    ...r,
    right: Math.max(r.right, r.left + min),
    bottom: Math.max(r.bottom, r.top + min),
  };
}

/** Topmost-first hit test: the smallest containing rect wins. */
function hitTest(
  project: Project,
  frameX: number,
  frameY: number,
  rects: Map<NodeId, Rect>,
  excludeId?: NodeId,
): { node: ElementNode; rect: Rect } | null {
  const excluded = excludeId ? new Set(subtreeIds(project.nodes, excludeId)) : null;
  let hit: { node: ElementNode; rect: Rect } | null = null;
  let hitArea = Infinity;
  for (const [id, r] of rects) {
    if (excluded?.has(id)) continue;
    const node = project.nodes[id];
    if (!node) continue;
    const e = effectiveRect(node, r);
    if (frameX < e.left || frameX > e.right || frameY < e.top || frameY > e.bottom) continue;
    const area = (e.right - e.left) * (e.bottom - e.top);
    if (area < hitArea) {
      hitArea = area;
      hit = { node, rect: e };
    }
  }
  return hit;
}

/**
 * Resolves what a pointer position means, given the node rects measured inside
 * the canvas frame. Free placement is the default; pass `mode: "flow"` for the
 * layout (insert into a container) behaviour.
 */
export function resolveDrop(
  project: Project,
  pageRootId: NodeId,
  frameX: number,
  frameY: number,
  rects: Map<NodeId, Rect>,
  opts: ResolveDropOptions = {},
): DropTarget | null {
  if (!project.nodes[pageRootId]) return null;
  const hit = hitTest(project, frameX, frameY, rects, opts.excludeId);
  if (opts.mode === "flow") {
    return resolveLayoutDrop(project, pageRootId, frameX, frameY, rects, hit, opts);
  }
  return resolveFreeDrop(project, pageRootId, frameX, frameY, rects, hit, opts);
}

/** Coordinates of the dropped box's top-left, host-relative. */
function freePoint(
  frameX: number,
  frameY: number,
  hostLeft: number,
  hostTop: number,
  opts: ResolveDropOptions,
): { x: number; y: number } {
  const snapped = opts.snap !== false;
  const grabX = opts.grab?.x ?? 0;
  const grabY = opts.grab?.y ?? 0;
  const x = frameX - grabX - hostLeft;
  const y = frameY - grabY - hostTop;
  return snapped
    ? { x: snap(x), y: snap(y) }
    : { x: Math.round(x), y: Math.round(y) };
}

/**
 * Free placement: the nearest container at or above the hit box becomes the
 * host (any container can hold free children — it is promoted to
 * position:relative on drop). Empty page space falls through to the page's
 * canvas layer, which the store materializes on demand.
 */
function resolveFreeDrop(
  project: Project,
  pageRootId: NodeId,
  frameX: number,
  frameY: number,
  rects: Map<NodeId, Rect>,
  hit: { node: ElementNode; rect: Rect } | null,
  opts: ResolveDropOptions,
): FreeDrop {
  let hostId: NodeId | null = null;
  if (hit) {
    let cursor: ElementNode | undefined = hit.node;
    while (cursor) {
      if (isContainerType(cursor.type)) {
        hostId = cursor.id;
        break;
      }
      const parentId = findParentId(project.nodes, cursor.id);
      cursor = parentId ? project.nodes[parentId] : undefined;
    }
  }
  if (!hostId) hostId = canvasLayerId(project, pageRootId) ?? pageRootId;

  const hostRect = rects.get(hostId) ?? rects.get(pageRootId);
  const point = freePoint(frameX, frameY, hostRect?.left ?? 0, hostRect?.top ?? 0, opts);
  const { x, y } = clampIntoHost(point.x, point.y, hostRect, opts.size);
  return { mode: "free", hostId, x, y, rectKey: `${hostId}:free:${x}:${y}` };
}

/**
 * Layout placement (Shift): insert inside the hovered container at the nearest
 * child edge, beside a box when the pointer is within its edge band, or fall
 * back to free placement when there is no box to join.
 */
function resolveLayoutDrop(
  project: Project,
  pageRootId: NodeId,
  frameX: number,
  frameY: number,
  rects: Map<NodeId, Rect>,
  hit: { node: ElementNode; rect: Rect } | null,
  opts: ResolveDropOptions,
): DropTarget {
  const free = (hostId: NodeId, hostRect?: Rect): FreeDrop => {
    const point = freePoint(frameX, frameY, hostRect?.left ?? 0, hostRect?.top ?? 0, opts);
    const { x, y } = clampIntoHost(point.x, point.y, hostRect, opts.size);
    return { mode: "free", hostId, x, y, rectKey: `${hostId}:free:${x}:${y}` };
  };

  if (hit) {
    const { node: hitNode, rect: hitRect } = hit;

    // Edge band: the outer rim of any box acts as a connector — dropping there
    // places content ADJACENT to the box (before/after among its siblings)
    // instead of inside it. The interior still means "inside".
    const hitParentId = findParentId(project.nodes, hitNode.id);
    const hitParent = hitParentId ? project.nodes[hitParentId] : null;
    // Empty containers have no interior to drop "inside", so the band is
    // skipped for them — an empty, zero-height box would be all rim.
    if (hitParent && !isFreeformLayer(hitParent) && hitNode.children.length > 0) {
      const dir = (hitParent.style.base.flexDirection ?? "column") as "row" | "column";
      const lead = dir === "row" ? frameX - hitRect.left : frameY - hitRect.top;
      const trail = dir === "row" ? hitRect.right - frameX : hitRect.bottom - frameY;
      const idx = hitParent.children.indexOf(hitNode.id);
      const nearLead = lead <= EDGE_BAND;
      const nearTrail = trail <= EDGE_BAND;
      if (nearLead || nearTrail) {
        // On boxes thinner than two bands, the nearer edge wins.
        const before = nearLead && (!nearTrail || lead <= trail);
        const at = before ? idx : idx + 1;
        return { mode: "insert", parentId: hitParent.id, index: at, rectKey: `${hitParent.id}:${at}` };
      }
    }
    if (isContainerType(hitNode.type)) {
      const children = hitNode.children;
      if (children.length === 0) {
        return { mode: "insert", parentId: hitNode.id, index: 0, rectKey: `${hitNode.id}:0` };
      }
      // Nearest child edge in the parent's layout direction.
      const dir = (hitNode.style.base.flexDirection ?? "row") as "row" | "column";
      let idx = children.length;
      for (let i = 0; i < children.length; i++) {
        const cr = rects.get(children[i]);
        if (!cr) continue;
        const mid = dir === "row" ? (cr.left + cr.right) / 2 : (cr.top + cr.bottom) / 2;
        const pos = dir === "row" ? frameX : frameY;
        if (pos < mid) {
          idx = i;
          break;
        }
      }
      return { mode: "insert", parentId: hitNode.id, index: idx, rectKey: `${hitNode.id}:${idx}` };
    }
    // Leaf: insert before/after among its siblings.
    if (!hitParent) return free(pageRootId, rects.get(pageRootId));
    const siblings = hitParent.children;
    const idx = siblings.indexOf(hitNode.id);
    const dir = (hitParent.style.base.flexDirection ?? "row") as "row" | "column";
    const mid = dir === "row" ? (hitRect.left + hitRect.right) / 2 : (hitRect.top + hitRect.bottom) / 2;
    const pos = dir === "row" ? frameX : frameY;
    const before = pos < mid;
    const at = before ? idx : idx + 1;
    return { mode: "insert", parentId: hitParent.id, index: at, rectKey: `${hitParent.id}:${at}` };
  }

  // Nothing hit: free placement in the page's canvas layer.
  return free(canvasLayerId(project, pageRootId) ?? pageRootId, rects.get(pageRootId));
}
