import { useEffect } from "react";
import { FrontelLogo } from "@/lib/editorIcons.tsx";

const GROUPS: { title: string; items: [string, string][] }[] = [
  {
    title: "Drag & drop anywhere",
    items: [
      ["Drag any element", "Grab it anywhere and drop it exactly where you want it"],
      ["Drop on a box", "It becomes a free child of that box (section, card, row)"],
      ["Drop on empty space", "It lands on the page's canvas layer"],
      ["Shift while dropping", "Layout instead: insert into a container's flow"],
      ["Alt while dragging", "Exact placement — no box snapping"],
      ["G", "Toggle the box grid (guides + snapping)"],
    ],
  },
  {
    title: "Essentials",
    items: [
      ["Click element", "Select it (toolbar + resize handles appear)"],
      ["Drag a handle", "Resize from any edge or corner, in boxes"],
      ["↑ ↓ ← →", "Move a free element one box (Shift: eight boxes)"],
      ["Del / Backspace", "Delete selection"],
      [`${"MOD"} D`, "Duplicate selection"],
      [`${"MOD"} Z`, "Undo · Shift to redo"],
      ["Esc", "Deselect / cancel drag"],
    ],
  },
  {
    title: "Build",
    items: [
      ["A", "Add a Hero section (empty page)"],
      ["T", "Text tool — drag on the canvas to draw a text box"],
      ["Double-click text", "Edit it in place, Enter to commit"],
      ["Free ⇄ layout", "Inspector → Position → make free / free ✓"],
      ["Drag scene ▸ Fill as background", "Inspector → 3D Scene → full-bleed backdrop"],
      ["Drag from palette", "Place any element exactly where you drop it"],
      ["↑ / ↓", "Reorder a layout element among its siblings"],
      ["Double-click tree name", "Rename element"],
    ],
  },
  {
    title: "Workspace",
    items: [
      ["P", "Open live preview"],
      ["?", "Toggle this shortcuts panel"],
      ["Toolbar ▸ More", "Rename, hide, reorder, anchor"],
    ],
  },
];

export function ShortcutsModal({ onClose, mod }: { onClose: () => void; mod: string }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl border border-ink-600 bg-ink-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 border-b border-ink-700/60 px-5 py-3.5">
          <FrontelLogo size={18} />
          <div className="flex-1 text-[14px] font-semibold text-ink-100">Shortcuts & basics</div>
          <button
            className="inline-flex size-6 items-center justify-center rounded text-ink-400 hover:bg-ink-700 hover:text-ink-100"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
          {GROUPS.map((g) => (
            <div key={g.title} className="mb-4 last:mb-0">
              <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-widest text-ink-500">{g.title}</div>
              <div className="flex flex-col gap-1">
                {g.items.map(([keys, desc]) => (
                  <div key={keys} className="flex items-baseline justify-between gap-4 text-[12.5px]">
                    <span className="rounded border border-ink-600 bg-ink-850 px-1.5 py-0.5 font-mono text-[11px] text-ink-300">
                      {keys.replace("MOD", mod)}
                    </span>
                    <span className="text-right text-ink-400">{desc}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
