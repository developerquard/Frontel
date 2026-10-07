import type { NodeId, Project } from "@/schemas/types";
import type { DropTarget, Rect } from "@/lib/grid";
import { useBoxDrag } from "./boxDrag";

/**
 * Box-grid drag chrome, rendered inside the canvas frame while a pointer drag
 * is live:
 *   - a ghost box at the exact spot the element will land (free placement)
 *   - the host box highlighted (dashed) so it is obvious what will own it
 *   - an insertion bar when Shift switches the drop into layout mode
 *   - the source box dimmed so the hole it leaves is visible
 *
 * It subscribes to the drag store itself: pointer moves re-render this overlay
 * only, never the page tree underneath.
 */
export function BoxDragOverlay({
  project,
  collectRects,
}: {
  project: Project;
  collectRects: () => Map<NodeId, Rect>;
}) {
  const active = useBoxDrag((s) => s.active);
  const line = useBoxDrag((s) => s.line);
  const target = useBoxDrag((s) => s.target);
  const originRect = useBoxDrag((s) => s.originRect);
  const ghost = useBoxDrag((s) => s.ghost);
  const label = useBoxDrag((s) => s.label);
  const layout = useBoxDrag((s) => s.layout);
  const exact = useBoxDrag((s) => s.exact);
  if (!active || !line) return null;

  const rects = collectRects();
  const hostId = target ? (target.mode === "free" ? target.hostId : target.parentId) : null;
  const hostRect = hostId ? rects.get(hostId) : undefined;

  /** Insertion bar for a layout drop (null when there is no sibling anchor). */
  const bar = (() => {
    if (!target || target.mode !== "insert") return null;
    const parent = project.nodes[target.parentId];
    if (!parent) return null;
    const children = parent.children;
    const idx = Math.min(target.index, children.length);
    const anchorId = children[idx] ?? children[idx - 1];
    const anchor = anchorId ? rects.get(anchorId) : undefined;
    if (!anchor) return null;
    const dir = (parent.style.base.flexDirection ?? "row") as "row" | "column";
    const isNext = children[idx] === anchorId;
    if (dir === "row") {
      return {
        left: isNext ? anchor.left - 5 : anchor.right + 2,
        top: anchor.top,
        width: 3,
        height: anchor.bottom - anchor.top,
      };
    }
    return {
      left: anchor.left,
      top: isNext ? anchor.top - 5 : anchor.bottom + 2,
      width: anchor.right - anchor.left,
      height: 3,
    };
  })();

  const mode = layout ? "layout" : exact ? "exact" : "free";

  return (
    <DragChrome
      line={line}
      target={target}
      hostRect={hostRect}
      ghost={ghost}
      bar={bar}
      originRect={originRect}
      label={label}
      mode={mode}
    />
  );
}

function DragChrome({
  line,
  target,
  hostRect,
  ghost,
  bar,
  originRect,
  label,
  mode,
}: {
  line: NonNullable<ReturnType<typeof useBoxDrag.getState>["line"]>;
  target: DropTarget | null;
  hostRect: Rect | undefined;
  ghost: Rect | null;
  bar: { left: number; top: number; width: number; height: number } | null;
  originRect: Rect | null;
  label: string;
  mode: "free" | "layout" | "exact";
}) {
  return (
    <>
      {/* Source box dims while its content is in flight */}
      {originRect && (
        <div
          className="pointer-events-none absolute z-20 rounded-sm bg-ink-950/45 ring-1 ring-accent-600/40"
          style={{
            left: originRect.left,
            top: originRect.top,
            width: originRect.right - originRect.left,
            height: originRect.bottom - originRect.top,
          }}
        />
      )}

      {/* Host box: what will own the element after the drop */}
      {target && hostRect && (
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

      {/* Ghost: exactly where the box lands, at the size it keeps */}
      {ghost && (
        <div
          className="pointer-events-none absolute z-20 rounded-sm border border-accent-400 bg-accent-500/20"
          style={{
            left: ghost.left,
            top: ghost.top,
            width: ghost.right - ghost.left,
            height: ghost.bottom - ghost.top,
          }}
        >
          <span className="absolute -top-5 left-0 whitespace-nowrap rounded bg-accent-600 px-1.5 py-0.5 text-[10px] font-semibold text-ink-950">
            {Math.round(ghost.right - ghost.left)} × {Math.round(ghost.bottom - ghost.top)}
          </span>
        </div>
      )}

      {/* Insertion bar for layout drops */}
      {bar && (
        <div className="pointer-events-none absolute z-20" style={bar}>
          <div className="h-full w-full rounded-full bg-accent-500" />
        </div>
      )}

      {/* Connector line: from the grabbed box edge to the pointer */}
      <svg className="pointer-events-none absolute inset-0 z-30 size-full overflow-visible">
        <line
          x1={line.fromX}
          y1={line.fromY}
          x2={line.toX}
          y2={line.toY}
          stroke="#2dd4bf"
          strokeWidth={1.5}
          strokeDasharray="5 4"
        />
        <circle cx={line.fromX} cy={line.fromY} r={4} fill="#2dd4bf" />
        <circle cx={line.toX} cy={line.toY} r={5.5} fill="none" stroke="#2dd4bf" strokeWidth={1.5} />
        <circle cx={line.toX} cy={line.toY} r={2} fill="#2dd4bf" />
      </svg>

      {/* Follow chip: names the box being dragged + how it will land */}
      <div
        className="pointer-events-none absolute z-30 rounded-full border border-accent-600/70 bg-ink-900/95 px-2.5 py-0.5 text-[10.5px] font-semibold text-accent-400 shadow-lg"
        style={{ left: line.toX + 12, top: line.toY + 12 }}
      >
        {label}
        <span className="ml-1.5 font-normal text-ink-400">
          {mode === "layout" ? "into layout" : mode === "exact" ? "exact" : "free"}
        </span>
      </div>
    </>
  );
}
