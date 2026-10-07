import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Breakpoint } from "@/schemas/types";
import { useEditor } from "@/lib/store";
import { PageView } from "./PageView";
import { themeVars } from "@/lib/styles";
import { EditorIcon, FrontelLogo } from "@/lib/editorIcons.tsx";
import { VIEWPORT_WIDTH, viewportLabel } from "@/lib/viewport";

/**
 * Preview renders the real page tree at the widths the canvas uses, so what you
 * built is what you see. Desktop defaults to the design width and can be shown
 * at the full window width instead ("fit window") — the honest way to check how
 * a design behaves on a wider screen, without it being the default surprise.
 *
 * The width readout exists because a preview only ever tells the truth about
 * the width it is rendered at: 1280 in the canvas and the window in a browser
 * are two different pages for anything with a pixel size.
 */
export function Preview({ onExit }: { onExit: () => void }) {
  const project = useEditor((s) => s.getProject());
  const [pagePath, setPagePath] = useState<string>("/");
  const [bp, setBp] = useState<Breakpoint>("desktop");
  /** Desktop only: design width (default) or whatever the window is. */
  const [fitWindow, setFitWindow] = useState(false);

  const page = useMemo(
    () =>
      project?.pages.find((p) => p.path === pagePath) ??
      project?.pages.find((p) => p.path === "/") ??
      project?.pages[0],
    [project, pagePath],
  );

  const fluid = bp === "desktop" && fitWindow;
  const width = fluid ? null : VIEWPORT_WIDTH[bp];

  /** Rendered artboard width — measures the truth, including a clamped window. */
  const boardRef = useRef<HTMLDivElement>(null);
  const [boardWidth, setBoardWidth] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const measure = () => setBoardWidth(Math.round(el.getBoundingClientRect().width));
    measure();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [width, bp, page?.id]);

  if (!project || !page) return null;

  return (
    <div className="flex h-full flex-col bg-ink-950">
      {/* Slim preview toolbar */}
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-ink-700/60 bg-ink-900 px-3">
        <button
          className="flex items-center gap-2 rounded px-2 py-1 text-[12px] text-ink-300 transition-colors hover:bg-ink-800"
          onClick={onExit}
          title="Back to the editor"
        >
          <FrontelLogo size={14} />
          Editor
        </button>
        <div className="mx-1 h-4 w-px bg-ink-700" />
        <div className="flex gap-1" role="group" aria-label="Preview width">
          {(["desktop", "tablet", "mobile"] as const).map((b) => (
            <button
              key={b}
              aria-pressed={bp === b}
              title={viewportLabel(b)}
              className={`rounded px-2 py-1 text-[11px] capitalize ${
                bp === b ? "bg-accent-600/20 text-accent-400" : "text-ink-400 hover:text-ink-200"
              }`}
              onClick={() => setBp(b)}
            >
              {b}
            </button>
          ))}
        </div>
        <span className="ml-2 font-mono text-[11px] text-ink-500">{page.path}</span>
        <div className="flex-1" />
        <span
          className="font-mono text-[11px] text-ink-500"
          aria-live="polite"
          title={
            fluid
              ? "Rendered at the window width — pixel-sized boxes keep their size here"
              : `Rendered at the ${bp} design width the canvas uses`
          }
        >
          {boardWidth ?? width ?? 0}px
        </span>
        {bp === "desktop" && (
          <button
            aria-pressed={fitWindow}
            onClick={() => setFitWindow((v) => !v)}
            title={
              fitWindow
                ? `Fit window on — preview at the full window width. Turn it off to see the ${VIEWPORT_WIDTH.desktop} design width the canvas uses.`
                : "Fit window off — previewing at the design width, same as the canvas"
            }
            className={`inline-flex items-center gap-1.5 rounded px-2 py-1 text-[11px] transition-colors ${
              fitWindow
                ? "bg-accent-600/20 text-accent-400"
                : "text-ink-400 hover:bg-ink-800 hover:text-ink-200"
            }`}
          >
            <EditorIcon name="monitor" size={11} />
            fit window
          </button>
        )}
        <div className="mx-1 h-4 w-px bg-ink-700" />
        <span className="flex items-center gap-1.5 text-[11px] text-ink-500">
          <EditorIcon name="play" size={10} className="text-accent-500/70" />
          Live preview — interactions enabled
        </span>
      </div>

      {/* The site itself, drawn as the same artboard the canvas draws. */}
      <div className="min-h-0 flex-1 overflow-auto bg-ink-950">
        <div
          ref={boardRef}
          className={`mx-auto min-h-full bg-white ${
            fluid ? "" : "rounded-lg border border-ink-600 shadow-[0_0_60px_rgba(0,0,0,0.5)]"
          }`}
          style={width ? { width, maxWidth: "100%" } : undefined}
        >
          <div className="min-h-full" style={themeVars(project.theme) as React.CSSProperties}>
            <PageView
              project={project}
              page={page}
              breakpoint={bp}
              navigate={(path) => {
                if (project.pages.some((p) => p.path === path)) setPagePath(path);
                else setPagePath(path); // 404-ish: unknown paths fall back below
              }}
              currentPath={pagePath}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
