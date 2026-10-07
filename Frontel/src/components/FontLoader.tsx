/**
 * Loads the webfonts a project actually uses into the editor document.
 *
 * The export gets real <link> tags in index.html (see the generator); the
 * editor needs the same faces, so this mounts the identical stylesheet for the
 * live canvas and the preview. Links are keyed by href so switching projects
 * reuses them, and fonts already loaded by the app shell are left alone.
 */
import { useEffect } from "react";
import type { Project } from "@/schemas/types";
import { fontsUsedBy, googleFontsHref } from "@/schemas/fonts";

const ATTR = "data-fe-font";

function useProjectFonts(project: Project) {
  const href = googleFontsHref(fontsUsedBy(project));
  const ids = fontsUsedBy(project).join(",");

  useEffect(() => {
    if (!href) return;
    const doc = document;
    const existing = doc.head.querySelector<HTMLLinkElement>(`link[${ATTR}="${href}"]`);
    if (existing) return;
    // The editor shell already ships Inter + JetBrains Mono; other families
    // are fetched on demand.
    const link = doc.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.setAttribute(ATTR, href);
    doc.head.appendChild(link);
    return () => {
      // Keep the sheet for the session — a project switch usually wants it back.
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [href, ids]);
}

/** Renders nothing; exists so any tree can opt into the project's fonts. */
export function ProjectFonts({ project }: { project: Project }) {
  useProjectFonts(project);
  return null;
}
