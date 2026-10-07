import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ELEMENT_DEFS } from "@/schemas/registry";
import { useEditor } from "@/lib/store";
import { GRID_CELL, pxToBoxes } from "@/lib/grid";
import { offsetWithin, canvasFrameEl } from "@/lib/frame";
import { EditorIcon } from "@/lib/editorIcons.tsx";
import type { Box } from "./canvasTypes";

type Edge = "left" | "right" | "top" | "bottom";

/**
 * Selection chrome:
 *  - outline (inside the frame) + contextual toolbar (move / duplicate / add /
 *    link / animate / more) + eight resize handles on EVERY element, writing
 *    real width/height on the box grid
 *  - a live size readout while resizing, and a free ↔ layout toggle
 * The toolbar and handles render in a document portal, absolutely positioned
 * over the page — an element above or partially outside the canvas keeps its
 * options reachable (the frame's overflow can never clip them away).
 * All actions mutate the real schema via the store.
 */
export function SelectionOverlay({
  box,
  onMeasure,
  portal = false,
}: {
  box: Box;
  onMeasure: () => void;
  /** Render toolbar + handles through a document portal (never frame-clipped). */
  portal?: boolean;
}) {
  const project = useEditor((s) => s.getProject());
  const page = useEditor((s) => s.getPage());
  const selectedId = useEditor((s) => s.selectedId);
  const [more, setMore] = useState(false);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const moreRef = useRef<HTMLDivElement>(null);

  const node = project && selectedId ? project.nodes[selectedId] : null;
  const isRoot = node && page && node.id === page.rootId;

  // Close the "More" flyout on outside click.
  useEffect(() => {
    if (!more) return;
    const onDown = (e: MouseEvent) => {
      if (!moreRef.current?.contains(e.target as Node)) setMore(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [more]);

  // Close on Escape (second Escape deselects — handled in Workspace).
  useEffect(() => {
    if (!more) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMore(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [more]);

  const act = useCallback(
    (fn: (state: ReturnType<typeof useEditor.getState>) => void) => fn(useEditor.getState()),
    [],
  );

  if (!project || !page || !node || !selectedId) return null;

  const parentId = (() => {
    for (const candidate of Object.values(project.nodes)) {
      if (candidate.children.includes(selectedId)) return candidate.id;
    }
    return null;
  })();
  const siblings = parentId ? project.nodes[parentId].children : [];
  const idx = siblings.indexOf(selectedId);
  const canMove = !!parentId && !isRoot;
  const parent = parentId ? project.nodes[parentId] : null;
  const parentIsRow = ((parent?.style.base.flexDirection ?? "row") === "row") || parent?.type === "flex";
  const hasLink = node.onClick && node.onClick.kind !== "none";
  /** Node is free-positioned inside its host box. */
  const isFree = node.style.base.position === "absolute";
  const hostIsCanvasLayer = !!parent && parent.props?.freeformLayer === true;
  /** A container can host absolute children; leaves are placed in their parent. */
  const canBeFree = ELEMENT_DEFS[node.type].hasChildren || !!parent;

  /**
   * Resize gesture. One handler drives one or two edges (corners move both
   * dimensions); free nodes also follow with left/top on the left/top edges.
   * Alt gives pixel-exact sizing, otherwise every step lands on the box grid.
   */
  const startResize = (edges: Edge[]) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const el = document.querySelector<HTMLElement>(`[data-fe-node="${selectedId}"]`);
    const rect = el?.getBoundingClientRect();
    const startW = rect?.width ?? box.w;
    const startH = rect?.height ?? box.h;
    const startLeft = node.style.base.left ?? 0;
    const startTop = node.style.base.top ?? 0;

    const onMove = (ev: PointerEvent) => {
      const s = useEditor.getState();
      const exact = ev.altKey;
      const snapping = s.snapToGrid && !exact;
      const step = snapping ? GRID_CELL : 1;
      for (const edge of edges) {
        const horizontal = edge === "left" || edge === "right";
        const delta = horizontal ? ev.clientX - startX : ev.clientY - startY;
        const startPx = horizontal ? startW : startH;
        if (isFree) {
          s.resizeAbsolute(selectedId, edge, delta, startPx, { left: startLeft, top: startTop }, { snap: !exact });
        } else {
          s.resizeNode(selectedId, delta, edge, startPx);
        }
      }
      // Predicted values, so the readout matches what was just written.
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      const dw = edges.includes("right") ? dx : edges.includes("left") ? -dx : 0;
      const dh = edges.includes("bottom") ? dy : edges.includes("top") ? -dy : 0;
      const round = (v: number) => Math.max(GRID_CELL, Math.round(v / step) * step);
      setSize({ w: round(startW + dw), h: round(startH + dh) });
      // Growing a free box downwards grows the box that holds it, so the
      // content never spills outside its host.
      if (isFree && parentId) s.fitHostToNode(selectedId, parentId);
      onMeasure();
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setSize(null);
      if (isFree && parentId) useEditor.getState().fitHostToNode(selectedId, parentId);
      onMeasure();
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  /** Four edges + four corners: every element controls its width and length. */
  const handles: { key: string; edges: Edge[]; cursor: string; pos: React.CSSProperties }[] = [
    { key: "r", edges: ["right"], cursor: "ew-resize", pos: { right: -5, top: "50%", marginTop: -6 } },
    { key: "l", edges: ["left"], cursor: "ew-resize", pos: { left: -5, top: "50%", marginTop: -6 } },
    { key: "b", edges: ["bottom"], cursor: "ns-resize", pos: { bottom: -5, left: "50%", marginLeft: -6 } },
    { key: "t", edges: ["top"], cursor: "ns-resize", pos: { top: -5, left: "50%", marginTop: -6 } },
    { key: "rb", edges: ["right", "bottom"], cursor: "nwse-resize", pos: { right: -5, bottom: -5 } },
    { key: "lb", edges: ["left", "bottom"], cursor: "nesw-resize", pos: { left: -5, bottom: -5 } },
    { key: "rt", edges: ["right", "top"], cursor: "nesw-resize", pos: { right: -5, top: -5 } },
    { key: "lt", edges: ["left", "top"], cursor: "nwse-resize", pos: { left: -5, top: -5 } },
  ];

  /** Pull a flow element into free placement where it currently sits. */
  const makeFree = () => {
    const at = parentId ? offsetWithin(selectedId, parentId) : null;
    // Keep the rendered size — a host-stretched child would shrink-wrap once freed.
    const r = document.querySelector<HTMLElement>(`[data-fe-node="${selectedId}"]`)?.getBoundingClientRect();
    act((s) =>
      s.makeFree(selectedId, at ?? { left: 0, top: 0 },
        r ? { pinSize: { w: r.width, h: r.height } } : undefined),
    );
  };

  // Viewport-space anchor for portal chrome: the frame's origin plus the
  // frame-local box — toolbar/handles then track the element anywhere on
  // screen, including above or outside the canvas frame.
  const frameEl = portal ? canvasFrameEl() : null;
  const frameRect = frameEl?.getBoundingClientRect();
  const vx = frameRect ? frameRect.left + (frameEl?.clientLeft ?? 0) + box.x : box.x;
  const vy = frameRect ? frameRect.top + (frameEl?.clientTop ?? 0) + box.y : box.y;
  /** Fixed positions for each handle key in portal mode. */
  const fixedHandlePos: Record<string, { left: number; top: number }> = {
    r: { left: vx + box.w - 5, top: vy + box.h / 2 - 6 },
    l: { left: vx - 5, top: vy + box.h / 2 - 6 },
    b: { left: vx + box.w / 2 - 6, top: vy + box.h - 5 },
    t: { left: vx + box.w / 2 - 6, top: vy - 5 },
    rb: { left: vx + box.w - 5, top: vy + box.h - 5 },
    lb: { left: vx - 5, top: vy + box.h - 5 },
    rt: { left: vx + box.w - 5, top: vy - 5 },
    lt: { left: vx - 5, top: vy - 5 },
  };

  const chrome = (
    <>
      {/* Live size while resizing */}
      {size && (
        <div
          className={`pointer-events-none z-20 whitespace-nowrap rounded bg-ink-950/95 px-1.5 py-0.5 font-mono text-[10.5px] text-accent-400 ring-1 ring-accent-600/60 ${portal ? "fixed" : "absolute"}`}
          style={portal ? { left: vx, top: vy + box.h + 8 } : { left: box.x, top: box.y + box.h + 8 }}
        >
          {size.w} × {size.h}
          <span className="ml-1.5 text-ink-500">{pxToBoxes(size.w)} × {pxToBoxes(size.h)} boxes</span>
        </div>
      )}

      {/* Toolbar */}
      <div
        className={`${portal ? "fixed z-50" : "absolute z-10"} flex items-center gap-0.5 rounded-md border border-ink-600 bg-ink-900/95 p-0.5 shadow-[0_4px_16px_rgba(0,0,0,0.45)]`}
        style={
          portal
            ? { left: Math.max(8, vx), top: Math.max(8, vy - 30) }
            : { left: Math.max(2, box.x), top: Math.max(-26, box.y - 26) }
        }
        onPointerDown={(e) => e.stopPropagation()}
      >
        <span className="max-w-[90px] truncate rounded bg-accent-600/20 px-1.5 py-0.5 text-[10px] font-semibold text-accent-400">
          {ELEMENT_DEFS[node.type].label}
        </span>
        {isFree && (
          <span
            className="rounded bg-ink-700/70 px-1.5 py-0.5 text-[9.5px] font-medium uppercase tracking-wide text-ink-300"
            title={
              hostIsCanvasLayer
                ? "Free-positioned — drag it anywhere, resize it from any edge"
                : `Free-positioned inside ${parent?.name ?? "its box"} — resize it from any edge`
            }
          >
            free
          </span>
        )}
        {size && (
          <span className="rounded bg-ink-700/70 px-1.5 py-0.5 font-mono text-[9.5px] text-accent-400">
            {Math.round(box.w)} × {Math.round(box.h)}
          </span>
        )}
        {canMove && !isFree && (
          <>
            <TBtn
              icon="arrowUp"
              label={parentIsRow ? "Move back (←)" : "Move up (↑)"}
              disabled={idx <= 0}
              onClick={() => act((s) => s.reorder(selectedId, -1))}
            />
            <TBtn
              icon="arrowDown"
              label={parentIsRow ? "Move forward (→)" : "Move down (↓)"}
              disabled={idx >= siblings.length - 1}
              onClick={() => act((s) => s.reorder(selectedId, 1))}
            />
          </>
        )}
        {isFree && (
          <>
            <TBtn
              icon="arrowUp"
              label="Bring forward (layer above)"
              onClick={() => act((s) => s.reorderAbsolute(selectedId, 1))}
            />
            <TBtn
              icon="arrowDown"
              label="Send backward (layer below)"
              onClick={() => act((s) => s.reorderAbsolute(selectedId, -1))}
            />
          </>
        )}
        {!isRoot && (
          <TBtn icon="duplicate" label="Duplicate (⌘D)" onClick={() => act((s) => s.duplicateElement(selectedId))} />
        )}
        {node.type !== "section" && (
          <TBtn
            icon="plus"
            label="Add sibling element"
            onClick={() => act((s) => {
              const pid = parentId ?? page.rootId;
              s.addElementAt("stack", pid, idx + 1);
            })}
          />
        )}
        {ELEMENT_DEFS[node.type].hasChildren && (
          <TBtn
            icon="layers"
            label="Add child element"
            onClick={() => act((s) => s.addElementAt("stack", selectedId, node.children.length))}
          />
        )}
        <span className="mx-0.5 h-4 w-px bg-ink-700" />
        <TBtn
          icon={hasLink ? "link" : "external"}
          label={hasLink ? "Edit action (opens inspector)" : "Add action / link"}
          active={!!hasLink}
          onClick={() => {
            // Open inspector with the Action section visible.
            window.dispatchEvent(new CustomEvent("frontel:focus-action", { detail: selectedId }));
          }}
        />
        <TBtn
          icon="wand"
          label={node.animation ? "Edit animation" : "Add animation"}
          active={!!node.animation}
          onClick={() => {
            window.dispatchEvent(new CustomEvent("frontel:focus-animation", { detail: selectedId }));
          }}
        />
        <div className="relative" ref={moreRef}>
          <TBtn icon="settings" label="More" active={more} onClick={() => setMore((v) => !v)} />
          {more && (
            <div className="absolute right-0 top-7 z-30 w-48 overflow-hidden rounded-md border border-ink-600 bg-ink-900 py-1 shadow-[0_8px_24px_rgba(0,0,0,0.5)]">
              <MoreItem
                icon="type"
                label="Rename…"
                onClick={() => {
                  setMore(false);
                  window.dispatchEvent(new CustomEvent("frontel:focus-rename", { detail: selectedId }));
                }}
              />
              {canMove && isFree && (
                <>
                  <MoreItem
                    icon="arrowUp"
                    label="Bring to front"
                    onClick={() => act((s) => s.setZIndex(selectedId, Date.now() % 100000))}
                  />
                  <MoreItem
                    icon="arrowDown"
                    label="Send to back"
                    onClick={() => act((s) => s.setZIndex(selectedId, 0))}
                  />
                </>
              )}
              {canMove && !isFree && (
                <>
                  <MoreItem
                    icon="arrowUp"
                    label="Bring before previous"
                    disabled={idx <= 0}
                    onClick={() => act((s) => s.reorder(selectedId, -1))}
                  />
                  <MoreItem
                    icon="arrowDown"
                    label="Send after next"
                    disabled={idx >= siblings.length - 1}
                    onClick={() => act((s) => s.reorder(selectedId, 1))}
                  />
                </>
              )}
              {canBeFree && !isRoot && (
                <MoreItem
                  icon={isFree ? "layout" : "cursor"}
                  label={isFree ? "Return to layout" : "Make free (drag anywhere)"}
                  onClick={() => {
                    setMore(false);
                    if (isFree) act((s) => s.makeFlow(selectedId));
                    else makeFree();
                  }}
                />
              )}
              <MoreItem
                icon={node.style.base.visible === false ? "eye" : "eyeOff"}
                label={node.style.base.visible === false ? "Show element" : "Hide element"}
                onClick={() =>
                  act((s) =>
                    s.setStyle(selectedId, "base", { visible: node.style.base.visible === false }),
                  )
                }
              />
              {node.type === "section" && !isRoot && (
                <MoreItem
                  icon="anchor"
                  label={node.anchorId ? "Anchor: set" : "Set as anchor…"}
                  onClick={() => {
                    setMore(false);
                    window.dispatchEvent(new CustomEvent("frontel:focus-anchor", { detail: selectedId }));
                  }}
                />
              )}
              {!isRoot && (
                <MoreItem
                  icon="trash"
                  label="Delete (Del)"
                  danger
                  onClick={() => act((s) => s.deleteElement(selectedId))}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Resize handles — every element controls its own width and height */}
      {!isRoot &&
        handles.map((h) => (
          <div
            key={h.key}
            role="separator"
            aria-label={`Resize ${h.edges.join(" ")}`}
            title="Drag to resize · Alt for pixel-exact"
            className="fe-resize-handle z-10"
            style={
              portal
                ? { position: "fixed" as const, zIndex: 50, ...fixedHandlePos[h.key], cursor: h.cursor }
                : { position: "absolute" as const, ...h.pos, cursor: h.cursor }
            }
            onPointerDown={startResize(h.edges)}
          />
        ))}
    </>
  );

  // The outline lives inside the frame (clipped with it); everything the user
  // must be able to CLICK — toolbar, handles — renders in a document portal so
  // an element above or outside the canvas keeps its options reachable.
  return (
    <>
      <div
        className="fe-outline-selected pointer-events-none absolute rounded-sm"
        style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
      />
      {portal ? createPortal(chrome, document.body) : chrome}
    </>
  );
}

function TBtn({
  icon,
  label,
  onClick,
  disabled,
  active,
}: {
  icon: string;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex size-[24px] items-center justify-center rounded transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-accent-500 disabled:cursor-not-allowed disabled:opacity-30 ${
        active ? "text-accent-400" : "text-ink-400 hover:bg-ink-700 hover:text-ink-100"
      }`}
    >
      <EditorIcon name={icon} size={12.5} />
    </button>
  );
}

function MoreItem({
  icon,
  label,
  onClick,
  disabled,
  danger,
}: {
  icon: string;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[12px] transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
        danger ? "text-red-300 hover:bg-red-500/10" : "text-ink-300 hover:bg-ink-700/60 hover:text-ink-100"
      }`}
    >
      <EditorIcon name={icon} size={12} className="shrink-0 text-ink-500" />
      {label}
    </button>
  );
}
