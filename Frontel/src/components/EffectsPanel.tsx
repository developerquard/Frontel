/**
 * EffectsPanel — the "Effects" gallery.
 *
 * 30 preset 3D background effects (vanta.js + custom shaders + object
 * stages) shown as swatch cards with category tabs. Click adds the effect
 * to the page (full-bleed page background by default, or boxed scene when
 * an element is selected); cards are also draggable onto the canvas.
 */
import { useMemo, useState } from "react";
import { EFFECTS_3D, EFFECT_CATEGORIES, effectConfig, type Effect3DPreset, type EffectCategory } from "@/schemas/effects3d";
import { useEditor } from "@/lib/store";
import { findParentId } from "@/lib/tree";
import { ELEMENT_DEFS } from "@/schemas/registry";
import { EditorIcon } from "@/lib/editorIcons.tsx";
import { PanelHeader } from "./ui";
import type { NodeId, Project } from "@/schemas/types";

type Cat = EffectCategory | "all";

/**
 * The top-level page block a node lives in — the section an effect applied to
 * "what I am looking at" belongs to. Falls back to the page itself.
 */
function sectionOf(project: Project, pageRootId: NodeId, id: NodeId | null): NodeId {
  if (!id) return pageRootId;
  let cursor: NodeId | null = id;
  while (cursor) {
    const parentId = findParentId(project.nodes, cursor);
    if (!parentId) return pageRootId;
    if (parentId === pageRootId) return cursor;
    cursor = parentId;
  }
  return pageRootId;
}

function EffectCard({ preset }: { preset: Effect3DPreset }) {
  const setDrag = useEditor((s) => s.setDrag);
  const selectedId = useEditor((s) => s.selectedId);

  /**
   * Applies the effect in ONE undo step.
   *  - click: the effect becomes the background of the section the user is
   *    working in — it fills that box and paints behind its content, so nothing
   *    is pushed around the page ("it's background only")
   *  - right-click: a boxed, movable scene inside the selected box
   */
  const apply = (asBackground: boolean) => {
    const state = useEditor.getState();
    const project = state.getProject();
    const page = state.getPage();
    if (!project || !page) return;
    const cfg = effectConfig(preset);

    const selected = selectedId ? project.nodes[selectedId] : null;
    // Editing an already-selected scene: swap the effect in place.
    if (selected?.type === "scene3d" && asBackground) {
      state.setScene3D(selected.id, cfg);
      return;
    }

    if (!asBackground) {
      // Boxed scene: lives in the box the user has selected (or the page).
      const hostId =
        selected && ELEMENT_DEFS[selected.type].hasChildren
          ? selected.id
          : (findParentId(project.nodes, selectedId ?? "") ?? page.rootId);
      state.createAtPoint("scene3d", {
        left: 60,
        top: 60,
        width: 560,
        height: 360,
        parentId: hostId,
        style: { zIndex: 1 },
        scene3d: cfg,
      });
      return;
    }

    // Background: the section the selection lives in, else the first block of
    // the page — never a box that pushes page content around.
    const firstSection = project.nodes[page.rootId]?.children.find(
      (cid) => project.nodes[cid]?.type === "section",
    );
    const target = selectedId
      ? sectionOf(project, page.rootId, selectedId)
      : (firstSection ?? page.rootId);
    state.addSceneBackdrop(target, cfg);
  };

  const startDrag = (e: React.DragEvent) => {
    e.dataTransfer.setData("text/fe-effect", preset.id);
    e.dataTransfer.setData("text/fe-new", preset.name);
    e.dataTransfer.effectAllowed = "copy";
    setDrag({ kind: "effect", effectId: preset.id, label: preset.name });
  };

  return (
    <button
      draggable
      onDragStart={startDrag}
      onDragEnd={() => setDrag(null)}
      onClick={() => apply(true)}
      onContextMenu={(e) => {
        e.preventDefault();
        apply(false);
      }}
      className="group relative cursor-grab overflow-hidden rounded-lg border border-ink-600 text-left transition-all hover:border-accent-500 hover:shadow-[0_0_0_1px_rgba(45,212,191,0.25)] active:cursor-grabbing"
      title={`${preset.name} — ${preset.description}\nClick: set as the background of the selected section · Right-click: add as a boxed scene · Drag onto a box`}
    >
      <div className="relative h-14 w-full" style={{ background: preset.swatch }}>
        <span className="absolute bottom-1 right-1 rounded bg-ink-950/60 px-1 py-px font-mono text-[8.5px] uppercase tracking-wide text-ink-200 opacity-0 transition-opacity group-hover:opacity-100">
          {preset.family}
        </span>
      </div>
      <div className="bg-ink-850 px-2 py-1.5">
        <div className="flex items-center gap-1">
          <span className="truncate text-[11.5px] font-semibold text-ink-200 group-hover:text-accent-400">{preset.name}</span>
          {preset.family === "vanta" && (
            <span className="shrink-0 rounded bg-ink-700/70 px-1 text-[8px] font-bold uppercase tracking-wider text-ink-400">vanta</span>
          )}
        </div>
      </div>
    </button>
  );
}

export function EffectsPanel() {
  const [cat, setCat] = useState<Cat>("all");
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const list = useMemo(
    () =>
      EFFECTS_3D.filter(
        (e) =>
          (cat === "all" || e.category === cat) &&
          (!q || e.name.toLowerCase().includes(q) || e.description.toLowerCase().includes(q)),
      ),
    [cat, q],
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PanelHeader
        right={<span className="font-mono text-[10px] text-ink-500">{EFFECTS_3D.length} effects</span>}
      >
        3D Effects
      </PanelHeader>

      <div className="shrink-0 space-y-2 px-2 pt-2">
        <div className="relative">
          <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-ink-500">
            <EditorIcon name="search" size={12} />
          </span>
          <input
            className="fe-field w-full rounded-md border border-ink-600 bg-ink-900 py-1 pl-7 pr-2 text-[12px] text-ink-200 placeholder:text-ink-500"
            placeholder="Search effects…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search effects"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {EFFECT_CATEGORIES.map((c) => (
            <button
              key={c.id}
              onClick={() => setCat(c.id)}
              className={`rounded-full border px-2 py-0.5 text-[10.5px] font-medium transition-colors ${
                cat === c.id
                  ? "border-accent-600 bg-accent-600/15 text-accent-400"
                  : "border-ink-600 bg-ink-900 text-ink-400 hover:border-ink-500 hover:text-ink-200"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        <div className="grid grid-cols-2 gap-1.5">
          {list.map((p) => (
            <EffectCard key={p.id} preset={p} />
          ))}
        </div>
        {list.length === 0 && (
          <p className="px-2 py-6 text-center text-[11.5px] text-ink-500">No effects match “{query}”.</p>
        )}
      </div>

      <div className="border-t border-ink-700/60 px-3 py-1.5">
        <p className="text-[10px] leading-snug text-ink-600">
          Click sets it as the background of the selected section (content stays put) · right-click for a
          boxed scene · or drag it onto any box. Powered by vanta.js + custom GLSL.
        </p>
      </div>
    </div>
  );
}
