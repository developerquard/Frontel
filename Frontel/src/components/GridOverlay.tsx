import { GRID_CELL } from "@/lib/grid";
import { useEditor } from "@/lib/store";

/**
 * Page-wide box grid rendered inside the canvas frame: every box is a placement
 * and resize anchor. Purely visual — the drag system reads the same cell math
 * from lib/grid. A stronger guide every 10 boxes keeps the fine grid readable.
 */
export function GridOverlay() {
  const enabled = useEditor((s) => s.snapToGrid);
  const tool = useEditor((s) => s.tool);
  if (!enabled || tool !== "select") return null;
  return (
    <div
      aria-hidden
      className="fe-grid-overlay pointer-events-none absolute inset-0 z-[5]"
      style={{
        backgroundImage:
          `linear-gradient(to right, rgba(45,212,191,0.05) 1px, transparent 1px),` +
          `linear-gradient(to bottom, rgba(45,212,191,0.04) 1px, transparent 1px),` +
          `linear-gradient(to right, rgba(45,212,191,0.13) 1px, transparent 1px)`,
        backgroundSize: `${GRID_CELL}px ${GRID_CELL}px, ${GRID_CELL}px ${GRID_CELL}px, ${GRID_CELL * 10}px ${GRID_CELL}px`,
        backgroundPosition: "-1px -1px, -1px -1px, -1px 0",
      }}
    />
  );
}
