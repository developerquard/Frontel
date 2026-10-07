import { useMemo, useState } from "react";
import { useEditor } from "@/lib/store";
import { generateProjectFiles } from "@/code/generator";
import type { FileMap } from "@/code/generator";

/* ---------------- tiny TS/CSS/HTML highlighter ---------------- */

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const KEYWORDS =
  /\b(import|from|export|default|function|return|const|let|var|if|else|for|of|in|new|await|async|try|catch|throw|type|interface|extends|as|switch|case|break|continue|null|undefined|true|false|void|this)\b/g;

function highlight(code: string, lang: string): string {
  let html = escapeHtml(code);
  if (lang === "css") {
    html = html
      .replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="c">$1</span>')
      .replace(/(--[\w-]+)(\s*:)/g, '<span class="p">$1</span>$2')
      .replace(/([.#][\w-]+)(\s*\{)/g, '<span class="s">$1</span>$2')
      .replace(/(@[\w-]+)/g, '<span class="k">$1</span>');
  } else if (lang === "html") {
    html = html
      .replace(/(&lt;\/?[\w-]+)/g, '<span class="k">$1</span>')
      .replace(/(&quot;[^&]*&quot;|"[^"]*")/g, '<span class="s">$1</span>');
  } else {
    // ts/tsx/json
    html = html
      .replace(/(\/\/[^\n]*)/g, '<span class="c">$1</span>')
      .replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="c">$1</span>')
      .replace(/(&quot;[^&\n]*&quot;|'[^'\n]*'|`[^`]*`)/g, '<span class="s">$1</span>')
      .replace(KEYWORDS, '<span class="k">$1</span>');
  }
  return html;
}

function langOf(path: string): string {
  if (path.endsWith(".css")) return "css";
  if (path.endsWith(".html")) return "html";
  if (path.endsWith(".json")) return "json";
  return "ts";
}

/* ---------------- file tree ---------------- */

interface TreeNode {
  name: string;
  path: string;
  children: TreeNode[];
}

function buildTree(files: string[]): TreeNode {
  const root: TreeNode = { name: "", path: "", children: [] };
  for (const file of [...files].sort()) {
    const parts = file.split("/");
    let cur = root;
    parts.forEach((part, idx) => {
      let next = cur.children.find((c) => c.name === part);
      if (!next) {
        next = { name: part, path: parts.slice(0, idx + 1).join("/"), children: [] };
        cur.children.push(next);
      }
      cur = next;
    });
  }
  const sort = (n: TreeNode) => {
    n.children.sort((a, b) => {
      const aDir = a.children.length > 0;
      const bDir = b.children.length > 0;
      if (aDir !== bDir) return aDir ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    n.children.forEach(sort);
  };
  sort(root);
  return root;
}

function TreeView({
  node,
  depth,
  selected,
  onSelect,
}: {
  node: TreeNode;
  depth: number;
  selected: string;
  onSelect: (p: string) => void;
}) {
  return (
    <>
      {node.children.map((child) => {
        const isDir = child.children.length > 0;
        return (
          <div key={child.path}>
            <button
              className={`flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left text-[12px] ${
                selected === child.path && !isDir
                  ? "bg-accent-600/15 text-accent-400"
                  : isDir
                    ? "text-ink-300"
                    : "text-ink-400 hover:bg-ink-800/60 hover:text-ink-200"
              }`}
              style={{ paddingLeft: 8 + depth * 12 }}
              onClick={() => !isDir && onSelect(child.path)}
            >
              <span className="text-[10px] text-ink-500">{isDir ? "▸" : "·"}</span>
              <span className={isDir ? "font-medium" : "font-mono"}>{child.name}</span>
            </button>
            {isDir && <TreeView node={child} depth={depth + 1} selected={selected} onSelect={onSelect} />}
          </div>
        );
      })}
    </>
  );
}

/* ---------------- panel ---------------- */

export function SourcePanel() {
  const project = useEditor((s) => s.getProject());
  const [selected, setSelected] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Generation must never take the panel down with it: a project the exporter
  // cannot handle should show the reason, not an empty screen.
  const { files, error } = useMemo<{ files: FileMap; error: string | null }>(() => {
    if (!project) return { files: {}, error: null };
    try {
      return { files: generateProjectFiles(project), error: null };
    } catch (err) {
      return { files: {}, error: err instanceof Error ? err.message : String(err) };
    }
  }, [project]);
  const tree = useMemo(() => buildTree(Object.keys(files)), [files]);
  const activePath = selected && files[selected] !== undefined ? selected : Object.keys(files).find((f) => f === "src/App.tsx") ?? Object.keys(files)[0];
  const content = activePath ? files[activePath] : "";
  const isBinary = content?.startsWith("base64:");

  const copy = async () => {
    if (!activePath || isBinary) return;
    try {
      await navigator.clipboard.writeText(files[activePath]);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="flex min-h-0 flex-1">
      <div className="w-60 shrink-0 overflow-y-auto border-r border-ink-700/60 bg-ink-900/50 py-2">
        <div className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-widest text-ink-500">
          Generated Files
        </div>
        <TreeView node={tree} depth={0} selected={activePath ?? ""} onSelect={setSelected} />
      </div>
      <div className="relative flex min-w-0 flex-1 flex-col">
        <div className="flex h-9 shrink-0 items-center justify-between border-b border-ink-700/60 px-3">
          <span className="font-mono text-[12px] text-ink-300">{activePath}</span>
          <button
            className="rounded px-2 py-0.5 text-[11px] text-ink-400 hover:bg-ink-800 hover:text-accent-400"
            onClick={copy}
          >
            {copied ? "Copied ✓" : "Copy"}
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto bg-ink-950 p-4">
          {error ? (
            <div className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-[12px] text-red-300">
              Could not generate this project&apos;s code: {error}
            </div>
          ) : isBinary ? (
            <p className="text-[12px] text-ink-500">Binary asset — included in export.</p>
          ) : (
            <pre className="fe-code font-mono text-[12.5px] leading-relaxed text-ink-200">
              <code dangerouslySetInnerHTML={{ __html: highlight(content ?? "", activePath ? langOf(activePath) : "ts") }} />
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
