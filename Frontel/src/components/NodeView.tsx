/**
 * NodeView — the live renderer.
 *
 * One component per element type, driven purely by the project schema. The
 * identical tree runs in the editor canvas and in preview mode; the code
 * generator emits equivalent React + CSS from the same schema.
 *
 * Each NodeView merges its own responsive overrides (base → tablet → mobile)
 * using the breakpoint from the render environment.
 */
import { useEffect, useRef, useState } from "react";
import type { CSSProperties, FormEvent, ReactNode } from "react";
import type { ElementNode, NodeId, Project } from "@/schemas/types";
import { mergeStyle } from "@/lib/tree";
import { useEditor } from "@/lib/store";
import {
  documentScrollProgress,
  elementViewportProgress,
  hoverActiveStyle,
  hoverTransition,
  isHoverFx,
  isReveal,
  isScrollFx,
  mixColors,
  parallaxOffset,
  prefersReducedMotion,
  REVEAL_VISIBLE,
  revealHidden,
  revealTransition,
} from "@/lib/animation";
import { iconPath } from "@/lib/icons";
import { assetUrl, InFormContext, useInForm, useRenderEnv } from "./renderContext";
import { Scene3DView } from "./Scene3DView";
import { EffectsBackground } from "./EffectsBackground";
import { DEFAULT_SCENE_3D, type Scene3DConfig } from "@/schemas/types";
import { easingCss, styleToCss } from "@/lib/styles";

/* ------------------------------------------------------------------ */
/* Animation + editor behavior                                         */
/* ------------------------------------------------------------------ */

export interface EditorWiring {
  selectedId: NodeId | null;
  hoveredId: NodeId | null;
  onSelect: (id: NodeId) => void;
  onHover: (id: NodeId | null) => void;
}

/**
 * Applies reveal/hover/scroll effects and, in canvas mode, click-to-select
 * and hover tracking. Returns extra styles + DOM handlers to spread.
 */
function useNodeFx(node: ElementNode, editor?: EditorWiring) {
  const env = useRenderEnv();
  const ref = useRef<HTMLElement | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [, setScrollTick] = useState(0);
  const anim = node.animation;
  const reduced = useRef(prefersReducedMotion()).current;

  const setRef = (el: HTMLElement | null) => {
    ref.current = el;
  };

  // Reveal animations via IntersectionObserver (fire once when entering).
  useEffect(() => {
    if (!anim || !isReveal(anim) || reduced) return;
    if (anim.trigger === "on-load") {
      const t = window.setTimeout(() => setRevealed(true), 30);
      return () => window.clearTimeout(t);
    }
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setRevealed(true);
            io.disconnect();
          }
        }
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [anim, reduced]);

  // Scroll-driven effects (parallax, background transition).
  useEffect(() => {
    if (!anim || !isScrollFx(anim) || reduced) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setScrollTick((t) => t + 1));
    };
    const doc = ref.current?.ownerDocument;
    doc?.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      doc?.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [anim, reduced]);

  const fxStyle: CSSProperties = {};
  const handlers: Record<string, unknown> = {};

  if (anim && !reduced) {
    if (isReveal(anim)) {
      const shown = revealed;
      Object.assign(
        fxStyle,
        revealHidden(anim),
        revealTransition(anim),
        shown ? REVEAL_VISIBLE : {},
      );
    }
    if (isScrollFx(anim) && anim.type === "parallax") {
      const el = ref.current;
      const progress = el ? elementViewportProgress(el) - 0.5 : 0;
      fxStyle.transform = `translateY(${parallaxOffset(progress, anim.intensity ?? 0.4)}px)`;
      fxStyle.willChange = "transform";
    }
    if (isScrollFx(anim) && anim.type === "background-transition" && anim.colors) {
      const el = ref.current;
      const progress = el ? elementViewportProgress(el) : 0;
      fxStyle.background = mixColors(anim.colors[0], anim.colors[1], progress);
    }
    if (isScrollFx(anim) && anim.type === "scroll-progress") {
      const doc = ref.current?.ownerDocument;
      const p = doc ? documentScrollProgress(doc) : 0;
      fxStyle.background = `linear-gradient(90deg, var(--fe-primary) ${p * 100}%, transparent ${p * 100}%)`;
    }
    if (isHoverFx(anim)) {
      const active = hoverActiveStyle(anim.type, anim.colors);
      const touched = Object.keys(active);
      fxStyle.transition = `${hoverTransition(anim.type)} ${anim.duration}ms ${easingCss(anim.easing)}`;
      handlers.onMouseEnter = (e: React.MouseEvent<HTMLElement>) => {
        Object.assign(e.currentTarget.style, active);
      };
      handlers.onMouseLeave = (e: React.MouseEvent<HTMLElement>) => {
        // Clear exactly what was applied — never the element's own styles.
        const style = e.currentTarget.style as unknown as Record<string, string>;
        for (const key of touched) style[key] = "";
      };
    }
  }

  // Canvas-only: click-to-select + hover tracking + drag source. Preview stays inert.
  if (editor && env.mode === "canvas") {
    handlers.onClick = (e: React.MouseEvent<HTMLElement>) => {
      e.stopPropagation();
      editor.onSelect(node.id);
    };
    handlers.onMouseOver = (e: React.MouseEvent<HTMLElement>) => {
      e.stopPropagation();
      editor.onHover(node.id);
    };
    handlers.onMouseOut = () => editor.onHover(null);
    // Dragging is owned entirely by the pointer-based box drag in Canvas (ghost
    // box + box-grid target), for free and flow elements alike. NodeView keeps
    // selection, hover and inline text editing.
  }

  return { setRef, fxStyle, handlers };
}

/** Executes a node's click interaction (preview mode). */
function useInteraction(node: ElementNode) {
  const env = useRenderEnv();
  const onClick = node.onClick;
  if (!onClick || onClick.kind === "none") return {};
  return {
    onClick: (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      switch (onClick.kind) {
        case "navigate":
          env.navigate(onClick.path);
          break;
        case "scroll-to": {
          const doc = e.currentTarget.ownerDocument;
          const target = doc.querySelector(`[data-fe-anchor="${onClick.anchorId}"]`);
          target?.scrollIntoView({ behavior: "smooth", block: "start" });
          break;
        }
        case "open-url":
          window.open(onClick.url, "_blank", "noopener");
          break;
        default:
          break;
      }
    },
  };
}

/* ------------------------------------------------------------------ */
/* NodeView                                                            */
/* ------------------------------------------------------------------ */

export interface NodeViewProps {
  node: ElementNode;
  project: Project;
  editor?: EditorWiring;
}

const CONTAINER_TYPES = new Set(["section", "container", "flex", "grid", "stack"]);

export function NodeView({ node, project, editor }: NodeViewProps) {
  const env = useRenderEnv();
  const effective = mergeStyle(
    node.style.base,
    node.style.tablet,
    node.style.mobile,
    env.breakpoint,
  );
  const css = styleToCss(effective, project.theme);

  if (node.type === "form") return <FormNode node={node} project={project} style={css} editor={editor} />;
  if (node.type === "scene3d")
    return <SceneNode node={node} style={css} project={project} editor={editor} />;
  if (CONTAINER_TYPES.has(node.type))
    return <ContainerNode node={node} style={css} project={project} editor={editor} />;
  if (node.type === "heading" || node.type === "text")
    return <TextNode node={node} style={css} editor={editor} />;
  return <LeafNode node={node} style={css} editor={editor} />;
}

/* ---------------- containers ---------------- */

function Children({
  node,
  project,
  editor,
}: {
  node: ElementNode;
  project: Project;
  editor?: EditorWiring;
}) {
  return (
    <>
      {node.children.map((childId) => {
        const child = project.nodes[childId];
        if (!child) return null;
        return <NodeView key={childId} node={child} project={project} editor={editor} />;
      })}
    </>
  );
}

function ContainerNode({
  node,
  style,
  project,
  editor,
}: {
  node: ElementNode;
  style: CSSProperties;
  project: Project;
  editor?: EditorWiring;
}) {
  const fx = useNodeFx(node, editor);
  return (
    <div ref={fx.setRef} data-fe-node={node.id} style={{ ...style, ...fx.fxStyle }} {...fx.handlers}>
      <Children node={node} project={project} editor={editor} />
    </div>
  );
}

/**
 * A 3D scene is a BACKGROUND, not a picture: the effect (or object stage) is
 * rendered into its own absolutely-positioned layer behind the node's own
 * children, so anything dropped onto a scene sits on top of it. The wrapper is
 * an isolated stacking context, which is what keeps a negative z-index layer
 * behind in-flow children without escaping behind the page.
 */
function SceneNode({
  node,
  style,
  project,
  editor,
}: {
  node: ElementNode;
  style: CSSProperties;
  project: Project;
  editor?: EditorWiring;
}) {
  const fx = useNodeFx(node, editor);
  const env = useRenderEnv();
  const config: Partial<Scene3DConfig> = node.scene3d ?? {};
  const modelAsset = config.modelAssetId ? env.assets[config.modelAssetId] : undefined;
  const modelUrl = assetUrl(modelAsset);
  const mode = config.mode ?? (config.effectId ? "effect" : "shape");
  const hasChildren = node.children.length > 0;
  const scene =
    mode === "effect" && config.effectId ? (
      <EffectsBackground config={{ ...DEFAULT_SCENE_3D, ...config }} />
    ) : (
      <Scene3DView config={config} modelUrl={modelUrl} />
    );

  return (
    <div
      ref={fx.setRef}
      data-fe-node={node.id}
      style={{
        ...style,
        // Free children are anchored to this box, and isolate keeps the
        // backdrop layer behind them instead of behind the page.
        position: style.position ?? "relative",
        isolation: "isolate",
        ...fx.fxStyle,
      }}
      {...fx.handlers}
    >
      <div
        aria-hidden={hasChildren || undefined}
        style={{
          position: "absolute",
          inset: 0,
          zIndex: -1,
          overflow: "hidden",
          borderRadius: "inherit",
        }}
      >
        {scene}
      </div>
      <Children node={node} project={project} editor={editor} />
    </div>
  );
}

function FormNode({
  node,
  style,
  project,
  editor,
}: {
  node: ElementNode;
  style: CSSProperties;
  project: Project;
  editor?: EditorWiring;
}) {
  const fx = useNodeFx(node, editor);
  const env = useRenderEnv();
  const [status, setStatus] = useState<"idle" | "sending" | "error" | "done">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    const action = node.props.action ?? { kind: "none" as const };
    if (action.kind === "none" && !editor) e.preventDefault();
    if (editor) return; // canvas: let the browser validate visually, don't act
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());

    if (action.kind === "submit-api") {
      e.preventDefault();
      setStatus("sending");
      setMessage(null);
      // Honest API action: emit the real request, surface the real result.
      fetch(action.url, {
        method: action.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
        .then((res) => {
          if (!res.ok) throw new Error(`Request failed with status ${res.status}`);
          setStatus("done");
          setMessage("Request succeeded.");
          form.reset();
        })
        .catch((err: Error) => {
          setStatus("error");
          setMessage(err.message || "Request failed.");
        });
      return;
    }
    if (action.kind === "navigate") {
      e.preventDefault();
      env.navigate(action.path);
      return;
    }
    if (action.kind === "none") {
      e.preventDefault();
      setStatus("done");
      setMessage("Submitted (no action configured).");
    }
  };

  return (
    <form ref={fx.setRef as React.Ref<HTMLFormElement>} data-fe-node={node.id} style={{ ...style, ...fx.fxStyle }} {...fx.handlers} onSubmit={onSubmit} noValidate>
      {/* Children know they are in a form, so a button submits it. */}
      <InFormContext.Provider value={true}>
        <Children node={node} project={project} editor={editor} />
      </InFormContext.Provider>
      {message && (
        <div style={{ fontSize: 13, marginTop: 4, color: status === "error" ? "#f87171" : "var(--fe-primary)" }}>
          {message}
        </div>
      )}
    </form>
  );
}

/* ---------------- text ---------------- */

function TextNode({
  node,
  style,
  editor,
}: {
  node: ElementNode;
  style: CSSProperties;
  editor?: EditorWiring;
}) {
  const fx = useNodeFx(node, editor);
  const env = useRenderEnv();
  const isCanvas = env.mode === "canvas" && !!editor;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(node.props.text ?? "");
  const setProp = useEditor((s) => s.setProp);
  const Tag = (node.type === "heading" ? `h${node.props.level ?? 2}` : "p") as
    | "h1"
    | "h2"
    | "h3"
    | "h4"
    | "h5"
    | "h6"
    | "p";

  const commit = () => {
    setEditing(false);
    if (draft !== (node.props.text ?? "")) setProp(node.id, "text", draft);
  };

  // Canvas: double-click enters inline edit; the inner element carries
  // contentEditable while selection/pointer handlers stay on the wrapper.
  const inner = isCanvas && editing;
  return (
    <Tag
      ref={fx.setRef as React.Ref<HTMLHeadingElement>}
      data-fe-node={node.id}
      style={{ ...style, ...fx.fxStyle }}
      {...(inner ? {} : fx.handlers)}
      onDoubleClick={
        isCanvas
          ? (e: React.MouseEvent) => {
              e.stopPropagation();
              setDraft(node.props.text ?? "");
              setEditing(true);
            }
          : (fx.handlers.onDoubleClick as React.MouseEventHandler | undefined)
      }
      contentEditable={inner || undefined}
      suppressContentEditableWarning
      onBlur={inner ? commit : undefined}
      onKeyDown={(e) => {
        if (!inner) return;
        if (e.key === "Escape") {
          setEditing(false);
          setDraft(node.props.text ?? "");
        }
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          (e.target as HTMLElement).blur();
        }
        e.stopPropagation();
      }}
      onInput={inner ? (e) => setDraft((e.target as HTMLElement).textContent ?? "") : undefined}
    >
      {inner ? draft : (node.props.text ?? "")}
    </Tag>
  );
}

/* ---------------- leaves ---------------- */

function LeafNode({
  node,
  style,
  editor,
}: {
  node: ElementNode;
  style: CSSProperties;
  editor?: EditorWiring;
}) {
  const fx = useNodeFx(node, editor);
  const env = useRenderEnv();
  const inForm = useInForm();
  const isCanvas = env.mode === "canvas" && !!editor;
  const interaction = useInteraction(node); // canvas mode keeps inner controls inert via href/onClick guards
  const asset = node.props.assetId ? env.assets[node.props.assetId] : undefined;
  const interactive = ["button", "link", "input", "select", "checkbox"].includes(node.type);

  let content: ReactNode = null;

  switch (node.type) {
    case "image":
    case "gif": {
      const url = assetUrl(asset);
      content = url ? (
        <img
          src={url}
          alt={node.props.alt ?? ""}
          // In the canvas the element is moved with the pointer drag above; a
          // native image drag would steal the gesture and drop a duplicate.
          draggable={isCanvas ? false : undefined}
          style={{ display: "block", width: "100%", height: "100%", objectFit: style.objectFit ?? "cover", objectPosition: style.objectPosition, borderRadius: style.borderRadius }}
        />
      ) : (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--fe-surface)",
            border: "1px dashed var(--fe-border)",
            color: "var(--fe-muted)",
            fontSize: 13,
            width: "100%",
            minHeight: 180,
            borderRadius: style.borderRadius,
          }}
        >
          Image
        </div>
      );
      break;
    }
    case "video": {
      const url = assetUrl(asset);
      content = url ? (
        <video
          src={url}
          draggable={isCanvas ? false : undefined}
          controls={node.props.controls ?? true}
          autoPlay={node.props.autoplay ?? false}
          loop={node.props.loop ?? false}
          muted={node.props.muted ?? true}
          playsInline
          style={{ display: "block", width: "100%", height: "100%", objectFit: style.objectFit ?? "cover", borderRadius: style.borderRadius }}
        />
      ) : (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--fe-surface)",
            border: "1px dashed var(--fe-border)",
            color: "var(--fe-muted)",
            fontSize: 13,
            width: "100%",
            minHeight: 220,
            borderRadius: style.borderRadius,
          }}
        >
          Video
        </div>
      );
      break;
    }
    case "icon": {
      const px = style.width && typeof style.width === "number" ? Number(style.width) : 24;
      content = (
        <svg
          width={Number.isFinite(px) ? px : 24}
          height={Number.isFinite(px) ? px : 24}
          viewBox="0 0 24 24"
          fill="none"
          stroke={(style.color as string) ?? "currentColor"}
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d={iconPath(node.props.icon)} />
        </svg>
      );
      break;
    }
    case "logo": {
      const size = style.width && typeof style.width === "number" ? Number(style.width) : 28;
      content = (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <rect x="2" y="2" width="20" height="20" rx={6} fill="var(--fe-primary)" />
            <path d="M7 17V7l10 10V7" stroke="var(--fe-primary-contrast)" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {node.props.label ? (
            <span style={{ fontSize: 17, fontWeight: 700, color: "var(--fe-text)" }}>{node.props.label}</span>
          ) : null}
        </span>
      );
      break;
    }
    case "button": {
      const variant = node.props.variant ?? "primary";
      const palette: Record<string, CSSProperties> = {
        primary: { background: "var(--fe-primary)", color: "var(--fe-primary-contrast)" },
        secondary: { background: "var(--fe-surface)", color: "var(--fe-text)" },
        ghost: { background: "transparent", color: "var(--fe-primary)" },
        outline: { background: "transparent", color: "var(--fe-text)", border: "1px solid var(--fe-border)" },
      };
      content = (
        <button
          // Inside a form a button submits it (canvas mode ignores the action).
          type={inForm ? "submit" : "button"}
          {...interaction}
          style={{
            fontFamily: "inherit",
            border: variant === "outline" ? "1px solid var(--fe-border)" : "none",
            borderRadius: "var(--fe-radius)",
            ...palette[variant],
            ...style,
          }}
        >
          {node.props.label ?? "Button"}
        </button>
      );
      break;
    }
    case "link": {
      const href = node.props.href ?? "#";
      content =
        onClickIsNavigate(node) && env.mode === "preview" ? (
          <a href={href} onClick={interaction.onClick as React.MouseEventHandler} style={{ color: "var(--fe-primary)", textDecoration: "none", ...style }}>
            {node.props.label ?? "Link"}
          </a>
        ) : (
          <a
            href={isCanvas ? undefined : href}
            onClick={isCanvas ? undefined : (interaction.onClick as React.MouseEventHandler)}
            draggable={isCanvas ? false : undefined}
            style={{ color: "var(--fe-primary)", textDecoration: "none", ...style }}
          >
            {node.props.label ?? "Link"}
          </a>
        );
      break;
    }
    case "input": {
      content = (
        <input
          type={node.props.inputType ?? "text"}
          placeholder={node.props.placeholder ?? ""}
          required={node.props.required ?? false}
          name={slug(node.props.label) || "field"}
          style={{ ...style, outline: "none", border: "1px solid var(--fe-border)", fontFamily: "inherit" }}
        />
      );
      break;
    }
    case "select": {
      content = (
        <select name={slug(node.props.label) || "field"} style={{ ...style, border: "1px solid var(--fe-border)", fontFamily: "inherit" }}>
          {(node.props.options ?? []).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );
      break;
    }
    case "checkbox": {
      content = (
        <label style={{ ...style, display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
          <input type="checkbox" name={slug(node.props.label) || "field"} style={{ accentColor: "var(--fe-primary)" }} />
          {node.props.label ?? "Checkbox"}
        </label>
      );
      break;
    }
    case "divider": {
      content = null;
      break;
    }
    default:
      content = null;
  }

  return (
    <div
      ref={fx.setRef}
      data-fe-node={node.id}
      style={{ ...style, ...fx.fxStyle }}
      {...(editor && interactive
        ? {
            // Interactive leaves: the outer wrapper handles select/hover; the
            // inner control stays inert in the canvas so clicks never navigate.
            onClick: fx.handlers.onClick,
            onMouseOver: fx.handlers.onMouseOver,
            onMouseOut: fx.handlers.onMouseOut,
          }
        : fx.handlers)}
    >
      {content}
    </div>
  );
}

function onClickIsNavigate(node: ElementNode): boolean {
  return node.onClick?.kind === "navigate";
}

function slug(text: string | undefined): string {
  if (!text) return "";
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
