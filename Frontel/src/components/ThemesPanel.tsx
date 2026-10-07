/**
 * ThemesPanel — the unified Themes section.
 *
 * 15 curated theme templates applied as a unit through the existing
 * `setTheme` token mutation, plus fine-tuning of individual tokens and a
 * save-as-template escape hatch. Selecting a template restyles the entire
 * project (editor, preview and generated CSS stay in sync automatically
 * because they all read ProjectTheme).
 */
import { useMemo, useState } from "react";
import { THEME_TEMPLATES } from "@/schemas/themes";
import {
  FONT_CATEGORY_LABELS,
  FONT_CATEGORY_ORDER,
  FONT_DEFS,
  fontIdForStack,
  fontStack,
} from "@/schemas/fonts";
import type { ProjectTheme } from "@/schemas/types";
import { useEditor } from "@/lib/store";
import { EditorIcon } from "@/lib/editorIcons.tsx";
import { ColorInput, Field, NumberInput, PanelHeader, SelectInput } from "./ui";

/**
 * Typeface options come from the font registry, so choosing one also records
 * the font id — which is what lets the export load the real webfont.
 */
const FONT_OPTIONS = FONT_CATEGORY_ORDER.flatMap((cat) =>
  FONT_DEFS.filter((f) => f.category === cat).map((f) => ({
    value: f.id,
    label: `${f.name} · ${FONT_CATEGORY_LABELS[cat]}`,
  })),
);

function TemplateCard({
  id,
  name,
  description,
  swatch,
  theme,
  active,
  onApply,
}: {
  id: string;
  name: string;
  description: string;
  swatch: string;
  theme: Omit<ProjectTheme, "templateId">;
  active: boolean;
  onApply: (id: string) => void;
}) {
  return (
    <button
      onClick={() => onApply(id)}
      className={`group relative overflow-hidden rounded-lg border text-left transition-all ${
        active
          ? "border-accent-500 shadow-[0_0_0_1px_rgba(45,212,191,0.35)]"
          : "border-ink-600 hover:border-accent-700"
      }`}
      title={`Apply “${name}” — ${description}`}
    >
      <div className="relative h-12" style={{ background: swatch }}>
        {/* Mini page mockup drawn from the template's real tokens */}
        <div className="absolute inset-x-3 bottom-2 top-3 flex flex-col gap-1 overflow-hidden rounded-[4px] p-1.5"
          style={{ background: theme.colors.background }}>
          <div className="flex items-center gap-1">
            <div className="size-1.5 rounded-full" style={{ background: theme.colors.primary }} />
            <div className="h-1 w-8 rounded-full" style={{ background: theme.colors.border }} />
            <div className="ml-auto h-2 w-6 rounded-sm" style={{ background: theme.colors.primary }} />
          </div>
          <div className="mt-1 h-2 w-3/4 rounded-sm" style={{ background: theme.colors.text, opacity: 0.85 }} />
          <div className="h-1.5 w-1/2 rounded-sm" style={{ background: theme.colors.textMuted, opacity: 0.5 }} />
          <div className="mt-auto flex gap-1">
            <div className="h-2.5 w-9 rounded-sm" style={{ background: theme.colors.primary, borderRadius: theme.radius / 3 }} />
            <div className="h-2.5 w-9 rounded-sm border" style={{ borderColor: theme.colors.border, borderRadius: theme.radius / 3 }} />
          </div>
        </div>
        {active && (
          <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-accent-500 text-ink-950">
            <EditorIcon name="check" size={10} />
          </span>
        )}
      </div>
      <div className="bg-ink-850 px-2 py-1.5">
        <div className="truncate text-[11.5px] font-semibold text-ink-200 group-hover:text-accent-400">{name}</div>
      </div>
    </button>
  );
}

export function ThemesPanel() {
  const project = useEditor((s) => s.getProject());
  const setTheme = useEditor((s) => s.setTheme);
  const [saved, setSaved] = useState<{ id: string; name: string }[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("frontel:saved-themes") ?? "[]");
    } catch {
      return [];
    }
  });
  const [justApplied, setJustApplied] = useState<string | null>(null);

  const theme = project?.theme;
  const activeId = useMemo(() => {
    if (!theme) return null;
    const match = THEME_TEMPLATES.find((t) => JSON.stringify(t.theme.colors) === JSON.stringify(theme.colors));
    return match?.id ?? theme.templateId ?? null;
  }, [theme]);

  if (!theme) return null;

  const applyTemplate = (id: string) => {
    const tpl = THEME_TEMPLATES.find((t) => t.id === id);
    if (!tpl) return;
    setTheme({ ...structuredClone(tpl.theme), templateId: id } as never);
    setJustApplied(id);
    window.setTimeout(() => setJustApplied(null), 1200);
  };

  const saveCurrent = () => {
    if (!project) return;
    const entry = { id: `custom-${Date.now().toString(36)}`, name: `${project.name} theme` };
    const next = [...saved, entry].slice(-8);
    setSaved(next);
    try {
      localStorage.setItem("frontel:saved-themes", JSON.stringify(next.map((s, i) => (i === next.length - 1 ? { ...s, theme: project.theme } : s))));
    } catch { /* storage unavailable */ }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PanelHeader right={<span className="font-mono text-[10px] text-ink-500">{THEME_TEMPLATES.length} templates</span>}>
        Themes
      </PanelHeader>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="px-2 pt-2">
          <div className="grid grid-cols-2 gap-1.5">
            {THEME_TEMPLATES.map((t) => (
              <TemplateCard
                key={t.id}
                {...t}
                active={activeId === t.id || justApplied === t.id}
                onApply={applyTemplate}
              />
            ))}
          </div>
          {saved.length > 0 && (
            <div className="mt-3">
              <div className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-widest text-ink-500">Saved</div>
              <div className="flex flex-wrap gap-1">
                {saved.map((s) => (
                  <button
                    key={s.id}
                    className="rounded-full border border-ink-600 bg-ink-900 px-2 py-0.5 text-[10.5px] text-ink-300 hover:border-accent-700 hover:text-accent-400"
                    onClick={() => {
                      try {
                        const stored = JSON.parse(localStorage.getItem("frontel:saved-themes") ?? "[]") as { id: string; theme?: unknown }[];
                        const found = stored.find((x) => x.id === s.id);
                        if (found?.theme) setTheme(found.theme as never);
                      } catch { /* ignore */ }
                    }}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Fine-tuning — real token edits, undoable like everything else */}
        <div className="mt-3 border-t border-ink-700/50 px-3 pt-2">
          <div className="pb-1 text-[10px] font-semibold uppercase tracking-widest text-ink-500">Fine-tune</div>
          <Field label="Background"><ColorInput value={theme.colors.background} onChange={(c) => setTheme({ colors: { ...theme.colors, background: c ?? "#0c0e13" } })} /></Field>
          <Field label="Surface"><ColorInput value={theme.colors.surface} onChange={(c) => setTheme({ colors: { ...theme.colors, surface: c ?? "#141822" } })} /></Field>
          <Field label="Text"><ColorInput value={theme.colors.text} onChange={(c) => setTheme({ colors: { ...theme.colors, text: c ?? "#e6eaf4" } })} /></Field>
          <Field label="Muted text"><ColorInput value={theme.colors.textMuted} onChange={(c) => setTheme({ colors: { ...theme.colors, textMuted: c ?? "#8b93a9" } })} /></Field>
          <Field label="Primary"><ColorInput value={theme.colors.primary} onChange={(c) => setTheme({ colors: { ...theme.colors, primary: c ?? "#2dd4bf" } })} /></Field>
          <Field label="On primary"><ColorInput value={theme.colors.primaryContrast} onChange={(c) => setTheme({ colors: { ...theme.colors, primaryContrast: c ?? "#05201c" } })} /></Field>
          <Field label="Border"><ColorInput value={theme.colors.border} onChange={(c) => setTheme({ colors: { ...theme.colors, border: c ?? "#262d3e" } })} /></Field>
          <Field label="Typeface" tip="The project typeface — exported projects load the real webfont">
            <SelectInput
              value={theme.fontId ?? fontIdForStack(theme.font) ?? FONT_OPTIONS[0].value}
              onChange={(v) => setTheme({ fontId: v, font: fontStack(v) ?? theme.font })}
              options={FONT_OPTIONS}
            />
          </Field>
          <Field label="Corner radius">
            <NumberInput value={theme.radius} onChange={(v) => setTheme({ radius: Math.max(0, Math.min(40, v ?? 0)) })} min={0} max={40} />
          </Field>
          <button
            className="mb-2 mt-1 w-full rounded-md border border-ink-600 bg-ink-850 px-2 py-1.5 text-[11.5px] text-ink-300 transition-colors hover:border-accent-700 hover:text-accent-400"
            onClick={saveCurrent}
            title="Remember the current tokens as a custom theme chip"
          >
            Save current as theme chip
          </button>
        </div>
      </div>

      <div className="border-t border-ink-700/60 px-3 py-1.5">
        <p className="text-[10px] leading-snug text-ink-600">
          Templates restyle the whole project — editor, preview and exported CSS all read the same tokens.
        </p>
      </div>
    </div>
  );
}
