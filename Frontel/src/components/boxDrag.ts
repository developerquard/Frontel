/**
 * BoxDragController — pointer-based box dragging.
 *
 * THE drag path for every element. Pointer down on any node starts a drag; a
 * connector line follows the pointer, a ghost box shows exactly where the
 * element will land, and release applies one resolved drop:
 *
 *   default          free placement — the element lands where you released it,
 *                    snapped to the box grid, inside the box under the pointer
 *   Shift (layout)   the element joins a container's flow (before/after a
 *                    sibling, or inside a container at the nearest child edge)
 *   Alt (exact)      pixel-exact placement, no box snapping
 *
 * The project is NOT mutated while dragging — a drop is exactly one undo step.
 *
 * Geometry is re-read LIVE on every pointer event (frame rect + node rects).
 * Freezing it at drag start desynced everything the moment the frame moved
 * under the pointer — wheel-scrolling mid-drag put the ghost and the drop a
 * full scroll-length away from the cursor. Only the box's SIZE and the grab
 * offset inside it are frozen; both are scroll-invariant.
 *
 * Driven by Canvas: `beginBoxDrag` is called from a pointerdown handler;
 * Canvas and BoxDragOverlay subscribe to the tiny boxDrag store for chrome.
 */
import { create } from "zustand";
import type { NodeId, Project } from "@/schemas/types";
import { ghostRect, resolveDrop, type DropTarget, type Rect } from "@/lib/grid";
import { useEditor } from "@/lib/store";

export interface DragLine {
  /** Frame-local grab point (start of the connector line). */
  fromX: number;
  fromY: number;
  /** Frame-local current pointer (end of the connector line). */
  toX: number;
  toY: number;
}

export interface BoxDragMeta {
  /** Shift held: the drop joins a container's layout. */
  layout: boolean;
  /** Alt held: pixel-exact placement. */
  exact: boolean;
}

export interface BoxDragState {
  active: boolean;
  dragId: NodeId | null;
  /** Payload for new-item drags from palette/panels. */
  newKind: "node" | "new" | "asset" | "effect" | null;
  type?: string;
  section?: string;
  assetId?: string;
  effectId?: string;
  label: string;
  line: DragLine | null;
  /** Resolved drop under the pointer. */
  target: DropTarget | null;
  /** Frame-local rect of the dragged box's source position (dims during drag). */
  originRect: Rect | null;
  /** Frame-local ghost box: where the element will land. */
  ghost: Rect | null;
  /** Shift held. */
  layout: boolean;
  /** Alt held. */
  exact: boolean;
}

interface BoxDragStore extends BoxDragState {
  set: (partial: Partial<BoxDragState>) => void;
  reset: () => void;
}

const initial: BoxDragState = {
  active: false,
  dragId: null,
  newKind: null,
  label: "",
  line: null,
  target: null,
  originRect: null,
  ghost: null,
  layout: false,
  exact: false,
};

export const useBoxDrag = create<BoxDragStore>((set) => ({
  ...initial,
  set: (partial) => set(partial),
  reset: () => set(initial),
}));

interface BeginDragOptions {
  /** Existing node being moved. */
  dragId?: NodeId;
  /** New-item payload (palette drag etc.). */
  newKind?: BoxDragState["newKind"];
  type?: string;
  section?: string;
  assetId?: string;
  effectId?: string;
  label: string;
  /** Client-space grab point (pointerdown position). */
  startClient: { x: number; y: number };
  /** Offset of the grab point inside the dragged box (frozen: scroll-invariant). */
  grab: { x: number; y: number };
  /** Size the ghost is drawn at (the box's own size — frozen at drag start). */
  size: { w: number; h: number };
  /** Live client-space frame origin — re-read on every event, never cached. */
  getFrameRect: () => { left: number; top: number };
  /** Live node rects inside the frame — re-read on every event. */
  collectRects: () => Map<NodeId, Rect>;
  /** Nodes to hit-test, from Canvas. */
  project: () => Project | null;
  pageRootId: NodeId;
  /** Executed on drop, with the modifiers that were held at release. */
  onDrop: (target: DropTarget | null, meta: BoxDragMeta) => void;
}

/** Cancels the in-flight box drag, if any (used by Escape / re-entrancy). */
let activeCancel: (() => void) | null = null;

export function cancelBoxDrag(): void {
  activeCancel?.();
}

/**
 * Starts a pointer-tracked box drag. Cleanup runs on pointerup/pointercancel.
 * Call from a pointerdown handler.
 */
export function beginBoxDrag(opts: BeginDragOptions): void {
  activeCancel?.(); // never leave a previous drag's listeners attached
  const store = useBoxDrag.getState();
  store.set({
    ...initial,
    active: true,
    dragId: opts.dragId ?? null,
    newKind: opts.newKind ?? null,
    type: opts.type,
    section: opts.section,
    assetId: opts.assetId,
    effectId: opts.effectId,
    label: opts.label,
  });
  useEditor.getState().setDrag({
    kind: opts.dragId ? "node" : (opts.newKind ?? "new"),
    id: opts.dragId,
    type: opts.type as never,
    section: opts.section,
    assetId: opts.assetId,
    effectId: opts.effectId,
    label: opts.label,
  });

  /** Last pointer position, so modifier keys can re-resolve without moving. */
  let pointer = { x: opts.startClient.x, y: opts.startClient.y };

  /**
   * Frame-local pointer + live source position. Every consumer of drag
   * geometry (line, dim, ghost, drop) derives from the rects read HERE, so a
   * scroll or reflow mid-drag moves the chrome and the landing together.
   */
  const update = (clientX: number, clientY: number, layout: boolean, exact: boolean) => {
    pointer = { x: clientX, y: clientY };
    const fRect = opts.getFrameRect();
    const frameX = clientX - fRect.left;
    const frameY = clientY - fRect.top;
    const project = opts.project();
    const rects = opts.collectRects();

    // Connector starts at the grabbed point of the source box — tracked live
    // so it stays glued to the box when the frame scrolls under the pointer.
    const src = opts.dragId ? rects.get(opts.dragId) : undefined;
    const fromX = src ? src.left + opts.grab.x : frameX;
    const fromY = src ? src.top + opts.grab.y : frameY;

    useBoxDrag.getState().set({
      line: { fromX, fromY, toX: frameX, toY: frameY },
      originRect: src ?? null,
      layout,
      exact,
      ...(project
        ? (() => {
            const target = resolveDrop(project, opts.pageRootId, frameX, frameY, rects, {
              excludeId: opts.dragId,
              mode: layout ? "flow" : "free",
              // Snap exactly the way the drop will (grid toggle respected), so
              // the ghost never promises a pixel the release won't keep.
              snap: !exact && useEditor.getState().snapToGrid,
              grab: opts.grab,
              size: opts.size,
            });
            return { target, ghost: ghostRect(target, rects, opts.size) };
          })()
        : null),
    });
  };

  const onMove = (ev: PointerEvent) => {
    ev.preventDefault();
    update(ev.clientX, ev.clientY, ev.shiftKey, ev.altKey);
  };

  /** Shift/Alt can be pressed mid-drag: re-resolve at the same pointer. */
  const onModifier = (ev: KeyboardEvent) => {
    if (ev.key !== "Shift" && ev.key !== "Alt") return;
    update(pointer.x, pointer.y, ev.shiftKey, ev.altKey);
  };

  const detach = () => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", finish);
    window.removeEventListener("pointercancel", cancel);
    window.removeEventListener("keydown", onModifier);
    window.removeEventListener("keyup", onModifier);
  };

  function finish(ev: PointerEvent) {
    detach();
    update(ev.clientX, ev.clientY, ev.shiftKey, ev.altKey);
    const { target, layout, exact } = useBoxDrag.getState();
    activeCancel = null;
    useBoxDrag.getState().reset();
    useEditor.getState().setDrag(null);
    useEditor.getState().setDropTarget(null);
    opts.onDrop(target, { layout, exact });
  }

  function cancel() {
    detach();
    activeCancel = null;
    useBoxDrag.getState().reset();
    useEditor.getState().setDrag(null);
    useEditor.getState().setDropTarget(null);
  }

  activeCancel = cancel;

  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", finish);
  window.addEventListener("pointercancel", cancel);
  window.addEventListener("keydown", onModifier);
  window.addEventListener("keyup", onModifier);

  // Seed the chrome at the grab point with a first resolve.
  update(opts.startClient.x, opts.startClient.y, false, false);
}
