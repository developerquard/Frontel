import { useEditor } from "@/lib/store";
import { EditorIcon, FrontelLogo } from "@/lib/editorIcons.tsx";
import { viewportLabel } from "@/lib/viewport";
import { Segmented } from "./ui";

export type WorkspaceTab = "design" | "source";

export function Topbar({
  tab,
  onTab,
  onPreview,
  onExport,
  onHome,
  onHelp,
}: {
  tab: WorkspaceTab;
  onTab: (t: WorkspaceTab) => void;
  onPreview: () => void;
  onExport: () => void;
  onHome: () => void;
  onHelp: () => void;
}) {
  const project = useEditor((s) => s.getProject());
  const viewport = useEditor((s) => s.viewport);
  const setViewport = useEditor((s) => s.setViewport);
  const undo = useEditor((s) => s.undo);
  const redo = useEditor((s) => s.redo);
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);
  const snapToGrid = useEditor((s) => s.snapToGrid);
  const toggleSnapToGrid = useEditor((s) => s.toggleSnapToGrid);

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-ink-700/60 bg-ink-900 px-4">
      <button onClick={onHome} className="flex items-center gap-2 rounded px-1 py-1 transition-colors hover:bg-ink-800" title="All projects">
        <FrontelLogo size={22} />
        <span className="text-[15px] font-bold tracking-tight text-ink-100">Frontel</span>
      </button>

      <div className="mx-1 h-5 w-px bg-ink-700" />
      <span className="max-w-48 truncate text-[13px] font-medium text-ink-300" title={project?.name}>
        {project?.name ?? "—"}
      </span>

      <SaveChip />

      <div className="flex-1" />

      {/* Box grid: box guides + snapping for placement, size and nudging */}
      <button
        onClick={toggleSnapToGrid}
        aria-pressed={snapToGrid}
        title={
          snapToGrid
            ? "Box grid on — drag, resize and nudge snap to the 8px boxes (G)"
            : "Box grid off — pixel-free placement and sizing (G)"
        }
        className={`inline-flex size-7 items-center justify-center rounded-md transition-colors ${
          snapToGrid ? "bg-accent-600/20 text-accent-400" : "text-ink-400 hover:bg-ink-700 hover:text-ink-100"
        }`}
      >
        <EditorIcon name="grid" size={13} />
      </button>

      <div className="mx-1 h-5 w-px bg-ink-700" />

      {/* Viewport switcher — mirrors the inspector breakpoint control */}
      <Segmented
        value={viewport}
        onChange={setViewport}
        size="sm"
        options={[
          // Tooltips come from the shared widths so the editor can never
          // advertise a size the canvas does not actually draw.
          { value: "desktop", icon: "monitor", tip: viewportLabel("desktop") },
          { value: "tablet", icon: "tablet", tip: viewportLabel("tablet") },
          { value: "mobile", icon: "phone", tip: viewportLabel("mobile") },
        ]}
      />

      <div className="mx-1 h-5 w-px bg-ink-700" />

      <div className="flex rounded-md border border-ink-600 bg-ink-850 p-0.5">
        {([["design", "Design"], ["source", "Source"]] as const).map(([t, label]) => (
          <button
            key={t}
            onClick={() => onTab(t)}
            className={`flex items-center gap-1 rounded px-2.5 py-1 text-[12px] font-medium transition-colors ${
              tab === t ? "bg-accent-600/20 text-accent-400" : "text-ink-400 hover:text-ink-200"
            }`}
          >
            <EditorIcon name={t === "design" ? "palette" : "code"} size={11} />
            {label}
          </button>
        ))}
      </div>

      <div className="flex gap-0.5">
        <button
          className="inline-flex size-7 items-center justify-center rounded-md text-ink-400 transition-colors hover:bg-ink-700 hover:text-ink-100 disabled:cursor-not-allowed disabled:opacity-35"
          onClick={undo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
          aria-label="Undo"
        >
          <EditorIcon name="undo" size={13} />
        </button>
        <button
          className="inline-flex size-7 items-center justify-center rounded-md text-ink-400 transition-colors hover:bg-ink-700 hover:text-ink-100 disabled:cursor-not-allowed disabled:opacity-35"
          onClick={redo}
          disabled={!canRedo}
          title="Redo (Ctrl+Shift+Z)"
          aria-label="Redo"
        >
          <EditorIcon name="redo" size={13} />
        </button>
        <button
          className="inline-flex size-7 items-center justify-center rounded-md text-ink-400 transition-colors hover:bg-ink-700 hover:text-ink-100"
          onClick={onHelp}
          title="Keyboard shortcuts (?)"
          aria-label="Keyboard shortcuts"
        >
          <EditorIcon name="keyboard" size={13} />
        </button>
      </div>

      <button
        onClick={onPreview}
        className="inline-flex items-center gap-1.5 rounded-md border border-ink-600 bg-ink-800 px-2.5 py-1.5 text-[12px] text-ink-200 transition-colors hover:bg-ink-700"
        title="Open live preview (P)"
      >
        <EditorIcon name="play" size={11} />
        Preview
      </button>
      <button
        onClick={onExport}
        className="inline-flex items-center gap-1.5 rounded-md border border-accent-600 bg-accent-600 px-2.5 py-1.5 text-[12px] font-semibold text-ink-950 transition-colors hover:bg-accent-500"
        title="Download the generated React + TypeScript project as a zip"
      >
        <EditorIcon name="download" size={12} />
        Export
      </button>
    </header>
  );
}

/** Autosave indicator: idle → saving → saved with a quiet check. */
function SaveChip() {
  const saveState = useEditor((s) => s.saveState);
  if (saveState === "idle") return null;
  return (
    <span
      className="flex items-center gap-1 text-[10.5px] text-ink-500"
      title={saveState === "saving" ? "Saving project…" : "All changes saved"}
      aria-live="polite"
    >
      {saveState === "saving" ? (
        <>
          <span className="size-1.5 animate-pulse rounded-full bg-accent-500/70" />
          saving…
        </>
      ) : (
        <>
          <EditorIcon name="cloudCheck" size={11} className="text-accent-500/80" />
          saved
        </>
      )}
    </span>
  );
}
