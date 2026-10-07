/**
 * Style galleries — the visual half of "Add" and of the Design tab.
 *
 * Text variants (schemas/textPresets) and surface presets
 * (schemas/visualPresets) are pure StyleProps patches, so a card applies
 * through the ordinary style path and shows the *actual* result: each card
 * renders its own patch through styleToCss, so a swatch can never lie about
 * what the preset does.
 */
import type { CSSProperties } from "react";
import type { ElementNode, StyleProps } from "@/schemas/types";
import { TEXT_PRESET_GROUPS, filterTextPresets, type TextPreset } from "@/schemas/textPresets";
import { filterSurfacePresets, type SurfacePreset } from "@/schemas/visualPresets";
import { FONT_CATEGORY_LABELS, FONT_CATEGORY_ORDER, FONT_DEFS } from "@/schemas/fonts";
import { useEditor } from "@/lib/store";
import { useActiveLayer, useStyleApi } from "@/lib/styleApi";
import { styleToCss, themeVars } from "@/lib/styles";
import { ColorInput, Field, PanelSection, Slider } from "./ui";

/* ------------------------------------------------------------------ */
/* Shared: preset card chrome                                          */
/* ------------------------------------------------------------------ */

const CARD =
  "cursor-pointer rounded-md border border-ink-700 bg-ink-850 px-2 py-1.5 text-left transition-colors hover:border-accent-700 hover:bg-ink-800";

/** Gradient presets offered by the text-gradient control. */
export const TEXT_GRADIENTS: { id: string; label: string; value: string }[] = [
  { id: "aurora", label: "Aurora", value: "linear-gradient(100deg, var(--fe-primary) 0%, #7c3aed 55%, #f472b6 100%)" },
  { id: "sunset", label: "Sunset", value: "linear-gradient(100deg, #fbbf24 0%, #f97316 45%, #e11d48 100%)" },
  { id: "ocean", label: "Ocean", value: "linear-gradient(100deg, #22d3ee 0%, #3b82f6 55%, #6366f1 100%)" },
  { id: "mint", label: "Mint", value: "linear-gradient(100deg, #d1fae5 0%, #34d399 55%, #0f766e 100%)" },
  { id: "gold", label: "Gold", value: "linear-gradient(100deg, #fef9c3 0%, #facc15 45%, #b45309 100%)" },
  { id: "chrome", label: "Chrome", value: "linear-gradient(180deg, #f8fafc 0%, #94a3b8 55%, #334155 100%)" },
];

/** Box-shadow presets offered by the shadow control. */
const BOX_SHADOWS: { id: string; label: string; value?: string }[] = [
  { id: "none", label: "None" },
  { id: "soft", label: "Soft", value: "0 1px 2px rgb(0 0 0 / 0.3), 0 10px 24px -16px rgb(0 0 0 / 0.7)" },
  { id: "lifted", label: "Lifted", value: "0 20px 48px -24px rgb(0 0 0 / 0.75)" },
  { id: "deep", label: "Deep", value: "0 40px 96px -40px rgb(0 0 0 / 0.9)" },
  { id: "glow", label: "Glow", value: "0 16px 44px -12px var(--fe-primary)" },
  { id: "inset", label: "Inset", value: "inset 0 1px 0 rgb(255 255 255 / 0.16), inset 0 -1px 0 rgb(0 0 0 / 0.4)" },
];

/* ------------------------------------------------------------------ */
/* Text variants                                                       */
/* ------------------------------------------------------------------ */

/** A miniature of the variant: the card renders its own style patch. */
function TextPresetCard({
  preset,
  theme,
  onApply,
  onDragStart,
}: {
  preset: TextPreset;
  theme: Parameters<typeof styleToCss>[1];
  onApply: () => void;
  onDragStart?: (e: React.DragEvent) => void;
}) {
  const size = preset.style.fontSize ?? 16;
  const previewSize = Math.max(10.5, Math.min(19, Math.round((size / 3.6) * 2) / 2));
  // Letter-spacing is optical: it has to shrink with the sample, or big display
  // variants render as one run-on word in a small card.
  const tighten = previewSize / size;
  const preview = styleToCss(
    {
      ...preset.style,
      fontSize: previewSize,
      letterSpacing:
        preset.style.letterSpacing === undefined
          ? undefined
          : Math.round(preset.style.letterSpacing * tighten * 100) / 100,
      lineHeight: 1.25,
      width: undefined,
      height: undefined,
      padding: preset.style.padding && size > 40 ? undefined : preset.style.padding,
    },
    theme,
  );
  const sample = preset.creates.props?.text ?? preset.label;
  return (
    <button
      draggable={!!onDragStart}
      onDragStart={onDragStart}
      onClick={onApply}
      className={`${CARD} ${onDragStart ? "cursor-grab active:cursor-grabbing" : ""}`}
      title={`${preset.label} — ${preset.description}`}
    >
      <div className="truncate text-[12.5px] text-ink-100" style={preview as CSSProperties}>
        {sample.length > 26 ? `${sample.slice(0, 25)}…` : sample}
      </div>
      <div className="mt-0.5 truncate text-[10px] text-ink-500">{preset.label}</div>
    </button>
  );
}

/**
 * Applies a text variant to the selected node, or — with nothing selected —
 * creates the element the variant is made for.
 */
export function TextStyleGrid({
  node,
  draggable = false,
  query = "",
}: {
  node?: ElementNode | null;
  draggable?: boolean;
  /** Search filter, used by the Add panel. */
  query?: string;
}) {
  const theme = useEditor((s) => s.getProject()?.theme);
  const addElement = useEditor((s) => s.addElement);
  const setStyle = useEditor((s) => s.setStyle);
  const setDrag = useEditor((s) => s.setDrag);
  const layer = useActiveLayer();
  if (!theme) return null;
  const matching = filterTextPresets(query);

  const apply = (preset: TextPreset) => {
    if (node) {
      setStyle(node.id, layer, preset.style);
      return;
    }
    addElement(preset.creates.type, null, {
      name: preset.label,
      props: preset.creates.props,
      style: preset.style,
    });
  };

  return (
    // The theme tokens are defined on the preview, so a preset written in
    // var(--fe-…) renders here exactly as it does on the canvas.
    <div className="space-y-2" style={themeVars(theme) as CSSProperties}>
      {TEXT_PRESET_GROUPS.map((group) => {
        const list = matching.filter((p) => p.group === group);
        if (!list.length) return null;
        return (
          <div key={group}>
            <div className="px-0.5 pb-1 text-[10px] font-semibold uppercase tracking-widest text-ink-500">{group}</div>
            <div className="grid grid-cols-1 gap-1">
              {list.map((preset) => (
                <TextPresetCard
                  key={preset.id}
                  preset={preset}
                  theme={theme}
                  onApply={() => apply(preset)}
                  onDragStart={
                    draggable
                      ? (e) => {
                          e.dataTransfer.setData("text/fe-new", preset.label);
                          e.dataTransfer.effectAllowed = "copy";
                          setDrag({
                            kind: "new",
                            type: preset.creates.type,
                            label: preset.label,
                            style: preset.style,
                            props: preset.creates.props,
                          });
                        }
                      : undefined
                  }
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Surface presets                                                     */
/* ------------------------------------------------------------------ */

function SurfaceCard({ preset, onApply }: { preset: SurfacePreset; onApply: () => void }) {
  return (
    <button
      onClick={onApply}
      className="group cursor-pointer overflow-hidden rounded-md border border-ink-700 text-left transition-colors hover:border-accent-600"
      title={`${preset.label} — ${preset.description}`}
    >
      <div className="h-8 w-full" style={{ background: preset.swatch }} />
      <div className="bg-ink-850 px-1.5 py-1">
        <div className="truncate text-[10.5px] font-medium text-ink-300 group-hover:text-accent-400">{preset.label}</div>
      </div>
    </button>
  );
}

/** Surface presets always need a target, so this grid is Inspector-only. */
export function SurfaceGrid({ node }: { node: ElementNode }) {
  const { set } = useStyleApi(node.id);
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {filterSurfacePresets("").map((preset) => (
        <SurfaceCard key={preset.id} preset={preset} onApply={() => set(preset.style)} />
      ))}
    </div>
  );
}

/** Ready-made boxes the Add panel can drop on the canvas. */
export function SurfaceCreateGrid({ query = "" }: { query?: string }) {
  const theme = useEditor((s) => s.getProject()?.theme);
  const addElement = useEditor((s) => s.addElement);
  if (!theme) return null;
  const creatable = filterSurfacePresets(query, true);
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {creatable.map((preset) => (
        <SurfaceCard
          key={preset.id}
          preset={preset}
          onApply={() => {
            const id = addElement(preset.creates!.type, null, {
              name: preset.label,
              props: preset.creates!.props,
              style: preset.style,
            });
            // A card with nothing in it is hard to aim at: give it a body text.
            if (id) addElement("text", id);
          }}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Text effects (typography panel)                                     */
/* ------------------------------------------------------------------ */

const TRANSFORMS: { id: NonNullable<StyleProps["textTransform"]>; label: string; tip: string }[] = [
  { id: "none", label: "None", tip: "As typed" },
  { id: "uppercase", label: "AA", tip: "UPPERCASE" },
  { id: "lowercase", label: "aa", tip: "lowercase" },
  { id: "capitalize", label: "Aa", tip: "Capitalize Each Word" },
];

/** Font, case, decoration, gradient, glow and outline for text-like nodes. */
export function TextEffectControls({ node }: { node: ElementNode }) {
  const { style, set } = useStyleApi(node.id);
  const theme = useEditor((s) => s.getProject()?.theme);
  if (!theme) return null;

  const glow = style.textGlow;
  const setGlow = (patch: Partial<NonNullable<StyleProps["textGlow"]>>) =>
    set({
      textGlow: {
        color: glow?.color ?? "primary",
        blur: glow?.blur ?? 18,
        spread: glow?.spread ?? 2,
        ...patch,
      },
      // A raw string would win over the structured value, so drop it.
      textShadow: undefined,
    });
  const stroke = style.textStrokeWidth ?? 0;

  return (
    // Theme tokens must be in scope: text shadows and gradient presets are
    // written against them (see the same wrapper around TextStyleGrid).
    <div style={themeVars(theme) as CSSProperties}>
      <Field label="Font" tip="Per-element typeface — the export loads the real webfont">
        <select
          className="fe-field w-full rounded border border-ink-600 bg-ink-900 px-1.5 py-1 text-[11.5px] text-ink-200"
          value={style.fontFamily ?? ""}
          onChange={(e) => set({ fontFamily: e.target.value || undefined })}
        >
          <option value="">Theme typeface</option>
          {FONT_CATEGORY_ORDER.map((cat) => (
            <optgroup key={cat} label={FONT_CATEGORY_LABELS[cat]}>
              {FONT_DEFS.filter((f) => f.category === cat).map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </Field>

      <Field label="Case">
        <div className="flex gap-1">
          {TRANSFORMS.map((t) => {
            const active = (style.textTransform ?? "none") === t.id;
            return (
              <button
                key={t.id}
                title={t.tip}
                onClick={() => set({ textTransform: t.id === "none" ? undefined : t.id })}
                className={`flex-1 rounded border px-1 py-0.5 text-[11px] transition-colors ${
                  active
                    ? "border-accent-600 bg-accent-600/15 text-accent-400"
                    : "border-ink-600 bg-ink-900 text-ink-400 hover:text-ink-200"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </Field>

      <Field label="Style">
        <div className="flex gap-1">
          {[
            { key: "italic" as const, label: "Italic", active: style.fontStyle === "italic" },
          ].map((b) => (
            <button
              key={b.key}
              onClick={() => set({ fontStyle: b.active ? undefined : "italic" })}
              className={`flex-1 rounded border px-1 py-0.5 text-[11px] italic transition-colors ${
                b.active
                  ? "border-accent-600 bg-accent-600/15 text-accent-400"
                  : "border-ink-600 bg-ink-900 text-ink-400 hover:text-ink-200"
              }`}
            >
              {b.label}
            </button>
          ))}
          {[
            { value: "underline" as const, label: "Underline", cls: "underline" },
            { value: "line-through" as const, label: "Strike", cls: "line-through" },
          ].map((b) => {
            const active = style.textDecoration === b.value;
            return (
              <button
                key={b.value}
                onClick={() => set({ textDecoration: active ? undefined : b.value })}
                className={`flex-1 rounded border px-1 py-0.5 text-[11px] transition-colors ${b.cls} ${
                  active
                    ? "border-accent-600 bg-accent-600/15 text-accent-400"
                    : "border-ink-600 bg-ink-900 text-ink-400 hover:text-ink-200"
                }`}
              >
                {b.label}
              </button>
            );
          })}
        </div>
      </Field>

      <Field label="Gradient" tip="Fills the letterforms with a gradient">
        <div className="flex flex-wrap gap-1">
          <button
            onClick={() => set({ textGradient: undefined })}
            className={`rounded border px-1.5 py-0.5 text-[10.5px] transition-colors ${
              style.textGradient
                ? "border-ink-600 bg-ink-900 text-ink-400 hover:text-ink-200"
                : "border-accent-600 bg-accent-600/15 text-accent-400"
            }`}
          >
            Off
          </button>
          {TEXT_GRADIENTS.map((g) => {
            const active = style.textGradient === g.value;
            return (
              <button
                key={g.id}
                title={g.label}
                onClick={() => set({ textGradient: g.value })}
                className={`rounded border px-1.5 py-0.5 text-[10.5px] text-ink-100 transition-transform hover:scale-105 ${
                  active ? "border-accent-500" : "border-ink-600"
                }`}
                style={{
                  backgroundImage: g.value,
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  color: "transparent",
                }}
              >
                {g.label}
              </button>
            );
          })}
        </div>
      </Field>

      <Field label="Glow">
        <div className="flex items-center gap-1.5">
          <ColorInput
            value={glow?.color ?? "primary"}
            allowSemantic
            semanticOptions={["primary", "primary-contrast", "text", "muted", "border"]}
            onChange={(c) => setGlow({ color: c ?? "primary" })}
          />
          <button
            className={`shrink-0 rounded border px-1.5 py-1 text-[10.5px] transition-colors ${
              glow
                ? "border-accent-700 text-accent-400"
                : "border-ink-600 bg-ink-900 text-ink-400 hover:border-accent-700 hover:text-accent-400"
            }`}
            onClick={() => set({ textGlow: glow ? undefined : { color: "primary", blur: 18, spread: 2 } })}
            title={glow ? "Remove the glow" : "Add a colored halo behind the glyphs"}
          >
            {glow ? "on ✓" : "off"}
          </button>
        </div>
        {glow && (
          <>
            <Slider value={glow.blur} onChange={(v) => setGlow({ blur: v })} min={0} max={60} />
            <Slider
              value={glow.spread ?? 2}
              onChange={(v) => setGlow({ spread: v })}
              min={0}
              max={4}
              step={0.1}
            />
            <p className="text-[10px] text-ink-500">Blur radius · halo spread</p>
          </>
        )}
      </Field>

      <Field label="Outline">
        <div className="flex items-center gap-1.5">
          <Slider
            value={stroke}
            onChange={(v) => set({ textStrokeWidth: v || undefined, textStrokeColor: style.textStrokeColor ?? "primary" })}
            min={0}
            max={4}
            step={0.5}
          />
          {stroke > 0 && (
            <ColorInput
              value={style.textStrokeColor ?? "primary"}
              allowSemantic
              semanticOptions={["primary", "text", "muted"]}
              onChange={(c) => set({ textStrokeColor: c ?? "primary" })}
            />
          )}
        </div>
      </Field>
    </div>
  );
}

/** Depth, blur and geometry — the "make it feel expensive" controls. */
export function SurfaceEffectsControls({ node }: { node: ElementNode }) {
  const { style, set } = useStyleApi(node.id);
  return (
    <>
      <Field label="Shadow" tip="Depth and glow for the box itself">
        <div className="flex flex-wrap gap-1">
          {BOX_SHADOWS.map((s) => {
            const active = (style.boxShadow ?? undefined) === s.value;
            return (
              <button
                key={s.id}
                onClick={() => set({ boxShadow: s.value })}
                className={`rounded border px-1.5 py-0.5 text-[10.5px] transition-colors ${
                  active
                    ? "border-accent-600 bg-accent-600/15 text-accent-400"
                    : "border-ink-600 bg-ink-900 text-ink-400 hover:border-accent-700 hover:text-accent-400"
                }`}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </Field>
      <Field label="Backdrop blur" tip="Frosted glass: blurs whatever sits behind the element">
        <Slider value={style.backdropBlur ?? 0} onChange={(v) => set({ backdropBlur: v || undefined })} min={0} max={40} />
      </Field>
      <Field label="Blur" tip="Blurs the element itself">
        <Slider value={style.blur ?? 0} onChange={(v) => set({ blur: v || undefined })} min={0} max={20} />
      </Field>
      <Field label="Rotation">
        <Slider value={style.rotate ?? 0} onChange={(v) => set({ rotate: v || undefined })} min={-45} max={45} step={1} />
      </Field>
      <Field label="Scale">
        <Slider value={style.scale ?? 1} onChange={(v) => set({ scale: v === 1 ? undefined : v })} min={0.5} max={1.6} step={0.01} />
      </Field>
    </>
  );
}

/** Design-tab section wrapping both galleries. */
export function StylePresetSection({ node }: { node: ElementNode }) {
  const isTextish = ["heading", "text", "button", "link"].includes(node.type);
  return (
    <PanelSection title="Style presets" icon="palette" defaultOpen={false}>
      <div className="pb-1 text-[10px] font-semibold uppercase tracking-widest text-ink-500">Surfaces</div>
      <SurfaceGrid node={node} />
      {isTextish && (
        <div className="pt-3">
          <TextStyleGrid node={node} />
        </div>
      )}
    </PanelSection>
  );
}
