import type { ElementNode, NodeId, StyleProps } from "@/schemas/types";

export function findParentId(
  nodes: Record<NodeId, ElementNode>,
  id: NodeId,
): NodeId | null {
  for (const node of Object.values(nodes)) {
    if (node.children.includes(id)) return node.id;
  }
  return null;
}

export function subtreeIds(
  nodes: Record<NodeId, ElementNode>,
  rootId: NodeId,
): NodeId[] {
  const out: NodeId[] = [];
  const walk = (id: NodeId) => {
    out.push(id);
    const node = nodes[id];
    if (node) node.children.forEach(walk);
  };
  walk(rootId);
  return out;
}

/** Removes a node id from its parent's children list (if any). Returns new nodes map. */
export function detachNode(
  nodes: Record<NodeId, ElementNode>,
  id: NodeId,
): Record<NodeId, ElementNode> {
  const parentId = findParentId(nodes, id);
  if (!parentId) return nodes;
  const parent = nodes[parentId];
  return {
    ...nodes,
    [parentId]: { ...parent, children: parent.children.filter((c) => c !== id) },
  };
}

/** Inserts `id` into `parentId`'s children at `index` (clamped). */
export function insertIntoParent(
  nodes: Record<NodeId, ElementNode>,
  parentId: NodeId,
  id: NodeId,
  index: number,
): Record<NodeId, ElementNode> {
  const parent = nodes[parentId];
  if (!parent) return nodes;
  const children = [...parent.children];
  const i = Math.max(0, Math.min(index, children.length));
  children.splice(i, 0, id);
  return { ...nodes, [parentId]: { ...parent, children } };
}

export function moveWithinParent(
  nodes: Record<NodeId, ElementNode>,
  parentId: NodeId,
  from: number,
  to: number,
): Record<NodeId, ElementNode> {
  const parent = nodes[parentId];
  if (!parent) return nodes;
  const children = [...parent.children];
  const [moved] = children.splice(from, 1);
  if (!moved) return nodes;
  // After removing `from`, all later indices shift down by one — inserting at
  // the ORIGINAL index `to` lands the item exactly where intended.
  children.splice(to, 0, moved);
  return { ...nodes, [parentId]: { ...parent, children } };
}

/** Deep-clones a subtree under new ids. Returns cloned nodes keyed by id + new root id. */
export function cloneSubtree(
  nodes: Record<NodeId, ElementNode>,
  rootId: NodeId,
  makeId: () => string,
): { cloned: Record<NodeId, ElementNode>; newRootId: NodeId } {
  const cloned: Record<NodeId, ElementNode> = {};
  const walk = (id: NodeId): NodeId => {
    const node = nodes[id];
    const newId = makeId();
    const children = node.children.map(walk);
    cloned[newId] = { ...structuredClone(node), id: newId, children };
    return newId;
  };
  const newRootId = walk(rootId);
  return { cloned, newRootId };
}

/** Drops a subtree from the nodes map. */
export function removeSubtree(
  nodes: Record<NodeId, ElementNode>,
  rootId: NodeId,
): Record<NodeId, ElementNode> {
  const ids = subtreeIds(nodes, rootId);
  const next = { ...nodes };
  for (const id of ids) delete next[id];
  return next;
}

/** Collects every animation spec in the project (used by the animation report). */
export function collectAnimations(
  nodes: Record<NodeId, ElementNode>,
): { id: NodeId; name: string }[] {
  return Object.values(nodes)
    .filter((n) => n.animation)
    .map((n) => ({ id: n.id, name: n.name }));
}

/** Effective style override for a breakpoint chain (mobile > tablet > base). */
export function mergeStyle(
  base: StyleProps,
  tablet: StyleProps | undefined,
  mobile: StyleProps | undefined,
  bp: "desktop" | "tablet" | "mobile",
): StyleProps {
  if (bp === "desktop") return base;
  if (bp === "tablet") return { ...base, ...tablet };
  return { ...base, ...tablet, ...mobile };
}
