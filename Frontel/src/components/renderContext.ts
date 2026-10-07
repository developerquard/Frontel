import { createContext, useContext } from "react";
import type { Asset, Breakpoint, Page } from "@/schemas/types";

export type RenderMode = "canvas" | "preview";

export interface RenderEnv {
  mode: RenderMode;
  /** Viewport breakpoint used to merge responsive style overrides. */
  breakpoint: Breakpoint;
  /** All project assets (assetId → asset). */
  assets: Record<string, Asset>;
  /** All pages (for navigate interactions). */
  pages: Page[];
  /** Navigate to an internal page path (preview mode). */
  navigate: (path: string) => void;
  /** Current page path (preview mode). */
  currentPath?: string;
}

export const RenderEnvContext = createContext<RenderEnv>({
  mode: "preview",
  breakpoint: "desktop",
  assets: {},
  pages: [],
  navigate: () => {},
});

export function useRenderEnv(): RenderEnv {
  return useContext(RenderEnvContext);
}

export function assetUrl(asset: Asset | undefined): string | undefined {
  if (!asset) return undefined;
  return asset.blobUrl ?? asset.src;
}

/**
 * True inside a <form> subtree, where a button is a submit button.
 *
 * Without this a button is always `type="button"`, so nothing submits its form:
 * browsers refuse implicit submission when a form has more than one field, which
 * made every multi-field Frontel form impossible to send.
 */
export const InFormContext = createContext(false);

export function useInForm(): boolean {
  return useContext(InFormContext);
}
