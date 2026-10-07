import { useEffect, useState } from "react";
import { useEditor } from "@/lib/store";
import { SECTION_PRESETS } from "@/schemas/sections";
import { GRID_CELL } from "@/lib/grid";
import { downloadProjectZip } from "@/lib/exporters";
import { Topbar, type WorkspaceTab } from "./Topbar";
import { StructureTree } from "./StructureTree";
import { Palette } from "./Palette";
import { AssetsPanel } from "./AssetsPanel";
import { EffectsPanel } from "./EffectsPanel";
import { ThemesPanel } from "./ThemesPanel";
import { Canvas } from "./Canvas";
import { Inspector } from "./Inspector";
import { SourcePanel } from "./SourcePanel";
import { ShortcutsModal } from "./ShortcutsModal";
import { EditorIcon } from "@/lib/editorIcons.tsx";
import { cancelBoxDrag, useBoxDrag } from "./boxDrag";
import { findParentId } from "@/lib/tree";

const isMac = typeof navigator !== "undefined" && /mac/i.test(navigator.platform);
const MOD = isMac ? "⌘" : "Ctrl";

export function Workspace({
  onPreview,
  onHome,
}: {
  onPreview: () => void;
  onHome: () => void;
}) {
  const [tab, setTab] = useState<WorkspaceTab>("design");
  const [helpOpen, setHelpOpen] = useState(false);
  const [side, setSide] = useState<"layers" | "assets" | "effects" | "themes">("layers");
  const undo = useEditor((s) => s.undo);
  const redo = useEditor((s) => s.redo);
  const project = useEditor((s) => s.getProject());

  // Keyboard shortcuts: undo/redo, delete, duplicate, escape, arrows, sections.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable) {
        return;
      }
      const state = useEditor.getState();
      const mod = e.ctrlKey || e.metaKey;

      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if ((e.key === "Delete" || e.key === "Backspace") && state.selectedId) {
        e.preventDefault();
        state.deleteElement(state.selectedId);
      } else if (mod && e.key.toLowerCase() === "d" && state.selectedId) {
        e.preventDefault();
        state.duplicateElement(state.selectedId);
      } else if (e.key === "Escape") {
        if (helpOpen) setHelpOpen(false);
        else if (state.drag || state.dropTarget || useBoxDrag.getState().active) {
          cancelBoxDrag();
          state.setDrag(null);
          state.setDropTarget(null);
        } else state.select(null);
      } else if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        setHelpOpen(true);
      } else if (state.selectedId && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault();
        const id = state.selectedId;
        const page = state.getPage();
        const node = state.getProject()?.nodes[id];
        if (!page || !node || id === page.rootId) return;
        if (node.style.base.position === "absolute") {
          // Free elements move: one box per press, eight boxes with Shift.
          const step = GRID_CELL * (e.shiftKey ? 8 : 1);
          const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
          const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
          state.nudgeAbsolute(id, dx, dy);
          // Moving down keeps the host tall enough for the box.
          const hostId = state.getProject() ? findParentId(state.getProject()!.nodes, id) : null;
          if (hostId) state.fitHostToNode(id, hostId);
        } else {
          // Flow elements reorder among their siblings.
          if (e.key === "ArrowUp" || (e.key === "ArrowLeft" && !e.altKey)) state.reorder(id, -1);
          if (e.key === "ArrowDown" || (e.key === "ArrowRight" && !e.altKey)) state.reorder(id, 1);
        }
      } else if (!mod && e.key.toLowerCase() === "g") {
        // "G" toggles the box grid (box guides + snap-to-box placement).
        e.preventDefault();
        state.toggleSnapToGrid();
      } else if (!mod && e.key.toLowerCase() === "a" && !state.selectedId) {
        // "A" opens quick-add: adds a Hero section at the end (fastest path to a page).
        e.preventDefault();
        state.addSectionAt(SECTION_PRESETS.find((p) => p.id === "hero") ? "hero" : SECTION_PRESETS[0].id);
      } else if (!mod && (e.key.toLowerCase() === "t" || e.key.toLowerCase() === "v") && !state.selectedId) {
        // "T" arms the text tool (draw a text box on the canvas); "V" resets to select.
        e.preventDefault();
        state.setTool(e.key.toLowerCase() === "t" ? "text" : "select");
      } else if (!mod && e.key.toLowerCase() === "p") {
        e.preventDefault();
        onPreview();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, onPreview, helpOpen]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Topbar
        tab={tab}
        onTab={setTab}
        onPreview={onPreview}
        onExport={() => {
          if (!project) return;
          // A failed export must never be silent: the previous version threw
          // inside the click handler and the button just appeared dead.
          void downloadProjectZip(project).catch((err: unknown) => {
            console.error("[Frontel export] failed:", err);
          });
        }}
        onHome={onHome}
        onHelp={() => setHelpOpen(true)}
      />
      {tab === "design" ? (
        <div className="flex min-h-0 flex-1">
          <aside className="flex w-64 shrink-0 flex-col border-r border-ink-700/60 bg-ink-900/50">
            <SidebarTabs side={side} onSide={setSide} />
            {side === "layers" && (
              <>
                <div className="min-h-0 flex-1 overflow-y-auto">
                  <StructureTree />
                </div>
                <Palette />
              </>
            )}
            {side === "assets" && (
              <div className="min-h-0 flex-1">
                <AssetsPanel />
              </div>
            )}
            {side === "effects" && (
              <div className="min-h-0 flex-1">
                <EffectsPanel />
              </div>
            )}
            {side === "themes" && (
              <div className="min-h-0 flex-1">
                <ThemesPanel />
              </div>
            )}
          </aside>
          <Canvas />
          <aside className="w-72 shrink-0 overflow-y-auto border-l border-ink-700/60 bg-ink-900/50">
            <Inspector />
          </aside>
        </div>
      ) : (
        <SourcePanel />
      )}
      {helpOpen && <ShortcutsModal onClose={() => setHelpOpen(false)} mod={MOD} />}
    </div>
  );
}

/** Sidebar mode switch: structure/palette, assets, effects gallery, themes. */
function SidebarTabs({
  side,
  onSide,
}: {
  side: "layers" | "assets" | "effects" | "themes";
  onSide: (s: "layers" | "assets" | "effects" | "themes") => void;
}) {
  return (
    <div className="flex h-8 shrink-0 items-center gap-1 border-b border-ink-700/60 bg-ink-900/60 px-2">
      {([
        ["layers", "layers", "Layers"],
        ["assets", "image", "Assets"],
        ["effects", "wand", "Effects"],
        ["themes", "palette", "Themes"],
      ] as const).map(([id, icon, label]) => (
        <button
          key={id}
          onClick={() => onSide(id)}
          className={`flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium transition-colors ${
            side === id ? "bg-accent-600/15 text-accent-400" : "text-ink-400 hover:bg-ink-800 hover:text-ink-200"
          }`}
          title={
            id === "assets"
              ? "Project assets — images, videos, 3D models"
              : id === "effects"
                ? "3D background effects — vanta.js + custom GLSL"
                : id === "themes"
                  ? "Theme templates — apply a full design system"
                  : "Page structure and element palette"
          }
        >
          <EditorIcon name={icon} size={11} />
          {label}
        </button>
      ))}
      <div className="flex-1" />
    </div>
  );
}
