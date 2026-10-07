/**
 * Shared logic between the live renderer and the code generator.
 * These are re-exports on purpose: one implementation, two consumers.
 */
export { easingCss, EASING_CSS, resolveColor } from "@/lib/styles";
export { ICON_PATHS, iconPath } from "@/lib/icons";
export {
  isHoverFx,
  isReveal,
  isScrollFx,
  revealHidden,
  hoverCssDecl,
  hoverTransition,
} from "@/lib/animation";

export function slug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "el"
  );
}

export function pascal(name: string): string {
  const parts = name.replace(/[^a-zA-Z0-9]+/g, " ").trim().split(/\s+/);
  const out = parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join("");
  return /^[A-Za-z]/.test(out) ? out : `Page${out}`;
}
