import { useEffect, useRef, useState } from "react";
import { useEditor } from "@/lib/store";
import { downloadProjectJson, parseProjectJson } from "@/lib/exporters";
import { TEMPLATES, TEMPLATE_META } from "@/templates";
import { FrontelLogo } from "@/lib/editorIcons.tsx";
import { Button } from "./ui";

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function Home({ onOpen }: { onOpen: () => void }) {
  const bootstrap = useEditor((s) => s.bootstrap);
  const loaded = useEditor((s) => s.loaded);
  const projects = useEditor((s) => s.projects);
  const createProject = useEditor((s) => s.createProject);
  const openProject = useEditor((s) => s.openProject);
  const renameProject = useEditor((s) => s.renameProject);
  const duplicateProject = useEditor((s) => s.duplicateProject);
  const resetProject = useEditor((s) => s.resetProject);
  const deleteProject = useEditor((s) => s.deleteProject);
  const importProject = useEditor((s) => s.importProject);
  const fileRef = useRef<HTMLInputElement>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  const onImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const project = parseProjectJson(String(reader.result));
        importProject(project);
        onOpen();
      } catch (err) {
        alert(`Import failed: ${err instanceof Error ? err.message : "invalid file"}`);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="h-full overflow-y-auto">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 pt-8">
        <div className="flex items-center gap-2.5">
          <FrontelLogo size={26} />
          <span className="text-xl font-bold tracking-tight text-ink-100">Frontel</span>
        </div>
        <span className="text-[12px] text-ink-500">visual frontend development workspace</span>
      </header>

      <main className="mx-auto max-w-5xl px-6 pb-16">
        <section className="pt-16 pb-12 text-center">
          <h1 className="mx-auto max-w-2xl text-4xl font-extrabold tracking-tight text-ink-100">
            Build visually. <span className="text-accent-500">Preview instantly.</span> Own the code.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-ink-400">
            Construct a real frontend on a freeform visual canvas — drag anything,
            apply 30 cinematic 3D background effects, theme the whole project in one
            click, and export real React + TypeScript.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-[11.5px] text-ink-400">
            <span className="rounded-full border border-ink-600 bg-ink-900 px-3 py-1">30 3D effects · vanta.js + GLSL</span>
            <span className="rounded-full border border-ink-600 bg-ink-900 px-3 py-1">15 theme templates</span>
            <span className="rounded-full border border-ink-600 bg-ink-900 px-3 py-1">full drag &amp; drop canvas</span>
            <span className="rounded-full border border-ink-600 bg-ink-900 px-3 py-1">clean code export</span>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          <button
            onClick={() => {
              createProject("Untitled project");
              onOpen();
            }}
            className="group rounded-xl border border-dashed border-ink-500 bg-ink-900/40 p-6 text-left transition-colors hover:border-accent-500"
          >
            <div className="text-2xl text-accent-500">+</div>
            <div className="mt-3 text-[15px] font-semibold text-ink-100">Start From Scratch</div>
            <div className="mt-1 text-[12.5px] leading-relaxed text-ink-400">
              An empty canvas. Add sections, elements, styles, animations — your call.
            </div>
          </button>

          {TEMPLATE_META.map((meta) => (
            <button
              key={meta.id}
              onClick={() => {
                createProject(meta.name, TEMPLATES[meta.id]());
                onOpen();
              }}
              className="group overflow-hidden rounded-xl border border-ink-600 bg-ink-900/60 text-left transition-colors hover:border-accent-500"
            >
              <div
                className="h-24 w-full"
                style={{
                  background: meta.preview,
                }}
              />
              <div className="p-4">
                <div className="text-[15px] font-semibold text-ink-100">{meta.name}</div>
                <div className="mt-1 text-[12.5px] leading-relaxed text-ink-400">{meta.description}</div>
              </div>
            </button>
          ))}
        </section>

        <section className="mt-14">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[13px] font-semibold uppercase tracking-widest text-ink-400">Your projects</h2>
            <Button variant="ghost" onClick={() => fileRef.current?.click()}>
              Import project…
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onImport(f);
                e.target.value = "";
              }}
            />
          </div>

          {!loaded ? (
            <p className="py-8 text-center text-[13px] text-ink-500">Loading projects…</p>
          ) : projects.length === 0 ? (
            <p className="rounded-xl border border-ink-700/60 bg-ink-900/40 py-10 text-center text-[13px] text-ink-500">
              No projects yet. Start from scratch or pick a template above.
            </p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {projects.map((p) => (
                <div
                  key={p.id}
                  className="group rounded-xl border border-ink-700/60 bg-ink-900/60 p-4 transition-colors hover:border-ink-500"
                >
                  <div className="flex items-start justify-between gap-2">
                    {renaming === p.id ? (
                      <input
                        autoFocus
                        className="fe-field min-w-0 flex-1 rounded border border-accent-600 bg-ink-900 px-1.5 py-1 text-[13px] text-ink-200"
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onBlur={() => {
                          if (draft.trim()) renameProject(p.id, draft.trim());
                          setRenaming(null);
                        }}
                        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                      />
                    ) : (
                      <button
                        className="min-w-0 flex-1 text-left text-[14px] font-semibold text-ink-100 hover:text-accent-400"
                        onClick={() => {
                          openProject(p.id);
                          onOpen();
                        }}
                      >
                        {p.name}
                      </button>
                    )}
                  </div>
                  <div className="mt-1 text-[11.5px] text-ink-500">
                    {p.pages.length} page{p.pages.length === 1 ? "" : "s"} · edited {timeAgo(p.updatedAt)}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button variant="ghost" onClick={() => { openProject(p.id); onOpen(); }}>
                      Open
                    </Button>
                    <Button variant="ghost" onClick={() => { setRenaming(p.id); setDraft(p.name); }}>
                      Rename
                    </Button>
                    <Button variant="ghost" onClick={() => duplicateProject(p.id)}>
                      Duplicate
                    </Button>
                    <Button variant="ghost" onClick={() => downloadProjectJson(p)}>
                      Export
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        if (confirm(`Reset “${p.name}” to an empty project?`)) resetProject(p.id);
                      }}
                    >
                      Reset
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => {
                        if (confirm(`Delete “${p.name}”? This cannot be undone.`)) deleteProject(p.id);
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
