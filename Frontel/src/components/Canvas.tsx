import { useCallback, useEffect, useRef, useState } from "react";
import type { ElementNode, ElementType, NodeId } from "@/schemas/types";
import { useEditor, type EditorState } from "@/lib/store";
import { ELEMENT_DEFS } from "@/schemas/registry";
import { PageView } from "./PageView";
import { SelectionOverlay } from "./SelectionOverlay";
import type { EditorWiring } from "./NodeView";
import { themeVars } from "@/lib/styles";
import { EditorIcon } from "@/lib/editorIcons.tsx";
import { TOOL_ELEMENT } from "@/lib/store";
import {
  canvasLayerId,
  ghostRect,
  GRID_CELL,
  resolveDrop,
  type DropTarget,
  type FreeDrop,
  type Rect,
} from "@/lib/grid";
import { GridOverlay } from "./GridOverlay";
import { BoxDragOverlay } from "./BoxDragOverlay";
import { beginBoxDrag, useBoxDrag } from "./boxDrag";
import { effectConfig, getEffect3D } from "@/schemas/effects3d";
// Shared with the preview: the artboard width is one number, not two.
import { VIEWPORT_WIDTH } from "@/lib/viewport";

import type { Box } from "./canvasTypes";

/** Size a palette element gets when dropped straight onto the canvas. */
const DROP_SIZE: Record<ElementType, { w: number; h: number }> = {
  section: { w: 640, h: 360 },
  container: { w: 480, h: 240 },
  flex: { w: 400, h: 120 },
  grid: { w: 480, h: 240 },
  stack: { w: 320, h: 200 },
  heading: { w: 480, h: 96 },
  text: { w: 360, h: 72 },
  image: { w: 320, h: 200 },
  gif: { w: 320, h: 200 },
  video: { w: 360, h: 200 },
  icon: { w: 32, h: 32 },
  logo: { w: 140, h: 32 },
  button: { w: 176, h: 48 },
  link: { w: 120, h: 32 },
  input: { w: 280, h: 48 },
  select: { w: 220, h: 48 },
  checkbox: { w: 200, h: 28 },
  form: { w: 360, h: 240 },
  divider: { w: 240, h: 8 },
  scene3d: { w: 480, h: 320 },
};

/**
 * Measures selection/hover boxes relative to the viewport FRAME (the
 * position:relative element the overlays are mounted in) — not the outer
 * scroll container. Measuring against the container made every outline
 * offset by the frame's position (padding + centering) inside it.
 */
function useOverlayBox(frameRef: React.RefObject<HTMLDivElement | null>) {
  const [boxes, setBoxes] = useState<{ selected: Box | null; hovered: Box | null }>({
    selected: null,
    hovered: null,
  });

  const measure = useCallback(() => {
    const state = useEditor.getState();
    const frame = frameRef.current;
    if (!frame) return;
    const read = (id: NodeId | null): Box | null => {
      if (!id) return null;
      const el = frame.querySelector<HTMLElement>(`[data-fe-node="${id}"]`);
      if (!el) return null;
      const elRect = el.getBoundingClientRect();
      const fRect = frame.getBoundingClientRect();
      // Overlays position from the frame's padding box; rects are from the
      // border box — subtract the frame's border to stay pixel-exact.
      return {
        x: elRect.left - fRect.left - frame.clientLeft,
        y: elRect.top - fRect.top - frame.clientTop,
        w: elRect.width,
        h: elRect.height,
      };
    };
    setBoxes({ selected: read(state.selectedId), hovered: read(state.hoveredId) });
  }, [frameRef]);

  useEffect(() => {
    const unsubSel = useEditor.subscribe((s, prev) => {
      if (
        s.selectedId !== prev.selectedId ||
        s.hoveredId !== prev.hoveredId ||
        s.dropTarget !== prev.dropTarget
      ) {
        measure();
      }
    });
    return unsubSel;
  }, [measure]);

  return { boxes, measure };
}

/** Slim creation-tool strip shown while a creation tool is armed. */
function ToolStrip({ onExit }: { onExit: () => void }) {
  const tool = useEditor((s) => s.tool);
  const label =
    tool === "text"
      ? "Drag on the canvas to draw a text box"
      : tool === "heading"
        ? "Drag to draw a heading"
        : tool === "button"
          ? "Drag to place a button"
          : tool === "image"
            ? "Drag to place an image"
            : tool === "scene3d"
              ? "Drag to place a 3D scene"
              : "";
  return (
    <div className="pointer-events-none absolute left-1/2 top-3 z-30 -translate-x-1/2">
      <div className="pointer-events-auto flex items-center gap-2.5 rounded-full border border-accent-600/60 bg-ink-900/95 px-3.5 py-1.5 shadow-[0_4px_16px_rgba(0,0,0,0.5)]">
        <span className="size-1.5 animate-pulse rounded-full bg-accent-500" />
        <span className="text-[11.5px] font-medium text-accent-400">{label}</span>
        <button
          className="rounded px-1 text-[11px] text-ink-400 hover:text-ink-100"
          onClick={onExit}
          title="Back to select tool (Esc)"
        >
          Esc
        </button>
      </div>
    </div>
  );
}

/**
 * Drop preview for HTML5 drags (palette / assets / effects): the host box that
 * will own the element plus the ghost box where it will land.
 */
function DropPreview({ ghost, hostRect }: { ghost: Rect | null; hostRect: Rect | undefined }) {
  if (!ghost && !hostRect) return null;
  return (
    <>
      {hostRect && (
        <div
          className="pointer-events-none absolute z-20 rounded-sm border-2 border-dashed border-accent-500/90 bg-accent-500/10"
          style={{
            left: hostRect.left,
            top: hostRect.top,
            width: hostRect.right - hostRect.left,
            height: hostRect.bottom - hostRect.top,
          }}
        />
      )}
      {ghost && (
        <div
          className="pointer-events-none absolute z-20 rounded-sm border border-accent-400 bg-accent-500/20"
          style={{
            left: ghost.left,
            top: ghost.top,
            width: ghost.right - ghost.left,
            height: ghost.bottom - ghost.top,
          }}
        />
      )}
    </>
  );
}

export function Canvas() {
  const project = useEditor((s) => s.getProject());
  const page = useEditor((s) => s.getPage());
  const viewport = useEditor((s) => s.viewport);
  const selectedId = useEditor((s) => s.selectedId);
  const hoveredId = useEditor((s) => s.hoveredId);
  const drag = useEditor((s) => s.drag);
  const tool = useEditor((s) => s.tool);
  const setTool = useEditor((s) => s.setTool);
  const setDropTarget = useEditor((s) => s.setDropTarget);
  const select = useEditor((s) => s.select);
  const hover = useEditor((s) => s.hover);
  const frameRef = useRef<HTMLDivElement>(null);
  const { boxes, measure } = useOverlayBox(frameRef);
  /** Rubber-band rect while drawing a new element with a creation tool. */
  const [drawRect, setDrawRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  /** Live preview for HTML5 drags (palette / assets / effects). */
  const [preview, setPreview] = useState<{ target: DropTarget; ghost: Rect | null } | null>(null);
  /** Only the boolean is subscribed here: per-move chrome lives in its own
   * subscriber so pointer moves never re-render the page tree. */
  const boxDragActive = useBoxDrag((s) => s.active);

  /** Collect frame-local rects of every rendered node for box hit-testing. */
  const collectRects = useCallback((): Map<NodeId, Rect> => {
    const frame = frameRef.current;
    const out = new Map<NodeId, Rect>();
    if (!frame) return out;
    const fRect = frame.getBoundingClientRect();
    for (const el of frame.querySelectorAll<HTMLElement>("[data-fe-node]")) {
      const id = el.dataset.feNode as NodeId;
      const r = el.getBoundingClientRect();
      out.set(id, {
        left: r.left - fRect.left,
        top: r.top - fRect.top,
        right: r.right - fRect.left,
        bottom: r.bottom - fRect.top,
      });
    }
    return out;
  }, []);

  /** Resolves the drop a pointer position produces. Free placement by default. */
  const resolveDropAt = useCallback(
    (
      clientX: number,
      clientY: number,
      opts: {
        layout?: boolean;
        exact?: boolean;
        grab?: { x: number; y: number };
        excludeId?: NodeId;
        /** Size of the box being placed — clamps the landing inside its host. */
        size?: { w: number; h: number };
      } = {},
    ): DropTarget | null => {
      const frame = frameRef.current;
      if (!frame) return null;
      const s = useEditor.getState();
      const projectNow = s.getProject();
      const pageNow = s.getPage();
      if (!projectNow || !pageNow) return null;
      const fRect = frame.getBoundingClientRect();
      return resolveDrop(
        projectNow,
        pageNow.rootId,
        clientX - fRect.left,
        clientY - fRect.top,
        collectRects(),
        {
          excludeId: opts.excludeId,
          mode: opts.layout ? "flow" : "free",
          snap: !opts.exact && s.snapToGrid,
          grab: opts.grab,
          size: opts.size,
        },
      );
    },
    [collectRects],
  );

  /**
   * When the resolver reports the page root as host, the store materializes the
   * page's canvas layer as the real host — so the coordinates have to be
   * rebased onto that layer's own origin.
   */
  const rebaseToCanvasLayer = useCallback(
    (target: FreeDrop): FreeDrop => {
      const s = useEditor.getState();
      const pageNow = s.getPage();
      const projectNow = s.getProject();
      if (!pageNow || !projectNow || target.hostId !== pageNow.rootId) return target;
      const layerId = canvasLayerId(projectNow, pageNow.rootId);
      if (!layerId) return target;
      const rects = collectRects();
      const rootRect = rects.get(pageNow.rootId);
      const layerRect = rects.get(layerId);
      if (!rootRect || !layerRect) return target;
      return {
        ...target,
        x: target.x - (layerRect.left - rootRect.left),
        y: target.y - (layerRect.top - rootRect.top),
      };
    },
    [collectRects],
  );

  /**
   * Min-height a host needs for a box landing at `top` with `height` — and only
   * when the host is genuinely too short for it. min-height can only ever grow
   * a box, so asking for growth on a tall host would just leave pointless
   * declarations in the exported CSS.
   */
  const neededHostHeight = useCallback(
    (hostId: NodeId, top: number, height: number): number | undefined => {
      const s = useEditor.getState();
      const pageNow = s.getPage();
      const projectNow = s.getProject();
      if (!pageNow || !projectNow) return undefined;
      const rects = collectRects();
      // Empty page space is hosted by the canvas layer, so measure that instead.
      const realHost =
        hostId === pageNow.rootId
          ? (canvasLayerId(projectNow, pageNow.rootId) ?? pageNow.rootId)
          : hostId;
      const hostRect = rects.get(realHost);
      const needed = Math.round(top + height + GRID_CELL * 2);
      if (hostRect && needed <= hostRect.bottom - hostRect.top) return undefined;
      return needed;
    },
    [collectRects],
  );

  /**
   * Applies a resolved drop: layout insertion rejoins the flow, free placement
   * reparents + positions in one transaction (one undo step), growing the host
   * so the box is never clipped.
   */
  const applyDrop = useCallback(
    (
      dragId: NodeId,
      target: DropTarget,
      meta: { layout: boolean; exact: boolean },
      size: { w: number; h: number },
    ) => {
      const s = useEditor.getState();
      if (target.mode === "insert") {
        // Layout drop: the element joins the host's flow and stops being free.
        s.dropToLayout(dragId, target.parentId, target.index);
        return;
      }
      const free = rebaseToCanvasLayer(target);
      s.dropFree(dragId, {
        hostId: free.hostId,
        left: free.x,
        top: free.y,
        hostMinHeight: neededHostHeight(target.hostId, free.y, size.h),
        snap: !meta.exact,
        // What the ghost outlined is exactly what lands: a flow child
        // stretched by its host would otherwise shrink-wrap once freed.
        pinSize: size,
      });
    },
    [rebaseToCanvasLayer, neededHostHeight],
  );

  /** Pointer-down on a node box: start a box drag (after 4px travel). */
  const startBoxDragFromNode = useCallback(
    (e: React.PointerEvent, nodeId: NodeId) => {
      const frame = frameRef.current;
      if (!frame || e.button !== 0) return;
      const target = e.target as HTMLElement;
      if (target.isContentEditable || target.closest("[data-fe-no-drag]")) return;
      const projectNow = useEditor.getState().getProject();
      const pageNow = useEditor.getState().getPage();
      if (!projectNow || !pageNow) return;
      if (nodeId === pageNow.rootId) return; // the page root is the page itself
      const node = projectNow.nodes[nodeId];
      if (!node) return;

      const fRect = frame.getBoundingClientRect();
      const el = frame.querySelector<HTMLElement>(`[data-fe-node="${nodeId}"]`);
      if (!el) return;
      const elRect = el.getBoundingClientRect();
      const size = { w: elRect.width, h: elRect.height };
      // Drag the box by the point that was grabbed, not by its centre.
      const grab = { x: e.clientX - elRect.left, y: e.clientY - elRect.top };
      const start = { x: e.clientX, y: e.clientY };
      const label = node.name;

      const onMove = (ev: PointerEvent) => {
        const dx = ev.clientX - start.x;
        const dy = ev.clientY - start.y;
        if (Math.abs(dx) + Math.abs(dy) < 4) return;
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
        beginBoxDrag({
          dragId: nodeId,
          label,
          startClient: { x: start.x, y: start.y },
          grab: { x: grab.x, y: grab.y },
          size,
          getFrameRect: () => {
            const r = frameRef.current?.getBoundingClientRect();
            return { left: r?.left ?? fRect.left, top: r?.top ?? fRect.top };
          },
          collectRects,
          project: () => useEditor.getState().getProject(),
          pageRootId: pageNow.rootId,
          onDrop: (t, meta) => {
            if (t) applyDrop(nodeId, t, meta, size);
          },
        });
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    },
    [collectRects, applyDrop],
  );

  // Re-measure after any project mutation (layout shifts), on scroll and resize.
  useEffect(() => {
    measure();
    const t = window.setTimeout(measure, 60);
    // The canvas scrolls inside its own container, not the window — and which
    // container that is can change. Capture-phase listening catches a scroll
    // from ANY ancestor, so outlines, handles and drop chrome can never stay
    // behind at the position the page had before the scroll.
    const onScroll = () => measure();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    const frame = frameRef.current;
    const ro = frame ? new ResizeObserver(onScroll) : null;
    if (ro && frame) ro.observe(frame);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
      ro?.disconnect();
    };
  }, [project, page, viewport, measure]);

  if (!project || !page) return null;

  const wiring: EditorWiring = {
    selectedId,
    hoveredId,
    onSelect: (id) => select(id),
    onHover: (id) => hover(id),
  };

  const width = VIEWPORT_WIDTH[viewport];
  const root = project.nodes[page.rootId];
  const isEmpty = root && root.children.length === 0;

  /** Frame-local coordinates of a pointer event. */
  const framePoint = (clientX: number, clientY: number) => {
    const frame = frameRef.current!;
    const fRect = frame.getBoundingClientRect();
    return { x: clientX - fRect.left, y: clientY - fRect.top };
  };

  /** Store-shaped drop target — drives the structure tree's insertion line. */
  const toStoreTarget = (cell: DropTarget, hostRect?: Rect | null): NonNullable<EditorState["dropTarget"]> =>
    cell.mode === "insert"
      ? { parentId: cell.parentId, index: cell.index, mode: "before", rectKey: cell.rectKey }
      : {
          parentId: cell.hostId,
          index: 0,
          mode: "inside",
          // Host rect folded in: the outline must re-render when the host
          // itself scrolls or resizes, not only when the resolved cell changes.
          rectKey: `${cell.rectKey}|${
            hostRect
              ? [hostRect.left, hostRect.top, hostRect.right, hostRect.bottom].map(Math.round).join(",")
              : "none"
          }`,
        };

  /** Size a palette drag creates at (also the ghost size). */
  const dragSize = (type: string | undefined): { w: number; h: number } =>
    DROP_SIZE[(type as ElementType) ?? "image"] ?? { w: 240, h: 80 };

  /** Measured size of a rendered node, for host-growth math. */
  const measuredBox = (id: NodeId): { w: number; h: number } => {
    const r = collectRects().get(id);
    return r ? { w: r.right - r.left, h: r.bottom - r.top } : { w: 240, h: 80 };
  };

  /**
   * The size the drag chrome promises — and exactly what a drop creates:
   * dragged nodes keep their measured box, assets/effects the fixed create
   * size, everything else the palette default for its type.
   */
  const ghostSizeFor = (d: EditorState["drag"]): { w: number; h: number } => {
    if (d?.kind === "node" && d.id) return measuredBox(d.id);
    if (d?.kind === "asset" && d.assetId) {
      const isModel = project.assets[d.assetId]?.type === "model";
      return isModel ? { w: 280, h: 200 } : { w: 200, h: 150 };
    }
    if (d?.kind === "effect") return { w: 560, h: 360 };
    return dragSize(d?.type);
  };

  /* ---------------- draw-to-create (rubber band) ---------------- */

  const onFramePointerDown = (e: React.PointerEvent) => {
    if (tool === "select") return;
    if (e.button !== 0) return;
    const s = useEditor.getState();
    if (!s.getProject() || !s.getPage()) return;
    // The drawn box lands wherever it is drawn: it becomes a free child of the
    // nearest container under the start point (the page's canvas layer when
    // that is empty space).
    const startTarget = resolveDropAt(e.clientX, e.clientY, { grab: { x: 0, y: 0 } });
    const hostId = startTarget?.mode === "free" ? startTarget.hostId : undefined;
    const hostOrigin =
      startTarget?.mode === "free" ? { x: startTarget.x, y: startTarget.y } : { x: 0, y: 0 };

    const frame = frameRef.current!;
    // Frame-local coords re-derive per event so a scroll or reflow mid-draw
    // doesn't skew the rubber band or the landing.
    const framePoint = (clientX: number, clientY: number) => {
      const r = frame.getBoundingClientRect();
      return { x: clientX - r.left, y: clientY - r.top };
    };
    const start = framePoint(e.clientX, e.clientY);
    setDrawRect({ x: start.x, y: start.y, w: 0, h: 0 });

    const onMove = (ev: PointerEvent) => {
      const p = framePoint(ev.clientX, ev.clientY);
      const x = Math.min(start.x, p.x);
      const y = Math.min(start.y, p.y);
      const w = Math.abs(p.x - start.x);
      const h = Math.abs(p.y - start.y);
      setDrawRect({ x, y, w, h });
    };
    const onUp = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setDrawRect(null);
      const end = framePoint(ev.clientX, ev.clientY);
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const type = TOOL_ELEMENT[tool];
      // A plain click still creates — with sensible default dimensions.
      useEditor.getState().createAtPoint(type, {
        left: hostOrigin.x + Math.min(0, dx),
        top: hostOrigin.y + Math.min(0, dy),
        width: Math.max(24, Math.abs(dx)),
        height: Math.max(24, Math.abs(dy)),
        ...(hostId ? { parentId: hostId } : {}),
      });
      setTool("select");
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  /* ---------------- asset + external drops ---------------- */

  const handleAssetDrop = (e: React.DragEvent, target: DropTarget | null): boolean => {
    const dt = e.dataTransfer;
    const file = dt.files?.[0];
    const uri = dt.getData("text/uri-list");
    const feAsset = dt.getData("text/fe-asset");
    if (!file && !uri && !feAsset) return false;
    e.preventDefault();
    const p = framePoint(e.clientX, e.clientY);
    const free = target?.mode === "free" ? rebaseToCanvasLayer(target) : null;
    const hostId = target?.mode === "free" ? target.hostId : undefined;
    /** Where the dropped asset lands (host-relative when a box was targeted). */
    const at = free ? { left: free.x, top: free.y } : { left: p.x - 100, top: p.y - 75 };
    const hostGrow = hostId ? neededHostHeight(hostId, at.top, 200) : undefined;
    const place = (assetId: string) => {
      useEditor.getState().createAtPoint("image", {
        ...at,
        width: 200,
        height: 150,
        props: { assetId, alt: "" },
        ...(hostId ? { parentId: hostId, hostMinHeight: hostGrow } : {}),
      });
    };
    const placeModel = (assetId: string) => {
      const s = useEditor.getState();
      // One history step: the model is part of the node from the start.
      s.createAtPoint("scene3d", {
        ...at,
        width: 280,
        height: 200,
        ...(hostId ? { parentId: hostId, hostMinHeight: hostGrow } : {}),
        scene3d: { modelAssetId: assetId },
      });
    };
    if (feAsset) {
      place(feAsset);
      return true;
    }
    if (file) {
      void useEditor.getState().addAssetFromFile(file).then((id) => {
        if (!id) return;
        const kind = useEditor.getState().getProject()?.assets[id]?.type;
        // 3D asset: create a scene node with the model assigned.
        if (kind === "model") placeModel(id);
        else place(id);
      });
      return true;
    }
    if (uri && /^https?:/i.test(uri)) {
      // Remote image / model URL: register as an asset by URL, then place.
      const isModel = /\.(glb|gltf)(\?|$)/i.test(uri);
      const id = `asset${Date.now().toString(36)}`;
      useEditor.getState().addAsset({
        id,
        name: uri.split("/").pop() || "asset",
        type: isModel ? "model" : "image",
        src: uri,
      });
      if (isModel) placeModel(id);
      else place(id);
    }
    return true;
  };

  return (
    <div
      className="relative flex-1 overflow-auto bg-ink-950"
      style={{
        backgroundImage:
          "radial-gradient(circle at 1px 1px, rgba(53,64,90,0.35) 1px, transparent 0)",
        backgroundSize: "8px 8px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) select(null);
      }}
    >
      <div className="flex min-h-full w-full justify-center p-8">
        <div
          ref={frameRef}
          data-fe-frame=""
          className="relative shrink-0 overflow-hidden rounded-lg border border-ink-600 bg-ink-900 shadow-[0_0_60px_rgba(0,0,0,0.5)]"
          style={{ width, maxWidth: "100%", cursor: tool === "select" ? undefined : "crosshair" }}
          onClick={(e) => {
            if (e.target === e.currentTarget) select(null);
          }}
          onPointerDown={
            tool === "select"
              ? (e) => {
                  // Any element box can be grabbed — free elements included.
                  const host = (e.target as HTMLElement).closest?.("[data-fe-node]") as HTMLElement | null;
                  if (host) startBoxDragFromNode(e, host.dataset.feNode as NodeId);
                }
              : onFramePointerDown
          }
          onDragStart={(e) => {
            // Never let the browser start its own drag from inside the canvas.
            // An <img> is draggable by default, so moving a picture hijacked the
            // gesture: the pointer drag died and the native drag delivered a
            // uri-list the drop handler read as "a new image was dropped" —
            // which is why dragging an element appeared to duplicate it.
            if ((e.target as HTMLElement)?.closest?.("[data-fe-node]")) e.preventDefault();
          }}
          onDragOver={(e) => {
            if (tool !== "select") return;
            if (!useEditor.getState().drag && !e.dataTransfer.types.includes("Files") && !e.dataTransfer.types.includes("text/fe-asset") && !e.dataTransfer.types.includes("text/uri-list") && !e.dataTransfer.types.includes("text/fe-effect")) return;
            e.preventDefault();
            // Must MATCH the source's effectAllowed (palette/asset/effect drags
            // are copy-only): advertising "move" makes the browser silently
            // cancel the release — the ghost shows but nothing ever drops.
            e.dataTransfer.dropEffect = "copy";
            const d = useEditor.getState().drag;
            const size = ghostSizeFor(d);
            const target = resolveDropAt(e.clientX, e.clientY, {
              layout: e.shiftKey,
              exact: e.altKey,
              grab: { x: size.w / 2, y: size.h / 2 },
              size,
            });
            const rects = collectRects();
            setPreview({ target: target as DropTarget, ghost: target ? ghostRect(target, rects, size) : null });
            if (target) {
              const hostId = target.mode === "free" ? target.hostId : target.parentId;
              const storeTarget = toStoreTarget(target, rects.get(hostId));
              const cur = useEditor.getState().dropTarget;
              if (storeTarget.rectKey !== cur?.rectKey) setDropTarget(storeTarget);
            }
          }}
          onDragLeave={(e) => {
            if (!frameRef.current?.contains(e.relatedTarget as Node)) {
              setDropTarget(null);
              setPreview(null);
            }
          }}
          onDrop={(e) => {
            const dragged = useEditor.getState().drag;
            const dropSize = ghostSizeFor(dragged);
            const dropped = resolveDropAt(e.clientX, e.clientY, {
              layout: e.shiftKey,
              exact: e.altKey,
              grab: { x: dropSize.w / 2, y: dropSize.h / 2 },
              excludeId: dragged?.kind === "node" ? dragged.id : undefined,
              size: dropSize,
            });
            setPreview(null);
            if (handleAssetDrop(e, dropped)) {
              useEditor.getState().setDrag(null);
              setDropTarget(null);
              return;
            }
            e.preventDefault();
            const s = useEditor.getState();
            const d = s.drag;
            setDropTarget(null);
            if (!d) return;
            const exact = e.altKey;
            /* Layout drop (Shift) or a plain free drop. */
            if (!dropped) {
              s.setDrag(null);
              return;
            }
            if (dropped.mode === "insert") {
              // Sections are the page's flow backbone: they always land as
              // page blocks, everything else can be inserted anywhere.
              if (d.kind === "new" && d.section) {
                if (dropped.parentId === page.rootId) s.addSectionAt(d.section, dropped.index);
                else s.addSectionAt(d.section);
              } else if (d.kind === "new" && d.type) {
                s.addElementAt(d.type, dropped.parentId, dropped.index, {
                  name: d.style ? d.label : undefined,
                  props: d.props,
                  style: d.style,
                });
              } else if (d.kind === "node" && d.id) {
                applyDrop(d.id, dropped, { layout: true, exact }, measuredBox(d.id));
              }
            } else if (d.kind === "node" && d.id) {
              // Dragging an existing element out of or into another box.
              applyDrop(d.id, dropped, { layout: false, exact }, measuredBox(d.id));
            } else {
              // New content dropped from a panel: created where it was dropped.
              const free = rebaseToCanvasLayer(dropped);
              if (d.kind === "new" && d.section) {
                s.addSectionAt(d.section);
              } else if (d.kind === "new" && d.type) {
                s.createAtPoint(d.type, {
                  left: free.x,
                  top: free.y,
                  width: dropSize.w,
                  height: dropSize.h,
                  parentId: free.hostId,
                  hostMinHeight: neededHostHeight(dropped.hostId, free.y, dropSize.h),
                  // Style presets (text variants, surfaces) carry their patch.
                  name: d.style ? d.label : undefined,
                  props: d.props as ElementNode["props"] | undefined,
                  style: d.style,
                });
              } else if (d.kind === "effect" && d.effectId) {
                // An effect is a BACKGROUND: it fills the box it was dropped on
                // and paints behind that box's content, so nothing on the page
                // moves. One history step, so Ctrl+Z removes the whole thing.
                s.addSceneBackdrop(dropped.hostId, effectConfig(getEffect3D(d.effectId)!));
              } else if (d.kind === "asset" && d.assetId) {
                const isModel = project.assets[d.assetId]?.type === "model";
                if (isModel) {
                  s.createAtPoint("scene3d", {
                    left: free.x,
                    top: free.y,
                    width: 280,
                    height: 200,
                    parentId: free.hostId,
                    hostMinHeight: neededHostHeight(dropped.hostId, free.y, 200),
                    scene3d: { modelAssetId: d.assetId },
                  });
                } else {
                  s.createAtPoint("image", {
                    left: free.x,
                    top: free.y,
                    width: 200,
                    height: 150,
                    parentId: free.hostId,
                    props: { assetId: d.assetId, alt: "" },
                    hostMinHeight: neededHostHeight(dropped.hostId, free.y, 150),
                  });
                }
              }
            }
            s.setDrag(null);
          }}
        >
          <div className="relative z-[1]" style={themeVars(project.theme) as React.CSSProperties}>
            <PageView project={project} page={page} breakpoint={viewport} editorWiring={wiring} />
          </div>

          {/* Box grid: every box is a placement anchor (toggle with G). Sits
              over the page so the boxes read as guides, under the chrome. */}
          <GridOverlay />

          {/* Hover outline (skip when hovering the selected node) */}
          {boxes.hovered && !drag && tool === "select" && selectedId !== hoveredId && (
            <div
              className="fe-outline-hover pointer-events-none absolute rounded-sm"
              style={{ left: boxes.hovered.x, top: boxes.hovered.y, width: boxes.hovered.w, height: boxes.hovered.h }}
            />
          )}

          {/* Selection outline (frame-local) + toolbar/handles in a document
              portal: an element above or outside the canvas must still be
              configurable — the frame never hides its own options. */}
          {boxes.selected && !drag && tool === "select" && <SelectionOverlay box={boxes.selected} onMeasure={measure} portal />}

          {/* Draw-to-create rubber band */}
          {drawRect && (
            <div
              className="pointer-events-none absolute z-20 rounded-sm border border-dashed border-accent-500 bg-accent-500/10"
              style={{ left: drawRect.x, top: drawRect.y, width: drawRect.w, height: drawRect.h }}
            >
              <span className="absolute -top-5 left-0 whitespace-nowrap rounded bg-accent-600 px-1.5 py-0.5 text-[10px] font-semibold text-ink-950">
                {tool !== "select" ? ELEMENT_DEFS[TOOL_ELEMENT[tool]].label : ""} · {Math.round(drawRect.w)}×{Math.round(drawRect.h)}
              </span>
            </div>
          )}

          {/* Box drag (pointer): ghost, host, connector, source dim. */}
          <BoxDragOverlay project={project} collectRects={collectRects} />

          {/* HTML5 drags (palette / assets / effects): host + landing ghost */}
          {drag &&
            preview &&
            !boxDragActive &&
            (() => {
              const rects = collectRects();
              const hostId =
                preview.target.mode === "free" ? preview.target.hostId : preview.target.parentId;
              // Effects fill the highlighted box instead of landing as a box of
              // their own, so only the host outline is shown for them.
              return (
                <DropPreview
                  ghost={drag.kind === "effect" ? null : preview.ghost}
                  hostRect={rects.get(hostId)}
                />
              );
            })()}

          {/* Drag ghost chip */}
          {drag && (
            <div className="pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2 rounded-full border border-accent-600/60 bg-ink-900/95 px-3 py-1 text-[11px] font-medium text-accent-400 shadow-lg">
              {drag.kind === "new"
                ? `Place “${drag.label}”`
                : drag.kind === "asset"
                  ? `Place “${drag.label}”`
                  : drag.kind === "effect"
                    ? `Background “${drag.label}”`
                    : `Move “${drag.label}”`}{" "}
              — {drag.kind === "effect" ? "release to fill the highlighted box" : "release to place · Shift for layout · Alt for exact"}
            </div>
          )}

          {/* Creation tool strip */}
          {tool !== "select" && <ToolStrip onExit={() => setTool("select")} />}

          {/* Empty page state */}
          {isEmpty && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="pointer-events-auto flex max-w-sm flex-col items-center gap-3 rounded-xl border border-dashed border-ink-600 bg-ink-900/90 px-8 py-7 text-center">
                <div className="flex size-11 items-center justify-center rounded-lg bg-accent-600/15 text-accent-400">
                  <EditorIcon name="plus" size={20} />
                </div>
                <div className="text-[14px] font-semibold text-ink-100">Start building this page</div>
                <p className="text-[12px] leading-relaxed text-ink-400">
                  Add a ready-made section from the palette, draw a text box with the Text tool, or drop any element here — it lands exactly where you release it.
                </p>
                <div className="flex gap-1.5 text-[11px] text-ink-500">
                  <span className="rounded border border-ink-600 bg-ink-850 px-1.5 py-0.5 font-mono">A</span>
                  add section
                  <span className="mx-1 text-ink-700">·</span>
                  <span className="rounded border border-ink-600 bg-ink-850 px-1.5 py-0.5 font-mono">T</span>
                  text tool
                  <span className="mx-1 text-ink-700">·</span>
                  <span className="rounded border border-ink-600 bg-ink-850 px-1.5 py-0.5 font-mono">?</span>
                  shortcuts
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Status chip: what is selected */}
      {selectedId && project.nodes[selectedId] && (
        <div className="pointer-events-none absolute bottom-3 left-3 z-10 rounded-md border border-ink-700 bg-ink-900/90 px-2.5 py-1 text-[11px] text-ink-400">
          <span className="font-medium text-ink-200">{project.nodes[selectedId].name}</span>
          <span className="mx-1.5 text-ink-600">·</span>
          {ELEMENT_DEFS[project.nodes[selectedId].type].label}
          <span className="mx-1.5 text-ink-600">·</span>
          <span className="font-mono text-[10px]">Del delete · ⌘D duplicate</span>
        </div>
      )}
    </div>
  );
}
