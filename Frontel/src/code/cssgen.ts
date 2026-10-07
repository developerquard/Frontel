/**
 * CSS generation — mirrors the live renderer's inline styles.
 *
 * Declarations come from the SAME styleToCss() the renderer uses, so the
 * generated stylesheet and the editor canvas cannot drift apart.
 */
import type { CSSProperties } from "react";
import type { ElementNode, Project, StyleProps } from "@/schemas/types";
import { styleToCss } from "@/lib/styles";
import { easingCss, hoverCssDecl, hoverTransition, isHoverFx, isReveal } from "./shared";
import { slug } from "./shared";

export function camelToKebab(s: string): string {
  return s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

/** React CSSProperties object → real CSS declaration text. */
export function cssBlock(css: CSSProperties, indent = "  "): string {
  return Object.entries(css)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${indent}${camelToKebab(k)}: ${String(v)};`)
    .join("\n");
}

/** Assigns a unique, readable class name per node across the project. */
export function buildClassMap(
  project: Project,
): Map<string, string> {
  const taken = new Set<string>();
  const map = new Map<string, string>();
  for (const page of project.pages) {
    const walk = (id: string) => {
      const node = project.nodes[id];
      if (!node) return;
      if (id !== page.rootId) {
        const base = slug(node.name) || "el";
        let name = base;
        let i = 2;
        while (taken.has(name)) name = `${base}-${i++}`;
        taken.add(name);
        map.set(node.id, name);
      }
      node.children.forEach(walk);
    };
    walk(page.rootId);
  }
  return map;
}

const MEDIA = { tablet: 768, mobile: 480 };

/** Hidden-state declarations for a reveal animation. */
function revealHiddenDecls(anim: { type: string }): Record<string, string> {
  switch (anim.type) {
    case "fade":
      return { opacity: "0" };
    case "fade-up":
      return { opacity: "0", transform: "translateY(28px)" };
    case "fade-down":
      return { opacity: "0", transform: "translateY(-28px)" };
    case "slide-left":
      return { opacity: "0", transform: "translateX(48px)" };
    case "slide-right":
      return { opacity: "0", transform: "translateX(-48px)" };
    case "zoom-in":
      return { opacity: "0", transform: "scale(0.92)" };
    default:
      return {};
  }
}

export function generateCss(project: Project, classMap: Map<string, string>): string {
  const baseRules: string[] = [];
  const tabletRules: string[] = [];
  const mobileRules: string[] = [];
  const hoverRules: string[] = [];
  const revealVisible: string[] = [];

  /**
   * Renderer-side inline chrome (button variants, control borders, link
   * colors) must also exist in generated CSS — declared BEFORE the node's
   * own styles so user styles win, mirroring the renderer's {...palette, ...style}.
   */
  const chromeDecls = (node: ElementNode): string[] => {
    switch (node.type) {
      case "button": {
        const v = node.props.variant ?? "primary";
        const out: Record<string, string> = { "font-family": "inherit", border: "none" };
        if (v === "primary") {
          out.background = "var(--fe-primary)";
          out.color = "var(--fe-primary-contrast)";
        } else if (v === "secondary") {
          out.background = "var(--fe-surface)";
          out.color = "var(--fe-text)";
        } else if (v === "ghost") {
          out.background = "transparent";
          out.color = "var(--fe-primary)";
        } else {
          out.background = "transparent";
          out.color = "var(--fe-text)";
          out.border = "1px solid var(--fe-border)";
        }
        return Object.entries(out).map(([k, val]) => `  ${k}: ${val};`);
      }
      case "link":
        return ["  color: var(--fe-primary);", "  text-decoration: none;"];
      case "input":
      case "select":
        return ["  outline: none;", "  border: 1px solid var(--fe-border);", "  font-family: inherit;"];
      case "scene3d":
        // A scene is a backdrop: the box anchors positioned children and its
        // own isolated stacking context keeps the scene layer behind them.
        return ["  position: relative;", "  isolation: isolate;"];
      default:
        return [];
    }
  };

  const pushNode = (node: ElementNode) => {
    const cls = classMap.get(node.id);
    if (!cls) return;

    const decls: string[] = [];
    const emit = (style: StyleProps): string => cssBlock(styleToCss(style, project.theme));

    decls.push(...chromeDecls(node));
    decls.push(emit(node.style.base));
    if (node.style.tablet && Object.keys(node.style.tablet).length) {
      tabletRules.push(`  .${cls} {\n${emit({ ...node.style.base, ...node.style.tablet })}\n  }`);
    }
    if (node.style.mobile && Object.keys(node.style.mobile).length) {
      mobileRules.push(`  .${cls} {\n${emit({ ...node.style.base, ...node.style.tablet, ...node.style.mobile })}\n  }`);
    }

    const anim = node.animation;
    if (anim && isReveal(anim)) {
      const hidden = revealHiddenDecls(anim);
      for (const [k, v] of Object.entries(hidden)) decls.push(`  ${camelToKebab(k)}: ${v};`);
      decls.push(
        `  transition: opacity ${anim.duration}ms ${easingCss(anim.easing)} ${anim.delay}ms, transform ${anim.duration}ms ${easingCss(anim.easing)} ${anim.delay}ms;`,
      );
      revealVisible.push(
        `  .${cls}.is-visible {\n    opacity: 1;\n    transform: none;\n  }`,
      );
    }
    if (anim && isHoverFx(anim)) {
      decls.push(
        `  transition: ${hoverTransition(anim.type)} ${anim.duration}ms ${easingCss(anim.easing)};`,
      );
      hoverRules.push(`.${cls}:hover {\n  ${hoverCssDecl(anim.type, anim.colors)}\n}`);
    }

    const body = decls.filter((d) => d.trim()).join("\n");
    if (body) baseRules.push(`.${cls} {\n${body}\n}`);
  };

  for (const page of project.pages) {
    const walk = (id: string) => {
      const node = project.nodes[id];
      if (!node) return;
      if (id !== page.rootId) pushNode(node);
      node.children.forEach(walk);
    };
    walk(page.rootId);
  }

  const out: string[] = [];
  out.push(
    ":root {\n  --fe-bg: #0c0e13;\n  /* theme tokens are injected by the generator from the project theme */\n}",
  );
  out.push(baseRules.join("\n\n"));
  if (tabletRules.length) out.push(`@media (max-width: ${MEDIA.tablet}px) {\n${tabletRules.join("\n")}\n}`);
  if (mobileRules.length) out.push(`@media (max-width: ${MEDIA.mobile}px) {\n${mobileRules.join("\n")}\n}`);
  if (revealVisible.length) out.push(revealVisible.join("\n"));
  if (hoverRules.length) out.push(hoverRules.join("\n"));
  out.push(
    "@media (prefers-reduced-motion: reduce) {\n  *, *::before, *::after {\n    animation-duration: 0.01ms !important;\n    transition-duration: 0.01ms !important;\n  }\n}",
  );
  return out.join("\n\n");
}
