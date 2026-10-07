/**
 * Layer-aware style access for Inspector controls.
 *
 * Every style edit lands on the active responsive layer (desktop = base), so
 * the same control works at every breakpoint. Shared by the Inspector and the
 * style galleries so both edit exactly the same way.
 */
import type { StyleProps } from "@/schemas/types";
import { useEditor } from "@/lib/store";

export type StyleLayer = "base" | "tablet" | "mobile";

export function useStyleApi(id: string): {
  layer: StyleLayer;
  style: StyleProps;
  set: (patch: Partial<StyleProps>) => void;
  hasOverride: boolean;
} {
  const viewport = useEditor((s) => s.viewport);
  const node = useEditor((s) => s.getProject()?.nodes[id]);
  const setStyle = useEditor((s) => s.setStyle);
  const layer: StyleLayer = viewport === "desktop" ? "base" : viewport;
  const style = node
    ? layer === "base"
      ? node.style.base
      : node.style[layer] ?? {}
    : {};
  const hasOverride = layer !== "base" && !!node && Object.keys(node.style[layer] ?? {}).length > 0;
  return {
    layer,
    style,
    hasOverride,
    set: (patch) => setStyle(id, layer, patch),
  };
}

/** The layer a brand-new style edit would land on. */
export function useActiveLayer(): StyleLayer {
  const viewport = useEditor((s) => s.viewport);
  return viewport === "desktop" ? "base" : viewport;
}
