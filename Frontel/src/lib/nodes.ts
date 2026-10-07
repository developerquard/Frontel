import type { ElementNode, NodeId, Page, Project } from "@/schemas/types";
import { findParentId } from "./tree";

/** Every node that is not a child of another node on the same page. */
export function pageRootNodes(
  project: Project,
  page: Page,
): ElementNode[] {
  const roots: ElementNode[] = [];
  const walk = (id: NodeId, isRoot: boolean) => {
    const node = project.nodes[id];
    if (!node) return;
    if (isRoot) roots.push(node);
    node.children.forEach((c) => walk(c, false));
  };
  walk(page.rootId, true);
  return roots;
}

/** All elements belonging to a page (root's children + descendants). */
export function pageNodes(project: Project, page: Page): ElementNode[] {
  const out: ElementNode[] = [];
  const walk = (id: NodeId) => {
    const node = project.nodes[id];
    if (!node) return;
    if (id !== page.rootId) out.push(node);
    node.children.forEach(walk);
  };
  walk(page.rootId);
  return out;
}

/** Direct children of a page root (the components of the generated page). */
export function pageTopLevelNodes(project: Project, page: Page): ElementNode[] {
  return page.rootId in project.nodes
    ? project.nodes[page.rootId].children
        .map((id) => project.nodes[id])
        .filter(Boolean)
    : [];
}

/** Anchor targets available on a page (for scroll-to interactions). */
export function pageAnchors(
  project: Project,
  page: Page,
): { id: NodeId; name: string; anchorId: string }[] {
  return pageTopLevelNodes(project, page)
    .filter((n) => n.anchorId)
    .map((n) => ({ id: n.id, name: n.name, anchorId: n.anchorId as string }));
}

/** Is `node` a page root? */
export function isPageRoot(page: Page, node: ElementNode): boolean {
  return node.id === page.rootId;
}

/** Depth of a node within its page (root's children are depth 0). */
export function nodeDepth(
  project: Project,
  page: Page,
  id: NodeId,
): number {
  let depth = -1;
  let cur: NodeId | null = id;
  while (cur && cur !== page.rootId) {
    cur = findParentId(project.nodes, cur);
    depth += 1;
    if (depth > 64) break;
  }
  return depth;
}
