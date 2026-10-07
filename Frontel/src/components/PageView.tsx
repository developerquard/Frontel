import type { CSSProperties } from "react";
import type { Breakpoint, Page, Project } from "@/schemas/types";
import { NodeView, type EditorWiring } from "./NodeView";
import { ProjectFonts } from "./FontLoader";
import { RenderEnvContext } from "./renderContext";
import { themeVars } from "@/lib/styles";

/**
 * PageView renders one page of the project through the same NodeView tree
 * used everywhere. `editorWiring` is passed only in canvas mode.
 */
export function PageView({
  project,
  page,
  breakpoint = "desktop",
  editorWiring,
  navigate,
  currentPath,
}: {
  project: Project;
  page: Page;
  breakpoint?: Breakpoint;
  editorWiring?: EditorWiring;
  /** Called when an interaction navigates (preview mode). */
  navigate?: (path: string) => void;
  currentPath?: string;
}) {
  return (
    <RenderEnvContext.Provider
      value={{
        mode: editorWiring ? "canvas" : "preview",
        breakpoint,
        assets: project.assets,
        pages: project.pages,
        navigate: navigate ?? (() => {}),
        currentPath: currentPath ?? page.path,
      }}
    >
      <ProjectFonts project={project} />
      <div style={themeVars(project.theme) as CSSProperties} data-fe-page={page.path}>
        <NodeView node={project.nodes[page.rootId]} project={project} editor={editorWiring} />
      </div>
    </RenderEnvContext.Provider>
  );
}
