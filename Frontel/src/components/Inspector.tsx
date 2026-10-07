import { useEffect, useMemo, useRef, useState } from "react";
import type { AnimationSpec, ElementNode, Interaction, StyleProps } from "@/schemas/types";
import { BREAKPOINT_ORDER, type Breakpoint } from "@/schemas/types";
import { EFFECTS_3D, getEffect3D } from "@/schemas/effects3d";
import { useEditor } from "@/lib/store";
import { useStyleApi } from "@/lib/styleApi";
import { GRID_CELL, pxToBoxes } from "@/lib/grid";
import { nodeRectInFrame, offsetWithin } from "@/lib/frame";
import { SEMANTIC_COLORS } from "@/lib/styles";
import { VIEWPORT_WIDTH } from "@/lib/viewport";
import { ICON_NAMES } from "@/lib/icons";
import { uid } from "@/schemas/factory";
import { pageAnchors } from "@/lib/nodes";
import { EditorIcon } from "@/lib/editorIcons.tsx";
import {
  Button,
  ColorInput,
  Field,
  Hint,
  NumberInput,
  PanelSection,
  Segmented,
  SelectInput,
  Slider,
  TextInput,
} from "./ui";
import { StylePresetSection, SurfaceEffectsControls, TextEffectControls } from "./StyleGallery";

/* ------------------------------------------------------------------ */
/* Inspector tabs                                                      */
/* ------------------------------------------------------------------ */

type InspectorTab = "content" | "design" | "motion" | "advanced";

const DEFAULT_SHADER_BODY = `void main() {
  vec2 uv = gl_FragCoord.xy / iResolution;
  float wave = sin(uv.x * 10.0 + iTime * uSpeed) * 0.5 + 0.5;
  vec3 col = mix(uColorA, uColorB, wave);
  gl_FragColor = vec4(col, 1.0);
}`;

const TABS: { id: InspectorTab; label: string; icon: string }[] = [
  { id: "content", label: "Content", icon: "type" },
  { id: "design", label: "Design", icon: "palette" },
  { id: "motion", label: "Motion", icon: "wand" },
  { id: "advanced", label: "Advanced", icon: "settings" },
];

/* ------------------------------------------------------------------ */
/* Breakpoint switcher                                                 */
/* ------------------------------------------------------------------ */

const BP_ICON: Record<Breakpoint, string> = { desktop: "monitor", tablet: "tablet", mobile: "phone" };

function BreakpointBar() {
  const viewport = useEditor((s) => s.viewport);
  const setViewport = useEditor((s) => s.setViewport);
  return (
    <div className="flex items-center gap-2">
      <Segmented
        value={viewport}
        onChange={setViewport}
        options={BREAKPOINT_ORDER.map((bp) => ({
          value: bp,
          icon: BP_ICON[bp],
          tip: `Edit styles at ${bp} width`,
        }))}
      />
      {viewport !== "desktop" && <LayerBadge />}
    </div>
  );
}

/** Shows whether the current breakpoint layer has overrides. */
function LayerBadge() {
  const viewport = useEditor((s) => s.viewport);
  const selectedId = useEditor((s) => s.selectedId);
  const node = useEditor((s) => (selectedId ? s.getProject()?.nodes[selectedId] : null));
  if (!node || viewport === "desktop") return null;
  const layer = node.style[viewport] ?? {};
  const hasOverride = Object.keys(layer).length > 0;
  return (
    <span
      className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${
        hasOverride ? "bg-accent-600/15 text-accent-400" : "bg-ink-700/60 text-ink-500"
      }`}
      title={
        hasOverride
          ? `This ${viewport} layer overrides desktop styles`
          : `No ${viewport} overrides yet — edits here create them`
      }
    >
      {hasOverride ? "override" : "inherits"}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Style layer plumbing lives in lib/styleApi (shared with the galleries) */
/* ------------------------------------------------------------------ */

function SizeRow({
  label,
  size,
  onChange,
  tip,
}: {
  label: string;
  size: StyleProps["width"];
  onChange: (v: StyleProps["width"]) => void;
  tip?: string;
}) {
  const kind = size?.kind ?? "auto";
  const value = size?.kind === "fixed" ? size.value : 0;
  const unit = size?.kind === "fixed" ? size.unit : "px";
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-12 shrink-0 cursor-help text-[11px] text-ink-400" title={tip}>
        {label}
      </span>
      <select
        className="w-20 rounded border border-ink-600 bg-ink-900 px-1 py-1 text-[11px] text-ink-300"
        value={kind}
        onChange={(e) => {
          const k = e.target.value;
          onChange(
            k === "fixed"
              ? { kind: "fixed", value: value || 200, unit: unit as "px" }
              : { kind: k as "auto" | "fill" | "hug" },
          );
        }}
      >
        <option value="auto">auto</option>
        <option value="fill">fill</option>
        <option value="hug">hug</option>
        <option value="fixed">fixed</option>
      </select>
      {kind === "fixed" && (
        <>
          {/* Steps in boxes: the grid is the unit for size as well as position. */}
          <NumberInput
            value={value}
            min={GRID_CELL}
            step={GRID_CELL}
            onChange={(v) => onChange({ kind: "fixed", value: v ?? 0, unit: unit as "px" | "%" | "vh" | "vw" })}
          />
          <select
            className="rounded border border-ink-600 bg-ink-900 px-1 py-1 text-[11px] text-ink-300"
            value={unit}
            onChange={(e) => onChange({ kind: "fixed", value, unit: e.target.value as "px" | "%" | "vh" | "vw" })}
          >
            <option>px</option>
            <option>%</option>
            <option>vh</option>
            <option>vw</option>
          </select>
          {unit === "px" && (
            <span className="shrink-0 font-mono text-[10px] text-ink-500" title={`${pxToBoxes(value)} boxes of ${GRID_CELL}px`}>
              {pxToBoxes(value)}
            </span>
          )}
        </>
      )}
    </div>
  );
}

function SpacingRow({
  label,
  value,
  onChange,
  tip,
}: {
  label: string;
  value: [number, number, number, number] | undefined;
  onChange: (v: [number, number, number, number] | undefined) => void;
  tip?: string;
}) {
  const v: [number, number, number, number] = value ?? [0, 0, 0, 0];
  const set = (i: number, n: number | undefined) => {
    const next = [...v] as [number, number, number, number];
    next[i] = n ?? 0;
    onChange(next);
  };
  const labels = ["Top", "Right", "Bottom", "Left"];
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-12 shrink-0 cursor-help text-[11px] text-ink-400" title={tip}>
        {label}
      </span>
      {v.map((n, i) => (
        <input
          key={i}
          type="number"
          title={labels[i]}
          aria-label={`${label} ${labels[i]}`}
          className="fe-field w-full min-w-0 rounded border border-ink-600 bg-ink-900 px-1 py-1 text-center text-[11px] text-ink-300"
          value={value ? n : ""}
          placeholder={labels[i][0]}
          onChange={(e) => set(i, e.target.value === "" ? undefined : Number(e.target.value))}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Design tab controls                                                 */
/* ------------------------------------------------------------------ */

function LayoutSection({ node }: { node: ElementNode }) {
  const { style, set, layer, hasOverride } = useStyleApi(node.id);
  const isFlexy = ["section", "container", "flex", "grid", "stack", "form"].includes(node.type);
  const clearLayer = useEditor((s) => s.clearStyleLayer);
  const project = useEditor((s) => s.getProject());
  const page = useEditor((s) => s.getPage());
  const rootId = page?.rootId ?? null;
  const isRoot = !!rootId && node.id === rootId;
  /** True when the element is free-positioned in its host box. */
  const isFree = style.position === "absolute";
  const parentId = (() => {
    for (const candidate of Object.values(project?.nodes ?? {})) {
      if (candidate.children.includes(node.id)) return candidate.id;
    }
    return null;
  })();
  const host = parentId ? project?.nodes[parentId] : null;

  /**
   * A wide, pixel-pinned free box: it was almost certainly meant to stretch (a
   * bar, a backdrop, a full-width block), and a px width is exactly what stops
   * it following a wider window. Narrow pinned boxes are ordinary design
   * choices, so they stay unflagged.
   */
  const widePin = (() => {
    if (!isFree) return null;
    const w = style.width;
    if (w?.kind !== "fixed" || w.unit !== "px") return null;
    if (w.value < VIEWPORT_WIDTH.desktop / 2) return null;
    return `Fixed ${w.value}px wide — a pixel width is kept as-is, so this box stays that size when the window (or the exported site) is wider. Use fill, or a % width, to make it stretch.`;
  })();

  /**
   * Free ↔ layout. Turning an element free keeps it exactly where it sits, so
   * the conversion is never a jump; the reverse rejoins the host's flow.
   */
  const toggleFree = () => {
    const s = useEditor.getState();
    if (isFree) s.makeFlow(node.id);
    else {
      const at = (parentId ? offsetWithin(node.id, parentId) : null) ?? { left: 0, top: 0 };
      // Keep the rendered size: a flow child stretched by its host would
      // shrink-wrap the moment it became free. Axes authored as `fill` are not
      // pinned — the store keeps those stretching to their host.
      const r = nodeRectInFrame(node.id);
      s.makeFree(node.id, at, r ? { pinSize: { w: r.right - r.left, h: r.bottom - r.top } } : undefined);
    }
  };

  /** Centres the box horizontally in its host, on the box grid. */
  const centerFree = () => {
    const self = nodeRectInFrame(node.id);
    const hostRect = parentId ? nodeRectInFrame(parentId) : null;
    const hostW = hostRect ? hostRect.right - hostRect.left : (self?.right ?? 0);
    const w = style.width?.kind === "fixed" && style.width.unit === "px"
      ? style.width.value
      : self
        ? self.right - self.left
        : 240;
    const left = Math.max(0, Math.round((hostW - w) / 2 / GRID_CELL) * GRID_CELL);
    const s = useEditor.getState();
    if (isFree) set({ left });
    else s.makeFree(node.id, { left, top: (parentId ? offsetWithin(node.id, parentId) : null)?.top ?? 0 });
  };

  return (
    <>
      {layer !== "base" && (
        <div className="flex items-center justify-between px-3 pt-2">
          <span className="text-[10.5px] text-ink-500">
            Editing <span className="text-accent-400">{layer}</span> overrides
          </span>
          {hasOverride && (
            <button
              className="text-[10.5px] text-ink-500 underline hover:text-accent-400"
              onClick={() => clearLayer(node.id, layer as "tablet" | "mobile")}
              title="Remove all overrides on this breakpoint"
            >
              reset layer
            </button>
          )}
        </div>
      )}      <PanelSection title="Layout" icon="layout">
        {/* Free placement is available for every element — not just ones that
            already are free. Typing a coordinate converts to free placement. */}
        {!isRoot && (
          <Field
            label="Position"
            tip="Type coordinates for an exact spot, or just drag the element anywhere on the canvas"
          >
            <div className="flex items-center gap-1.5">
              <span className="w-4 text-[11px] text-ink-400">X</span>
              <NumberInput
                value={style.left}
                step={GRID_CELL}
                onChange={(v) => set({ position: "absolute", left: v ?? 0 })}
              />
              <span className="w-4 text-[11px] text-ink-400">Y</span>
              <NumberInput
                value={style.top}
                step={GRID_CELL}
                onChange={(v) => {
                  set({ position: "absolute", top: v ?? 0 });
                  // Moving down grows the host, so nothing gets cut off.
                  if (parentId) useEditor.getState().fitHostToNode(node.id, parentId);
                }}
              />
              <button
                className={`shrink-0 rounded border px-1.5 py-1 text-[10.5px] transition-colors ${
                  isFree
                    ? "border-accent-700 text-accent-400"
                    : "border-ink-600 bg-ink-900 text-ink-400 hover:border-accent-700 hover:text-accent-400"
                }`}
                title={
                  isFree
                    ? "Rejoin the host's flow layout (the element goes back into the row/column)"
                    : "Free this element: it stays exactly where it is but can be dragged anywhere"
                }
                onClick={toggleFree}
              >
                {isFree ? "free ✓" : "make free"}
              </button>
              <button
                className="shrink-0 rounded border border-ink-600 bg-ink-900 px-1.5 py-1 text-[10.5px] text-ink-400 hover:border-accent-700 hover:text-accent-400"
                title="Center the element horizontally in its host box"
                onClick={centerFree}
              >
                center
              </button>
            </div>
            <Hint>
              {isFree
                ? `Free inside ${host?.name ?? "its host"} — drag it anywhere, resize it from any edge, Alt for exact placement.`
                : "In the host's layout. Drag it on the canvas or hit make free to position it anywhere."}
            </Hint>
          </Field>
        )}
        {isFlexy && (
          <>
            <Field label="Arrange as" tip="Flex stacks children in a row or column; Grid places them in columns">
              <SelectInput
                value={style.display ?? "flex"}
                onChange={(v) => set({ display: v as StyleProps["display"] })}
                options={[
                  { value: "flex", label: "Flex (row / column)" },
                  { value: "grid", label: "Grid (columns)" },
                  { value: "block", label: "Block" },
                ]}
              />
            </Field>
            {style.display === "grid" ? (
              <Field label="Columns">
                <Slider value={style.gridColumns ?? 3} onChange={(v) => set({ gridColumns: v })} min={1} max={12} />
              </Field>
            ) : (
              <>
                <Field label="Direction" tip="Row = side by side, Column = stacked">
                  <Segmented
                    size="sm"
                    value={style.flexDirection ?? "row"}
                    onChange={(v) => set({ flexDirection: v as StyleProps["flexDirection"] })}
                    options={[
                      { value: "row", label: "Row" },
                      { value: "column", label: "Column" },
                    ]}
                  />
                </Field>
                <Field label="Distribute" tip="How children spread along the main axis">
                  <SelectInput
                    value={style.justify ?? "flex-start"}
                    onChange={(v) => set({ justify: v as StyleProps["justify"] })}
                    options={[
                      { value: "flex-start", label: "Start" },
                      { value: "center", label: "Center" },
                      { value: "flex-end", label: "End" },
                      { value: "space-between", label: "Space between" },
                      { value: "space-around", label: "Space around" },
                      { value: "space-evenly", label: "Space evenly" },
                    ]}
                  />
                </Field>
                <Field label="Align" tip="How children align on the cross axis">
                  <SelectInput
                    value={style.align ?? "stretch"}
                    onChange={(v) => set({ align: v as StyleProps["align"] })}
                    options={[
                      { value: "stretch", label: "Stretch" },
                      { value: "flex-start", label: "Start" },
                      { value: "center", label: "Center" },
                      { value: "flex-end", label: "End" },
                    ]}
                  />
                </Field>
                <Field label="Gap">
                  <Slider value={style.gap ?? 0} onChange={(v) => set({ gap: v })} min={0} max={96} />
                </Field>
              </>
            )}
          </>
        )}
        <SizeRow label="Width" size={style.width} onChange={(w) => set({ width: w })} tip="auto = from content, fill = stretch to container, fixed = exact" />
        <SizeRow label="Height" size={style.height} onChange={(h) => set({ height: h })} />
        {widePin && <Hint>{widePin}</Hint>}
        {style.minHeight !== undefined && typeof style.minHeight === "number" && (
          <Field label="Min height">
            <Slider value={style.minHeight} onChange={(v) => set({ minHeight: v })} min={0} max={1200} step={8} />
          </Field>
        )}
        <SpacingRow label="Padding" value={style.padding} onChange={(p) => set({ padding: p })} tip="Space inside the element: top, right, bottom, left" />
        <SpacingRow label="Margin" value={style.margin} onChange={(m) => set({ margin: m })} tip="Space outside the element: top, right, bottom, left" />
      </PanelSection>
    </>
  );
}

function AppearanceSection({ node }: { node: ElementNode }) {
  const { style, set } = useStyleApi(node.id);
  const isTextish = node.type === "heading" || node.type === "text" || node.type === "button" || node.type === "link";

  return (
    <>
      <PanelSection title="Appearance" icon="palette">
        <Field label="Background" tip="Pick a theme color or any custom value">
          <ColorInput
            value={style.background}
            onChange={(c) => set({ background: c })}
            allowSemantic
            semanticOptions={[...SEMANTIC_COLORS]}
          />
        </Field>
        <Field label="Corner radius">
          <Slider value={style.borderRadius ?? 0} onChange={(v) => set({ borderRadius: v })} min={0} max={64} />
        </Field>
        <Field label="Border width">
          <Slider value={style.borderWidth ?? 0} onChange={(v) => set({ borderWidth: v })} min={0} max={8} />
        </Field>
        {(style.borderWidth ?? 0) > 0 && (
          <Field label="Border color">
            <ColorInput value={style.borderColor} onChange={(c) => set({ borderColor: c })} />
          </Field>
        )}
        <Field label="Opacity">
          <Slider value={Math.round((style.opacity ?? 1) * 100)} onChange={(v) => set({ opacity: v / 100 })} min={0} max={100} />
        </Field>
        <div className="pt-2 text-[10px] font-semibold uppercase tracking-widest text-ink-500">Depth &amp; effects</div>
        <SurfaceEffectsControls node={node} />
      </PanelSection>

      {(isTextish || node.type === "icon" || node.type === "checkbox" || node.type === "input") && (
        <PanelSection title="Typography" icon="type" defaultOpen={false}>
          <Field label="Font size">
            <Slider value={style.fontSize ?? 16} onChange={(v) => set({ fontSize: v })} min={8} max={120} />
          </Field>
          <Field label="Weight">
            <Slider value={style.fontWeight ?? 400} onChange={(v) => set({ fontWeight: v })} min={100} max={900} step={100} />
          </Field>
          <Field label="Line height">
            <Slider value={style.lineHeight ?? 1.4} onChange={(v) => set({ lineHeight: v })} min={0.8} max={2.4} step={0.05} />
          </Field>
          <Field label="Letter spacing">
            <Slider value={style.letterSpacing ?? 0} onChange={(v) => set({ letterSpacing: v })} min={-4} max={12} step={0.1} />
          </Field>
          <Field label="Color">
            <ColorInput value={style.color} onChange={(c) => set({ color: c })} allowSemantic semanticOptions={[...SEMANTIC_COLORS]} />
          </Field>
          <Field label="Text align">
            <Segmented
              size="sm"
              value={style.textAlign ?? "left"}
              onChange={(v) => set({ textAlign: v as StyleProps["textAlign"] })}
              options={[
                { value: "left", label: "Left" },
                { value: "center", label: "Center" },
                { value: "right", label: "Right" },
              ]}
            />
          </Field>
          <div className="pt-2 text-[10px] font-semibold uppercase tracking-widest text-ink-500">Type style</div>
          <TextEffectControls node={node} />
        </PanelSection>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Action / link section (works for buttons, links, images, icons)     */
/* ------------------------------------------------------------------ */

function ActionSection({ node }: { node: ElementNode }) {
  const setInteraction = useEditor((s) => s.setInteraction);
  const setProp = useEditor((s) => s.setProp);
  const project = useEditor((s) => s.getProject());
  const page = useEditor((s) => s.getPage());
  const onClick: Interaction | undefined = node.onClick;
  const kind = onClick?.kind ?? "none";
  const anchors = project && page ? pageAnchors(project, page) : [];
  const canHaveAction = ["button", "link", "image", "gif", "icon", "logo"].includes(node.type);
  const ref = useRef<HTMLDivElement>(null);
  const [flash, setFlash] = useState(false);

  // Canvas toolbar "Add action" scrolls here and highlights the section.
  useEffect(() => {
    const handler = (e: Event) => {
      if ((e as CustomEvent).detail !== node.id) return;
      ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      setFlash(true);
      window.setTimeout(() => setFlash(false), 1200);
    };
    window.addEventListener("frontel:focus-action", handler);
    return () => window.removeEventListener("frontel:focus-action", handler);
  }, [node.id]);

  if (!canHaveAction) return null;

  const linkHref = node.props.href as string | undefined;

  return (
    <div ref={ref} className={flash ? "fe-flash rounded" : undefined}>
      <PanelSection title="Action" icon="link" badge={kind !== "none" ? kind : undefined}>
        <Hint>What happens when visitors click this {ELEMENT_LABEL[node.type] ?? "element"}.</Hint>
        <Segmented
          size="sm"
          value={kind === "submit-api" ? "none" : (kind as string)}
          onChange={(v) => {
            if (v === "none") setInteraction(node.id, undefined);
            else if (v === "navigate") setInteraction(node.id, { kind: "navigate", path: "/" });
            else if (v === "scroll-to")
              setInteraction(node.id, { kind: "scroll-to", anchorId: anchors[0]?.anchorId ?? "" });
            else if (v === "open-url") setInteraction(node.id, { kind: "open-url", url: "https://" });
          }}
          options={[
            { value: "none", label: "None" },
            { value: "navigate", label: "Page" },
            { value: "scroll-to", label: "Scroll" },
            { value: "open-url", label: "URL" },
          ]}
        />
        {onClick?.kind === "navigate" && (
          <Field label="Go to page" tip="Path of an internal page, e.g. /pricing">
            <SelectInput
              value={onClick.path}
              onChange={(v) => setInteraction(node.id, { kind: "navigate", path: v })}
              options={[
                ...(project?.pages ?? [])
                  .filter((p) => p.path !== page?.path)
                  .map((p) => ({ value: p.path, label: `${p.name} (${p.path})` })),
                { value: onClick.path, label: onClick.path },
              ]}
            />
          </Field>
        )}
        {onClick?.kind === "scroll-to" && (
          <Field label="Scroll to section" tip="Sections can be made scroll targets in the Advanced tab">
            <SelectInput
              value={onClick.anchorId}
              onChange={(v) => setInteraction(node.id, { kind: "scroll-to", anchorId: v })}
              options={
                anchors.length
                  ? anchors.map((a) => ({ value: a.anchorId, label: a.name }))
                  : [{ value: "", label: "No anchored sections yet" }]
              }
            />
          </Field>
        )}
        {onClick?.kind === "open-url" && (
          <Field label="External URL">
            <TextInput value={onClick.url} mono onChange={(v) => setInteraction(node.id, { kind: "open-url", url: v })} />
          </Field>
        )}
        {kind === "none" && node.type !== "link" && (
          <Hint>Tip: for a plain link, choose “URL” and type the address.</Hint>
        )}
        {/* link elements keep a plain href (real <a> semantics in generated code) */}
        {node.type === "link" && (
          <Field label="Href" tip="Used when no click action is set">
            <TextInput value={linkHref ?? ""} mono onChange={(v) => setProp(node.id, "href", v)} />
          </Field>
        )}
      </PanelSection>
    </div>
  );
}

const ELEMENT_LABEL: Record<string, string> = {
  button: "button",
  link: "link",
  image: "image",
  gif: "image",
  icon: "icon",
  logo: "logo",
};

/* ------------------------------------------------------------------ */
/* Content tab controls                                                */
/* ------------------------------------------------------------------ */

function AssetPicker({ node }: { node: ElementNode }) {
  const assets = useEditor((s) => s.getProject()?.assets ?? {});
  const setProp = useEditor((s) => s.setProp);
  const addAsset = useEditor((s) => s.addAsset);
  const fileRef = useRef<HTMLInputElement>(null);
  const list = Object.values(assets);

  const onUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const id = uid("asset");
      addAsset({
        id,
        name: file.name,
        type: file.type.startsWith("video") ? "video" : "image",
        src: String(reader.result),
      });
      setProp(node.id, "assetId", id);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <SelectInput
        value={node.props.assetId ?? ""}
        onChange={(v) => setProp(node.id, "assetId", v || null)}
        options={[{ value: "", label: "No asset selected" }, ...list.map((a) => ({ value: a.id, label: a.name }))]}
      />
      <Button variant="ghost" onClick={() => fileRef.current?.click()}>
        Upload file…
      </Button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onUpload(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function ContentControls({ node }: { node: ElementNode }) {
  const setProp = useEditor((s) => s.setProp);
  const p = node.props;
  const hasAny = true;

  return (
    <>
      <PanelSection title="Content" icon="type">
        {(node.type === "heading" || node.type === "text") && (
          <>
            <Field label="Text">
              <textarea
                className="fe-field min-h-16 w-full rounded-md border border-ink-600 bg-ink-900 px-2 py-1.5 text-[13px] text-ink-200"
                value={p.text ?? ""}
                onChange={(e) => setProp(node.id, "text", e.target.value)}
              />
            </Field>
            {node.type === "heading" && (
              <Field label="Level" tip="H1 is the page title; use H2/H3 for section titles">
                <SelectInput
                  value={String(p.level ?? 2)}
                  onChange={(v) => setProp(node.id, "level", Number(v))}
                  options={[1, 2, 3, 4, 5, 6].map((n) => ({ value: String(n), label: `H${n}` }))}
                />
              </Field>
            )}
          </>
        )}
        {(node.type === "button" || node.type === "link" || node.type === "checkbox" || node.type === "input" || node.type === "select") && (
          <Field label="Label">
            <TextInput value={p.label ?? ""} onChange={(v) => setProp(node.id, "label", v)} />
          </Field>
        )}
        {node.type === "input" && (
          <>
            <Field label="Placeholder"><TextInput value={p.placeholder ?? ""} onChange={(v) => setProp(node.id, "placeholder", v)} /></Field>
            <Field label="Input type">
              <SelectInput
                value={p.inputType ?? "text"}
                onChange={(v) => setProp(node.id, "inputType", v)}
                options={[
                  { value: "text", label: "Text" },
                  { value: "email", label: "Email" },
                  { value: "password", label: "Password" },
                  { value: "number", label: "Number" },
                  { value: "tel", label: "Tel" },
                ]}
              />
            </Field>
            <label className="flex items-center gap-2 text-[12px] text-ink-300">
              <input type="checkbox" checked={p.required ?? false} onChange={(e) => setProp(node.id, "required", e.target.checked)} />
              Required
            </label>
          </>
        )}
        {node.type === "select" && (
          <Field label="Options (one per line)">
            <textarea
              className="fe-field min-h-16 w-full rounded-md border border-ink-600 bg-ink-900 px-2 py-1.5 font-mono text-[12px] text-ink-200"
              value={(p.options ?? []).join("\n")}
              onChange={(e) => setProp(node.id, "options", e.target.value.split("\n").filter(Boolean))}
            />
          </Field>
        )}
        {["image", "gif", "video"].includes(node.type) && (
          <>
            <Field label="Asset"><AssetPicker node={node} /></Field>
            <Field label="Alt text" tip="Describes the media for accessibility and SEO">
              <TextInput value={p.alt ?? ""} onChange={(v) => setProp(node.id, "alt", v)} />
            </Field>
          </>
        )}
        {node.type === "icon" && (
          <Field label="Icon">
            <SelectInput
              value={p.icon ?? "spark"}
              onChange={(v) => setProp(node.id, "icon", v)}
              options={ICON_NAMES.map((n) => ({ value: n, label: n }))}
            />
          </Field>
        )}
        {node.type === "logo" && <Field label="Logo text"><TextInput value={p.label ?? ""} onChange={(v) => setProp(node.id, "label", v)} /></Field>}
        {node.type === "button" && (
          <Field label="Variant">
            <SelectInput
              value={p.variant ?? "primary"}
              onChange={(v) => setProp(node.id, "variant", v)}
              options={[
                { value: "primary", label: "Primary" },
                { value: "secondary", label: "Secondary" },
                { value: "ghost", label: "Ghost" },
                { value: "outline", label: "Outline" },
              ]}
            />
          </Field>
        )}
        {node.type === "form" && <FormActionControl node={node} />}
        {!hasAny && null}
      </PanelSection>
      <ActionSection node={node} />
    </>
  );
}

/** Form submit behavior — the form's own "action". */
function FormActionControl({ node }: { node: ElementNode }) {
  const setProp = useEditor((s) => s.setProp);
  const action = (node.props.action ?? { kind: "none" }) as ElementNode["props"]["action"];
  const kind = action?.kind ?? "none";
  return (
    <>
      <Field label="On submit" tip="What the form does when the visitor presses the submit button">
        <SelectInput
          value={kind}
          onChange={(v) =>
            setProp(
              node.id,
              "action",
              v === "none"
                ? { kind: "none" }
                : v === "navigate"
                  ? { kind: "navigate", path: "/" }
                  : { kind: "submit-api", method: "POST", url: "" },
            )
          }
          options={[
            { value: "none", label: "Nothing (demo)" },
            { value: "navigate", label: "Go to a page" },
            { value: "submit-api", label: "Send to an API endpoint" },
          ]}
        />
      </Field>
      {action?.kind === "submit-api" && (
        <Field label="API endpoint" tip="Receives a JSON POST of every field, e.g. /api/waitlist">
          <TextInput
            value={action.url}
            mono
            placeholder="/api/waitlist"
            onChange={(v) => setProp(node.id, "action", { ...action, url: v })}
          />
        </Field>
      )}
      {action?.kind === "navigate" && (
        <Field label="Page path">
          <TextInput
            value={action.path}
            mono
            onChange={(v) => setProp(node.id, "action", { ...action, path: v })}
          />
        </Field>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Motion tab                                                          */
/* ------------------------------------------------------------------ */

function AnimationControls({ node }: { node: ElementNode }) {
  const setAnimation = useEditor((s) => s.setAnimation);
  const a: AnimationSpec | undefined = node.animation;
  const ref = useRef<HTMLDivElement>(null);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      if ((e as CustomEvent).detail !== node.id) return;
      ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      setFlash(true);
      window.setTimeout(() => setFlash(false), 1200);
    };
    window.addEventListener("frontel:focus-animation", handler);
    return () => window.removeEventListener("frontel:focus-animation", handler);
  }, [node.id]);

  const patch = (p: Partial<AnimationSpec>) =>
    setAnimation(node.id, {
      type: "fade",
      trigger: "on-scroll",
      duration: 600,
      delay: 0,
      easing: "ease-out",
      ...a,
      ...p,
    } as AnimationSpec);

  return (
    <div ref={ref} className={flash ? "fe-flash rounded" : undefined}>
      <PanelSection title="Animation" icon="wand" badge={a ? a.type : undefined}>
        <SelectInput
          value={a?.type ?? "none"}
          onChange={(v) =>
            v === "none" ? setAnimation(node.id, undefined) : patch({ type: v as AnimationSpec["type"] })
          }
          options={[
            { value: "none", label: "None" },
            { value: "fade", label: "Fade" },
            { value: "fade-up", label: "Fade Up" },
            { value: "fade-down", label: "Fade Down" },
            { value: "slide-left", label: "Slide Left" },
            { value: "slide-right", label: "Slide Right" },
            { value: "zoom-in", label: "Zoom In" },
            { value: "hover-lift", label: "Hover Lift" },
            { value: "hover-glow", label: "Hover Glow" },
            { value: "parallax", label: "Parallax" },
            { value: "scroll-progress", label: "Scroll Progress" },
            { value: "background-transition", label: "Background Transition" },
          ]}
        />
        {a && (
          <>
            {!a.type.startsWith("hover") && a.type !== "parallax" && a.type !== "background-transition" && a.type !== "scroll-progress" && (
              <Field label="Trigger">
                <SelectInput
                  value={a.trigger}
                  onChange={(v) => patch({ trigger: v as AnimationSpec["trigger"] })}
                  options={[
                    { value: "on-load", label: "On load" },
                    { value: "on-scroll", label: "On scroll into view" },
                  ]}
                />
              </Field>
            )}
            {!a.type.startsWith("hover") && (
              <>
                <Field label="Duration (ms)"><Slider value={a.duration} onChange={(v) => patch({ duration: v })} min={100} max={2000} step={50} /></Field>
                <Field label="Delay (ms)"><Slider value={a.delay} onChange={(v) => patch({ delay: v })} min={0} max={1500} step={50} /></Field>
                <Field label="Easing">
                  <SelectInput
                    value={a.easing}
                    onChange={(v) => patch({ easing: v as AnimationSpec["easing"] })}
                    options={[
                      { value: "ease-out", label: "Ease Out" },
                      { value: "ease-in", label: "Ease In" },
                      { value: "ease-in-out", label: "Ease In Out" },
                      { value: "linear", label: "Linear" },
                      { value: "spring", label: "Spring" },
                    ]}
                  />
                </Field>
              </>
            )}
            {a.type === "parallax" && (
              <Field label="Intensity"><Slider value={a.intensity ?? 0.4} onChange={(v) => patch({ intensity: v })} min={0.05} max={1} step={0.05} /></Field>
            )}
            {a.type === "background-transition" && (
              <Field label="Colors">
                <div className="flex gap-1.5">
                  <ColorInput value={a.colors?.[0]} onChange={(c) => patch({ colors: [c ?? "#0c0e13", a.colors?.[1] ?? "#141822"] })} />
                  <ColorInput value={a.colors?.[1]} onChange={(c) => patch({ colors: [a.colors?.[0] ?? "#0c0e13", c ?? "#141822"] })} />
                </div>
              </Field>
            )}
          </>
        )}
      </PanelSection>
    </div>
  );
}

function Scene3DControls({ node }: { node: ElementNode }) {
  const setScene3D = useEditor((s) => s.setScene3D);
  // Select the stable record (not a derived array) to avoid snapshot churn.
  const assetsRecord = useEditor((s) => s.getProject()?.assets);
  const project = useEditor((s) => s.getProject());
  const page = useEditor((s) => s.getPage());
  const models = useMemo(
    () => Object.values(assetsRecord ?? {}).filter((a) => a.type === "model"),
    [assetsRecord],
  );
  const cfg = node.scene3d;
  if (!cfg) return null;
  const preset = cfg.effectId ? getEffect3D(cfg.effectId) : undefined;
  const mode = cfg.mode ?? (cfg.effectId ? "effect" : "shape");

  /**
   * "Fill as background": converts the scene node into the page's freeform
   * background — full-bleed layer with UI free to overlay it.
   */
  const fillAsBackground = () => {
    const state = useEditor.getState();
    if (!project || !page) return;
    const root = project.nodes[page.rootId];
    if (!root) return;
    state.moveRelative(node.id, page.rootId, 0);
    state.setStyle(node.id, "base", {
      position: "absolute",
      left: 0,
      top: 0,
      width: { kind: "fixed", value: 100, unit: "%" },
      height: { kind: "fixed", value: 100, unit: "%" },
      zIndex: 0,
    });
    state.setProp(node.id, "freeformLayer", true);
    state.setStyle(node.id, "base", { overflow: "hidden" });
  };

  const setParam = (key: string, value: number | string | boolean) =>
    setScene3D(node.id, { effectParams: { ...(cfg.effectParams ?? {}), [key]: value } });

  /** Renders the per-effect parameter controls from the preset's param table. */
  const renderEffectParams = () => {
    if (!preset) return null;
    return (
      <>
        {preset.params.map((p) => {
          const value = cfg.effectParams?.[p.key] ?? preset.defaults[p.key];
          if (p.kind === "color") {
            return (
              <Field key={p.key} label={p.label}>
                <ColorInput value={String(value ?? "")} onChange={(c) => setParam(p.key, c ?? "#000000")} />
              </Field>
            );
          }
          if (p.kind === "boolean") {
            return (
              <label key={p.key} className="flex items-center gap-2 text-[12px] text-ink-300">
                <input type="checkbox" checked={!!value} onChange={(e) => setParam(p.key, e.target.checked)} />
                {p.label}
              </label>
            );
          }
          if (p.kind === "select") {
            return (
              <Field key={p.key} label={p.label}>
                <SelectInput
                  value={String(value ?? "")}
                  onChange={(v) => setParam(p.key, v)}
                  options={(p.options ?? []).map((o) => ({ value: o, label: o }))}
                />
              </Field>
            );
          }
          return (
            <Field key={p.key} label={p.label}>
              <Slider
                value={Number(value ?? 0)}
                onChange={(v) => setParam(p.key, v)}
                min={p.min ?? 0}
                max={p.max ?? 1}
                step={p.step ?? 0.01}
              />
            </Field>
          );
        })}
      </>
    );
  };

  return (
    <>
      <PanelSection title="3D Scene" icon="box" badge={preset ? preset.name : mode === "shader" ? "glsl" : cfg.shape}>
      {/* Mode switch: shape object / preset effect / custom shader */}
      <Field label="Type" tip="Object = 3D model stage · Effect = preset background effect · Shader = custom GLSL">
        <Segmented
          size="sm"
          value={mode}
          onChange={(v) => setScene3D(node.id, { mode: v as "shape" | "effect" | "shader" })}
          options={[
            { value: "shape", label: "Object" },
            { value: "effect", label: "Effect" },
            { value: "shader", label: "Shader" },
          ]}
        />
      </Field>

      {mode === "effect" && (
        <Field label="Effect" tip={`${EFFECTS_3D.length} presets — vanta.js backgrounds, GLSL shaders and object stages`}>
          <SelectInput
            value={cfg.effectId ?? ""}
            onChange={(v) => {
              const p = getEffect3D(v);
              setScene3D(node.id, p ? { effectId: p.id, effectParams: { ...p.defaults } } : { effectId: undefined });
            }}
            options={[
              { value: "", label: "Choose an effect…" },
              ...EFFECTS_3D.map((e) => ({ value: e.id, label: `${e.name} · ${e.family}` })),
            ]}
          />
        </Field>
      )}

      {mode === "effect" && preset && renderEffectParams()}

      {mode === "shape" && (
        <>
          <Field label="Model" tip="Assign a GLB/GLTF model from your assets — replaces the procedural shape">
            <SelectInput
              value={cfg.modelAssetId ?? ""}
              onChange={(v) => setScene3D(node.id, { modelAssetId: v || null, modelScale: cfg.modelScale ?? 1 })}
              options={[
                { value: "", label: models.length ? "No model (procedural shape)" : "No models uploaded yet" },
                ...models.map((m) => ({ value: m.id, label: m.name })),
              ]}
            />
          </Field>
          {cfg.modelAssetId && (
            <Field label="Model scale" tip="Uniform scale multiplier on top of auto-fit">
              <Slider value={cfg.modelScale ?? 1} onChange={(v) => setScene3D(node.id, { modelScale: v })} min={0.1} max={4} step={0.1} />
            </Field>
          )}
          <Field label="Shape">
            <SelectInput
              value={cfg.shape}
              onChange={(v) => setScene3D(node.id, { shape: v as typeof cfg.shape })}
              options={[
                { value: "torus-knot", label: "Torus Knot" },
                { value: "icosahedron", label: "Icosahedron" },
                { value: "box", label: "Box" },
                { value: "sphere", label: "Sphere" },
              ]}
            />
          </Field>
          <Field label="Color"><ColorInput value={cfg.color} onChange={(c) => setScene3D(node.id, { color: c ?? "#2dd4bf" })} /></Field>
          <Field label="Rotation speed"><Slider value={cfg.rotationSpeed} onChange={(v) => setScene3D(node.id, { rotationSpeed: v })} min={0} max={2} step={0.05} /></Field>
          <Field label="Float amplitude"><Slider value={cfg.floatAmplitude} onChange={(v) => setScene3D(node.id, { floatAmplitude: v })} min={0} max={1} step={0.05} /></Field>
          <Field label="Camera distance"><Slider value={cfg.cameraDistance} onChange={(v) => setScene3D(node.id, { cameraDistance: v })} min={2.5} max={12} step={0.25} /></Field>
          <Field label="Scroll influence"><Slider value={cfg.scrollInfluence} onChange={(v) => setScene3D(node.id, { scrollInfluence: v })} min={0} max={1} step={0.05} /></Field>
          <label className="flex items-center gap-2 text-[12px] text-ink-300">
            <input type="checkbox" checked={cfg.wireframe} onChange={(e) => setScene3D(node.id, { wireframe: e.target.checked })} />
            Wireframe
          </label>
        </>
      )}

      {mode === "shader" && (
        <Field label="Fragment body" tip="GLSL with uniforms: iTime, iResolution, iMouse, uColorA/B/C, uSpeed, uZoom">
          <textarea
            className="fe-field min-h-32 w-full rounded-md border border-ink-600 bg-ink-900 px-2 py-1.5 font-mono text-[11px] text-ink-200"
            value={cfg.shaderCode ?? DEFAULT_SHADER_BODY}
            onChange={(e) => setScene3D(node.id, { shaderCode: e.target.value })}
            spellCheck={false}
          />
        </Field>
      )}

      <Button
        variant="ghost"
        title="Make this scene a full-bleed background layer that normal UI can overlay"
        onClick={fillAsBackground}
      >
        Fill as page background
      </Button>
      <Hint>
        A scene is a <b>background</b>: drop any element onto it and it renders on top, no matter how many layers the
        effect has. “Fill as page background” stretches it behind the whole page.
      </Hint>
    </PanelSection>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Advanced tab                                                        */
/* ------------------------------------------------------------------ */

function AnchorControl({ node }: { node: ElementNode }) {
  const setAnchor = useEditor((s) => s.setAnchor);
  return (
    <PanelSection title="Anchor" icon="anchor" defaultOpen={false}>
      <Hint>
        Give this section an anchor id, then any button can “scroll to section” and jump here.
      </Hint>
      <Field label="Anchor id">
        <TextInput
          value={node.anchorId ?? ""}
          mono
          placeholder="e.g. features"
          onChange={(v) => setAnchor(node.id, v.replace(/[^a-zA-Z0-9-]/g, "-"))}
        />
      </Field>
    </PanelSection>
  );
}

function VisibilityControl({ node }: { node: ElementNode }) {
  const setStyle = useEditor((s) => s.setStyle);
  const viewport = useEditor((s) => s.viewport);
  const layer = viewport === "desktop" ? "base" : viewport;
  const hiddenAt = (() => {
    const s = node.style[layer] ?? {};
    return s.visible === false;
  })();
  return (
    <PanelSection title="Visibility" icon="eye" defaultOpen={false}>
      <button
        className={`flex items-center justify-between rounded-md border px-2.5 py-1.5 text-[12px] transition-colors ${
          hiddenAt
            ? "border-accent-700 bg-accent-600/10 text-accent-400"
            : "border-ink-600 bg-ink-900 text-ink-300 hover:border-ink-500"
        }`}
        onClick={() =>
          setStyle(node.id, layer, { visible: hiddenAt } as Partial<StyleProps>)
        }
      >
        <span className="flex items-center gap-2">
          <EditorIcon name={hiddenAt ? "eyeOff" : "eye"} size={12} />
          {hiddenAt ? `Hidden on ${layer === "base" ? "desktop" : layer}` : `Visible on ${layer === "base" ? "desktop" : layer}`}
        </span>
        <span className="text-[10px] text-ink-500">{hiddenAt ? "click to show" : "click to hide"}</span>
      </button>
      <Hint>Hide elements per device — e.g. hide the nav menu on mobile.</Hint>
    </PanelSection>
  );
}

/* ------------------------------------------------------------------ */
/* Inspector shell                                                     */
/* ------------------------------------------------------------------ */

export function Inspector() {
  const project = useEditor((s) => s.getProject());
  const selectedId = useEditor((s) => s.selectedId);
  const renameElement = useEditor((s) => s.renameElement);
  const [tab, setTab] = useState<InspectorTab>("content");
  const nameRef = useRef<HTMLInputElement>(null);
  const node = project && selectedId ? project.nodes[selectedId] : null;

  // Canvas toolbar "Rename…" focuses the name field.
  useEffect(() => {
    const handler = (e: Event) => {
      if ((e as CustomEvent).detail !== selectedId) return;
      setTab("advanced");
      window.setTimeout(() => nameRef.current?.select(), 30);
    };
    window.addEventListener("frontel:focus-rename", handler);
    return () => window.removeEventListener("frontel:focus-rename", handler);
  }, [selectedId]);

  // Anchor edits live in Advanced; toolbar routes here too.
  useEffect(() => {
    const handler = (e: Event) => {
      if ((e as CustomEvent).detail !== selectedId) return;
      setTab("advanced");
    };
    window.addEventListener("frontel:focus-anchor", handler);
    return () => window.removeEventListener("frontel:focus-anchor", handler);
  }, [selectedId]);

  if (!project) return null;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto">
      {node ? (
        <>
          {/* Name + type header */}
          <div className="flex h-10 shrink-0 items-center justify-between border-b border-ink-700/60 px-3">
            <input
              ref={nameRef}
              className="fe-field min-w-0 flex-1 rounded bg-transparent px-1 py-0.5 text-[13px] font-semibold text-ink-100"
              value={node.name}
              onChange={(e) => renameElement(node.id, e.target.value)}
              aria-label="Element name"
            />
            <span className="ml-2 shrink-0 rounded bg-ink-700/60 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-ink-400">
              {node.type}
            </span>
          </div>

          {/* Tab strip */}
          <div className="flex shrink-0 border-b border-ink-700/60 bg-ink-900/40">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex flex-1 items-center justify-center gap-1 border-b-2 px-1 py-2 text-[11px] font-medium transition-colors ${
                  tab === t.id
                    ? "border-accent-500 text-accent-400"
                    : "border-transparent text-ink-400 hover:text-ink-200"
                }`}
              >
                <EditorIcon name={t.icon} size={11} />
                {t.label}
              </button>
            ))}
          </div>

          {/* Responsive controls always visible */}
          <div className="px-3 py-2">
            <BreakpointBar />
          </div>

          {tab === "content" && <ContentControls node={node} />}
          {tab === "design" && (
            <>
              <StylePresetSection node={node} />
              <AppearanceSection node={node} />
              <LayoutSection node={node} />
            </>
          )}
          {tab === "motion" && (
            <>
              <AnimationControls node={node} />
              {node.type === "scene3d" && <Scene3DControls node={node} />}
            </>
          )}
          {tab === "advanced" && (
            <>
              <VisibilityControl node={node} />
              <AnchorControl node={node} />
            </>
          )}
        </>
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
          <div className="flex size-10 items-center justify-center rounded-lg bg-ink-800 text-ink-500">
            <EditorIcon name="cursor" size={18} />
          </div>
          <div className="text-[13px] font-semibold text-ink-200">Nothing selected</div>
          <p className="text-[11.5px] leading-relaxed text-ink-500">
            Click any element on the canvas — or in the structure tree — to edit its content, style and actions.
          </p>
          <div className="mt-1 flex flex-col gap-1 text-[11px] text-ink-500">
            <span><kbd className="fe-kbd">Del</kbd> delete selection</span>
            <span><kbd className="fe-kbd">⌘D</kbd> duplicate</span>
            <span><kbd className="fe-kbd">?</kbd> all shortcuts</span>
          </div>
        </div>
      )}
    </div>
  );
}
