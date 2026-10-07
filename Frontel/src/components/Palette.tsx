import { useMemo, useState } from "react";
import { CATEGORY_ORDER, ELEMENT_DEFS, type ElementCategory } from "@/schemas/registry";
import { SECTION_PRESETS } from "@/schemas/sections";
import { useEditor } from "@/lib/store";
import { EditorIcon } from "@/lib/editorIcons.tsx";
import { SurfaceCreateGrid, TextStyleGrid } from "./StyleGallery";
import { filterTextPresets } from "@/schemas/textPresets";
import { filterSurfacePresets } from "@/schemas/visualPresets";
import { PanelHeader } from "./ui";

const CATEGORY_LABELS: Record<ElementCategory, string> = {
  layout: "Layout",
  content: "Content",
  interactive: "Interactive",
  visual: "Visual",
};

export function Palette() {
  const addElement = useEditor((s) => s.addElement);
  const addSectionAt = useEditor((s) => s.addSectionAt);
  const setDrag = useEditor((s) => s.setDrag);
  const addFreeformLayer = useEditor((s) => s.addFreeformLayer);
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();

  const filteredPresets = useMemo(
    () => SECTION_PRESETS.filter((p) => !q || p.label.toLowerCase().includes(q)),
    [q],
  );
  const elementsByCat = useMemo(() => {
    const map: Record<ElementCategory, { type: keyof typeof ELEMENT_DEFS; label: string }[]> = {
      layout: [],
      content: [],
      interactive: [],
      visual: [],
    };
    for (const [type, def] of Object.entries(ELEMENT_DEFS) as [
      keyof typeof ELEMENT_DEFS,
      (typeof ELEMENT_DEFS)[keyof typeof ELEMENT_DEFS],
    ][]) {
      if (q && !def.label.toLowerCase().includes(q)) continue;
      map[def.category].push({ type, label: def.label });
    }
    return map;
  }, [q]);

  const startDrag = (e: React.DragEvent, payload: { kind: "new"; type?: string; section?: string; label: string }) => {
    e.dataTransfer.setData("text/fe-new", payload.label);
    e.dataTransfer.effectAllowed = "copy";
    useEditor.getState().setDrag({
      kind: "new",
      type: payload.type as never,
      section: payload.section,
      label: payload.label,
    });
  };

  /** Text variants + ready-made surfaces are styles, not element types. */
  const textStyles = filterTextPresets(q);
  const surfaces = filterSurfacePresets(q, true);

  return (
    <div className="border-t border-ink-700/60">
      <PanelHeader>Add</PanelHeader>
      <div className="max-h-64 overflow-y-auto p-2">
        {/* Search */}
        <div className="relative mb-2">
          <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-ink-500">
            <EditorIcon name="search" size={12} />
          </span>
          <input
            className="fe-field w-full rounded-md border border-ink-600 bg-ink-900 py-1 pl-7 pr-2 text-[12px] text-ink-200 placeholder:text-ink-500"
            placeholder="Search elements…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search elements"
          />
        </div>

        {/* Canvas layer: optional now — every box can host free elements, and
            dropping on empty page space creates this layer automatically. */}
        {!q && (
          <button
            draggable
            onDragStart={(e) => startDrag(e, { kind: "new", type: "section", label: "Canvas layer" })}
            onDragEnd={() => setDrag(null)}
            onClick={addFreeformLayer}
            className="mb-2 flex w-full cursor-grab items-center gap-2 rounded-md border border-accent-700/50 bg-accent-600/10 px-2 py-2 text-left text-[12px] text-accent-400 transition-colors hover:border-accent-500 hover:bg-accent-600/20 active:cursor-grabbing"
            title="Add the page's canvas layer: free-standing elements on empty page space live here. Created automatically when you drop something on empty space."
          >
            <EditorIcon name="layers" size={13} className="shrink-0" />
            <span className="flex-1 font-semibold">Canvas layer</span>
            <span className="text-[10px] text-ink-500">optional</span>
          </button>
        )}

        {/* Section presets */}
        {filteredPresets.length > 0 && (
          <>
            <div className="px-1 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-widest text-ink-500">
              Sections · full blocks
            </div>
            <div className="mb-2 grid grid-cols-2 gap-1">
              {filteredPresets.map((p) => (
                <button
                  key={p.id}
                  draggable
                  onDragStart={(e) => startDrag(e, { kind: "new", section: p.id, label: p.label })}
                  onDragEnd={() => setDrag(null)}
                  onClick={() => {
                    addSectionAt(p.id);
                    setDrag(null);
                  }}
                  className="flex cursor-grab items-center gap-1.5 rounded-md border border-ink-700 bg-ink-850 px-2 py-1.5 text-left text-[12px] text-ink-200 transition-colors hover:border-accent-700 hover:bg-ink-800 hover:text-accent-400 active:cursor-grabbing"
                  title={`Add ${p.label} section to the end of the page — or drag it anywhere`}
                >
                  <EditorIcon name={p.icon} size={12} className="shrink-0 text-accent-500" />
                  <span className="truncate">{p.label}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {/* Elements by category */}
        {CATEGORY_ORDER.map((cat) =>
          elementsByCat[cat].length ? (
            <div key={cat} className="mb-1">
              <div className="px-1 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-widest text-ink-500">
                {CATEGORY_LABELS[cat]}
              </div>
              <div className="grid grid-cols-2 gap-1">
                {elementsByCat[cat].map(({ type, label }) => (
                  <button
                    key={type}
                    draggable
                    onDragStart={(e) => startDrag(e, { kind: "new", type, label })}
                    onDragEnd={() => setDrag(null)}
                    onClick={() => {
                      addElement(type);
                      setDrag(null);
                    }}
                    className="cursor-grab rounded border border-ink-700 bg-ink-850 px-2 py-1.5 text-left text-[12px] text-ink-300 transition-colors hover:border-accent-700 hover:text-accent-400 active:cursor-grabbing"
                    title={`Add ${label} — click for the end of the current container, or drag onto the canvas to place it exactly where you drop it`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ) : null,
        )}
        {/* Text variants: click to add a styled heading/paragraph, or drag it
            onto the canvas to place it exactly where you drop it. */}
        {textStyles.length > 0 && (
          <div className="mb-1 mt-2 border-t border-ink-700/60 pt-2">
            <div className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-widest text-ink-500">
              Text styles · one click
            </div>
            <TextStyleGrid draggable query={q} />
          </div>
        )}

        {/* Surface presets: ready-made cards with a body already inside. */}
        {surfaces.length > 0 && (
          <div className="mb-1 mt-2 border-t border-ink-700/60 pt-2">
            <div className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-widest text-ink-500">
              Surfaces
            </div>
            <SurfaceCreateGrid query={q} />
          </div>
        )}

        {q &&
          !filteredPresets.length &&
          !textStyles.length &&
          !surfaces.length &&
          !CATEGORY_ORDER.some((c) => elementsByCat[c].length) && (
          <p className="px-1 py-3 text-center text-[11.5px] text-ink-500">
            No elements match “{query}”.
          </p>
        )}
      </div>
    </div>
  );
}
