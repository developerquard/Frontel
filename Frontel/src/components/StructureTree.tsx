import { useRef, useState } from "react";
import type { ElementNode, NodeId, Project } from "@/schemas/types";
import { ELEMENT_DEFS } from "@/schemas/registry";
import { useEditor } from "@/lib/store";
import { findParentId } from "@/lib/tree";
import { EditorIcon } from "@/lib/editorIcons.tsx";

/** Type → icon shown in tree rows. */
const TYPE_ICON: Record<string, string> = {
  section: "section",
  container: "box",
  flex: "layout",
  grid: "grid",
  stack: "layers",
  heading: "type",
  text: "type",
  image: "image",
  gif: "image",
  video: "play",
  icon: "sparkle",
  logo: "sparkle",
  button: "cursor",
  link: "link",
  input: "type",
  select: "type",
  checkbox: "check",
  form: "mail",
  divider: "minus",
  scene3d: "box",
};

function typeLabel(node: ElementNode): string {
  if (node.type === "section" && node.anchorId) return "Section ⚓";
  return ELEMENT_DEFS[node.type].label;
}

function TreeItem({
  node,
  depth,
  rootId,
  project,
  collapsed,
  toggleCollapse,
}: {
  node: ElementNode;
  depth: number;
  rootId: NodeId;
  project: Project;
  collapsed: Set<NodeId>;
  toggleCollapse: (id: NodeId) => void;
}) {
  const selectedId = useEditor((s) => s.selectedId);
  const hoveredId = useEditor((s) => s.hoveredId);
  const select = useEditor((s) => s.select);
  const hover = useEditor((s) => s.hover);
  const renameElement = useEditor((s) => s.renameElement);
  const deleteElement = useEditor((s) => s.deleteElement);
  const duplicateElement = useEditor((s) => s.duplicateElement);
  const setDropTarget = useEditor((s) => s.setDropTarget);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(node.name);
  const isRoot = node.id === rootId;
  const isSelected = selectedId === node.id;
  const isHovered = hoveredId === node.id && !isSelected;
  const isContainer = node.children.length > 0 || ELEMENT_DEFS[node.type].hasChildren;
  const isCollapsed = collapsed.has(node.id);
  const hasChildren = node.children.length > 0;
  /** Free-positioned: drags anywhere on the canvas instead of into the flow. */
  const isFree = node.style.base.position === "absolute";

  // Drop indicator for this row: rendered via DropLine lines between rows.
  void 0;

  const handleDragOver = (e: React.DragEvent) => {
    const drag = useEditor.getState().drag;
    if (!drag) return;
    if (drag.kind === "node" && drag.id) {
      // prevent dropping into own subtree
      let p: NodeId | null = node.id;
      while (p) {
        if (p === drag.id) return;
        p = findParentId(project.nodes, p);
      }
    }
    e.preventDefault();
    e.stopPropagation();
    const r = e.currentTarget.getBoundingClientRect();
    const relY = (e.clientY - r.top) / Math.max(1, r.height);
    if (isContainer && relY > 0.25 && relY < 0.75) {
      // drop inside container (append at end)
      setDropTarget({ parentId: node.id, index: node.children.length, mode: "inside", rectKey: `${node.id}:inside` });
    } else {
      const parentId = findParentId(project.nodes, node.id);
      if (!parentId) return;
      const siblings = project.nodes[parentId].children;
      const idx = siblings.indexOf(node.id);
      const before = relY <= 0.5;
      setDropTarget({
        parentId,
        index: before ? idx : idx + 1,
        mode: before ? "before" : "after",
        rectKey: `${parentId}:${before ? idx : idx + 1}`,
      });
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const d = useEditor.getState().drag;
    const t = useEditor.getState().dropTarget;
    setDropTarget(null);
    useEditor.getState().setDrag(null);
    if (!d || !t) return;
    if (d.kind === "new" && d.type) {
      useEditor.getState().addElementAt(d.type, t.parentId, t.index);
    } else if (d.kind === "new" && d.section) {
      if (t.parentId === rootId) useEditor.getState().addSectionAt(d.section, t.index);
    } else if (d.kind === "node" && d.id) {
      useEditor.getState().moveRelative(d.id, t.parentId, t.index);
    }
  };

  return (
    <div>
      {/* insertion line above/below driven by dropTarget on the parent row */}
      <div
        draggable={!isRoot}
        onDragStart={(e) => {
          e.dataTransfer.setData("text/fe-node", node.id);
          useEditor.getState().setDrag({ kind: "node", id: node.id, label: node.name });
        }}
        onDragEnd={() => useEditor.getState().setDrag(null)}
        onDragOver={handleDragOver}
        onDragLeave={(e) => {
          if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) setDropTarget(null);
        }}
        onDrop={handleDrop}
        onClick={() => {
          select(node.id);
          // Bring the box into view: an element above or beside the visible
          // canvas must be reachable, not just selectable.
          document
            .querySelector(`[data-fe-node="${node.id}"]`)
            ?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
        }}
        onMouseOver={(e) => {
          e.stopPropagation();
          hover(node.id);
        }}
        onMouseOut={() => hover(null)}
        className={`group relative flex cursor-pointer items-center gap-1.5 rounded px-1.5 py-1 text-[12.5px] transition-colors ${
          isSelected
            ? "bg-accent-600/15 text-accent-400"
            : isHovered
              ? "bg-ink-700/60 text-ink-200"
              : "text-ink-300 hover:bg-ink-800/60"
        }`}
        style={{ paddingLeft: 6 + depth * 12 }}
        aria-selected={isSelected}
        role="treeitem"
        tabIndex={-1}
      >
        {/* chevron / collapse */}
        {hasChildren ? (
          <button
            className="flex size-4 shrink-0 items-center justify-center rounded text-ink-500 hover:bg-ink-700 hover:text-ink-200"
            title={isCollapsed ? "Expand" : "Collapse"}
            onClick={(e) => {
              e.stopPropagation();
              toggleCollapse(node.id);
            }}
          >
            <EditorIcon
              name="chevronRight"
              size={10}
              className={`transition-transform ${!isCollapsed ? "rotate-90" : ""}`}
            />
          </button>
        ) : (
          <span className="size-4 shrink-0" />
        )}
        <EditorIcon
          name={TYPE_ICON[node.type] ?? "box"}
          size={11}
          className={`shrink-0 ${isSelected ? "text-accent-400" : "text-ink-500"}`}
        />
        {editing ? (
          <input
            autoFocus
            className="fe-field min-w-0 flex-1 rounded border border-accent-600 bg-ink-900 px-1 text-[12.5px] text-ink-200"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              renameElement(node.id, draft.trim() || node.name);
              setEditing(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") setEditing(false);
            }}
          />
        ) : (
          <span
            className="flex-1 truncate"
            title={`${node.name} — double-click to rename`}
            onDoubleClick={(e) => {
              e.stopPropagation();
              setEditing(true);
              setDraft(node.name);
            }}
          >
            {node.name}
          </span>
        )}
        {isFree && (
          <span
            className="shrink-0 rounded bg-ink-700/60 px-1 text-[9px] font-medium uppercase tracking-wide text-accent-500/80"
            title="Free-positioned — drag it anywhere, resize it from any edge"
          >
            free
          </span>
        )}
        <span className="hidden shrink-0 text-[10px] text-ink-500 group-hover:inline">
          {typeLabel(node)}
        </span>
        {!isRoot && (
          <span className="hidden shrink-0 items-center gap-0.5 group-hover:flex">
            <button
              className="flex size-4 items-center justify-center rounded text-ink-500 hover:bg-ink-700 hover:text-accent-400"
              title="Duplicate"
              aria-label={`Duplicate ${node.name}`}
              onClick={(e) => {
                e.stopPropagation();
                duplicateElement(node.id);
              }}
            >
              <EditorIcon name="duplicate" size={10} />
            </button>
            <button
              className="flex size-4 items-center justify-center rounded text-ink-500 hover:bg-ink-700 hover:text-red-400"
              title="Delete"
              aria-label={`Delete ${node.name}`}
              onClick={(e) => {
                e.stopPropagation();
                deleteElement(node.id);
              }}
            >
              <EditorIcon name="x" size={10} />
            </button>
          </span>
        )}
      </div>
      {/* insertion line rendered as a thin accent bar when dropTarget points here */}
      {hasChildren && !isCollapsed &&
        node.children.map((cid) => {
          const child = project.nodes[cid];
          return child ? (
            <div key={cid}>
              <DropLine parentId={node.id} index={node.children.indexOf(cid)} />
              <TreeItem
                node={child}
                depth={depth + 1}
                rootId={rootId}
                project={project}
                collapsed={collapsed}
                toggleCollapse={toggleCollapse}
              />
            </div>
          ) : null;
        })}
      {hasChildren && isCollapsed && (
        <div
          className="ml-6 flex items-center gap-1 py-0.5 pl-1 text-[10.5px] text-ink-600"
          style={{ paddingLeft: 12 + depth * 12 }}
        >
          {node.children.length} hidden
        </div>
      )}
    </div>
  );
}

/** Thin accent line shown between rows while a drag hovers. */
function DropLine({ parentId, index }: { parentId: NodeId; index: number }) {
  const dropTarget = useEditor((s) => s.dropTarget);
  const active =
    dropTarget &&
    dropTarget.parentId === parentId &&
    dropTarget.index === index &&
    dropTarget.mode !== "inside";
  if (!active) return null;
  return <div className="mx-2 h-0.5 rounded bg-accent-500" style={{ marginLeft: 10 }} />;
}

export function StructureTree() {
  const project = useEditor((s) => s.getProject());
  const page = useEditor((s) => s.getPage());
  const activePageId = useEditor((s) => s.activePageId);
  const setActivePage = useEditor((s) => s.setActivePage);
  const addPage = useEditor((s) => s.addPage);
  const deletePage = useEditor((s) => s.deletePage);
  const dropTarget = useEditor((s) => s.dropTarget);
  const setDropTarget = useEditor((s) => s.setDropTarget);
  const [collapsed, setCollapsed] = useState<Set<NodeId>>(new Set());
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [path, setPath] = useState("");
  const treeRef = useRef<HTMLDivElement>(null);
  if (!project || !page) return null;
  const root = project.nodes[page.rootId];
  if (!root) return null;

  const toggleCollapse = (id: NodeId) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex h-9 shrink-0 items-center justify-between border-b border-ink-700/60 px-3">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-ink-400">Structure</span>
          {collapsed.size > 0 && (
            <button
              className="text-[10.5px] text-ink-500 hover:text-accent-400"
              onClick={() => setCollapsed(new Set())}
            >
              expand all
            </button>
          )}
        </div>
        <div
          ref={treeRef}
          className="px-2 py-1.5"
          onDragLeave={(e) => {
            if (!treeRef.current?.contains(e.relatedTarget as Node)) setDropTarget(null);
          }}
          onDrop={(e) => {
            // Dropping on empty tree space: append to page root.
            const d = useEditor.getState().drag;
            if (!d) return;
            e.preventDefault();
            const t = dropTarget ?? { parentId: root.id, index: root.children.length };
            if (d.kind === "new" && d.type) useEditor.getState().addElementAt(d.type, t.parentId, t.index);
            else if (d.kind === "new" && d.section) useEditor.getState().addSectionAt(d.section, t.index);
            else if (d.kind === "node" && d.id) useEditor.getState().moveRelative(d.id, t.parentId, t.index);
            setDropTarget(null);
            useEditor.getState().setDrag(null);
          }}
        >
          <TreeItem
            node={root}
            depth={0}
            rootId={page.rootId}
            project={project}
            collapsed={collapsed}
            toggleCollapse={toggleCollapse}
          />
          {/* bottom drop line for append-at-end */}
          <DropLine parentId={root.id} index={root.children.length} />
        </div>
      </div>

      <div className="border-t border-ink-700/60">
        <div className="flex h-9 shrink-0 items-center justify-between border-b border-ink-700/60 px-3">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-ink-400">Pages</span>
          <button
            className="flex size-5 items-center justify-center rounded text-ink-400 hover:bg-ink-700 hover:text-accent-400"
            title="Add page"
            aria-label="Add page"
            onClick={() => setAdding(true)}
          >
            <EditorIcon name="plus" size={12} />
          </button>
        </div>
        <div className="px-2 py-1.5">
          {project.pages.map((p) => (
            <div
              key={p.id}
              className={`group flex items-center justify-between rounded px-1.5 py-1 text-[12.5px] transition-colors ${
                p.id === activePageId ? "bg-accent-600/10 text-accent-400" : "text-ink-300 hover:bg-ink-800/60"
              }`}
            >
              <button
                className="flex-1 truncate text-left"
                onClick={() => setActivePage(p.id)}
                title={`${p.name} (${p.path})`}
              >
                {p.name} <span className="font-mono text-[10px] text-ink-500">{p.path}</span>
              </button>
              {project.pages.length > 1 && (
                <button
                  className="hidden size-4 items-center justify-center rounded text-ink-500 hover:bg-ink-700 hover:text-red-400 group-hover:flex"
                  title="Delete page"
                  aria-label={`Delete page ${p.name}`}
                  onClick={() => {
                    if (confirm(`Delete page “${p.name}”? Elements on it will be removed.`)) deletePage(p.id);
                  }}
                >
                  <EditorIcon name="x" size={10} />
                </button>
              )}
            </div>
          ))}
          {adding && (
            <div className="mt-1 flex flex-col gap-1 rounded border border-ink-600 bg-ink-850 p-1.5">
              <input
                className="fe-field w-full rounded-md border border-ink-600 bg-ink-900 px-2 py-1.5 text-[13px] text-ink-200"
                value={name}
                placeholder="Page name"
                onChange={(e) => setName(e.target.value)}
                autoFocus
                onKeyDown={(e) => e.key === "Escape" && setAdding(false)}
              />
              <input
                className="fe-field w-full rounded-md border border-ink-600 bg-ink-900 px-2 py-1.5 font-mono text-[13px] text-ink-200"
                value={path}
                placeholder="/path"
                onChange={(e) => setPath(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && name.trim()) {
                    const clean = path.trim();
                    addPage(name.trim(), clean.startsWith("/") ? clean : `/${clean}`);
                    setName("");
                    setPath("");
                    setAdding(false);
                  }
                }}
              />
              <div className="flex gap-1">
                <button
                  className="rounded-md border border-accent-600 bg-accent-600 px-2 py-1 text-[12px] font-semibold text-ink-950 hover:bg-accent-500"
                  onClick={() => {
                    if (!name.trim()) return;
                    const clean = path.trim();
                    addPage(name.trim(), clean.startsWith("/") ? clean : `/${clean}`);
                    setName("");
                    setPath("");
                    setAdding(false);
                  }}
                >
                  Add
                </button>
                <button className="px-2 py-1 text-[12px] text-ink-400 hover:text-ink-200" onClick={() => setAdding(false)}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
