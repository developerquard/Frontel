import { useMemo, useRef, useState } from "react";
import { useEditor } from "@/lib/store";
import { EditorIcon } from "@/lib/editorIcons.tsx";
import { PanelHeader, Segmented } from "./ui";
import { assetUrl } from "./renderContext";
import type { Asset, AssetKind } from "@/schemas/types";

type AssetFilter = "all" | AssetKind;

const FILTERS: { value: AssetFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "image", label: "Img" },
  { value: "video", label: "Vid" },
  { value: "model", label: "3D" },
  { value: "favicon", label: "Icon" },
];

const KIND_LABEL: Record<AssetKind, string> = {
  image: "Image",
  video: "Video",
  model: "3D model",
  favicon: "Favicon",
  other: "File",
};

const KIND_ICON: Record<AssetKind, string> = {
  image: "image",
  video: "play",
  model: "box",
  favicon: "sparkle",
  other: "page",
};

function AssetCard({ asset, used }: { asset: Asset; used: boolean }) {
  const setDrag = useEditor((s) => s.setDrag);
  const removeAsset = useEditor((s) => s.removeAsset);
  const select = useEditor((s) => s.select);
  const createAtPoint = useEditor((s) => s.createAtPoint);
  const setScene3D = useEditor((s) => s.setScene3D);
  const [confirmDel, setConfirmDel] = useState(false);

  const url = assetUrl(asset);

  /** Places the asset on the canvas as a free box, offset from the corner. */
  const place = () => {
    const state = useEditor.getState();
    if (!state.getPage()) return;
    if (asset.type === "model") {
      const id = createAtPoint("scene3d", { left: 120, top: 120, width: 320, height: 240 });
      if (id) setScene3D(id, { modelAssetId: asset.id });
      select(id);
      return;
    }
    if (asset.type === "video") {
      const id = createAtPoint("video", { left: 120, top: 120, width: 360, height: 240, props: { assetId: asset.id, alt: asset.name, controls: true } });
      select(id);
      return;
    }
    const id = createAtPoint("image", {
      left: 120,
      top: 120,
      width: asset.width && asset.width > 480 ? 480 : asset.width || 280,
      height: asset.width && asset.width > 480 ? Math.round(480 * (asset.height ?? 1) / asset.width) : asset.height || 200,
      props: { assetId: asset.id, alt: asset.name },
    });
    select(id);
  };

  const startDrag = (e: React.DragEvent) => {
    e.dataTransfer.setData("text/fe-asset", asset.id);
    e.dataTransfer.setData("text/fe-new", asset.name);
    e.dataTransfer.effectAllowed = "copy";
    setDrag({ kind: "asset", assetId: asset.id, label: asset.name });
  };

  return (
    <div
      draggable
      onDragStart={startDrag}
      onDragEnd={() => setDrag(null)}
      onDoubleClick={place}
      className="group relative cursor-grab overflow-hidden rounded-md border border-ink-700 bg-ink-850 transition-colors hover:border-accent-700 active:cursor-grabbing"
      title={`${asset.name} — ${KIND_LABEL[asset.type]}${used ? " · in use" : ""} · drag onto the canvas or double-click to place`}
    >
      <div className="flex h-16 items-center justify-center overflow-hidden bg-ink-900">
        {asset.type === "image" || asset.type === "favicon" ? (
          url ? (
            <img src={url} alt={asset.name} className="max-h-16 max-w-full object-contain" draggable={false} />
          ) : (
            <EditorIcon name="image" size={18} className="text-ink-600" />
          )
        ) : asset.type === "video" ? (
          <EditorIcon name="play" size={18} className="text-ink-500" />
        ) : asset.type === "model" ? (
          <EditorIcon name="box" size={18} className="text-ink-500" />
        ) : (
          <EditorIcon name="page" size={18} className="text-ink-600" />
        )}
      </div>
      <div className="flex items-center gap-1 px-1.5 py-1">
        <EditorIcon name={KIND_ICON[asset.type]} size={9} className="shrink-0 text-accent-500/80" />
        <span className="min-w-0 flex-1 truncate text-[10.5px] text-ink-300">{asset.name}</span>
      </div>
      {(asset.width || used) && (
        <div className="absolute left-1 top-1 flex gap-1">
          {used && (
            <span className="rounded bg-ink-800/90 px-1 text-[8.5px] font-semibold uppercase tracking-wide text-accent-400">
              in use
            </span>
          )}
          {asset.width && (
            <span className="rounded bg-ink-800/90 px-1 font-mono text-[8.5px] text-ink-500">
              {asset.width}×{asset.height ?? "?"}
            </span>
          )}
        </div>
      )}
      <button
        className={`absolute right-1 top-1 flex size-4 items-center justify-center rounded bg-ink-900/90 text-ink-500 transition-colors hover:text-red-400 ${confirmDel ? "" : "opacity-0 group-hover:opacity-100"}`}
        title={confirmDel ? "Click again to remove the asset" : "Remove asset"}
        aria-label={`Remove asset ${asset.name}`}
        onClick={(e) => {
          e.stopPropagation();
          if (confirmDel) {
            removeAsset(asset.id);
            setConfirmDel(false);
          } else {
            setConfirmDel(true);
            window.setTimeout(() => setConfirmDel(false), 2000);
          }
        }}
      >
        <EditorIcon name={confirmDel ? "check" : "x"} size={9} />
      </button>
    </div>
  );
}

export function AssetsPanel() {
  const project = useEditor((s) => s.getProject());
  const addAssetFromFile = useEditor((s) => s.addAssetFromFile);
  const [filter, setFilter] = useState<AssetFilter>("all");
  const [busy, setBusy] = useState(0);
  const [dropping, setDropping] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const assets = Object.values(project?.assets ?? {});

  const usedIds = useMemo(() => {
    const used = new Set<string>();
    for (const node of Object.values(project?.nodes ?? {})) {
      const id = node.props?.assetId as string | null | undefined;
      if (id) used.add(id);
      if (node.scene3d?.modelAssetId) used.add(node.scene3d.modelAssetId);
    }
    return used;
  }, [project]);

  const filtered = assets
    .filter((a) => filter === "all" || a.type === filter)
    .sort((a, b) => a.name.localeCompare(b.name));

  const kindCount = (k: AssetKind) => assets.filter((a) => a.type === k).length;

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy((b) => b + files.length);
    for (const f of Array.from(files)) {
      await addAssetFromFile(f);
      setBusy((b) => b - 1);
    }
  };

  return (
    <div
      className={`flex h-full min-h-0 flex-col ${dropping ? "bg-accent-600/5" : ""}`}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          setDropping(true);
        }
      }}
      onDragLeave={(e) => {
        if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) setDropping(false);
      }}
      onDrop={(e) => {
        setDropping(false);
        if (e.dataTransfer.files?.length) {
          e.preventDefault();
          void onFiles(e.dataTransfer.files);
        }
      }}
    >
      <PanelHeader
        right={
          <button
            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10.5px] text-ink-400 transition-colors hover:bg-ink-700 hover:text-accent-400"
            onClick={() => fileRef.current?.click()}
            title="Upload files (images, videos, 3D models, favicons)"
          >
            <EditorIcon name="plus" size={11} />
            Add
          </button>
        }
      >
        Assets
      </PanelHeader>
      <input
        ref={fileRef}
        type="file"
        multiple
        className="hidden"
        accept="image/*,video/mp4,video/webm,.glb,.gltf,.ico,.svg"
        onChange={(e) => {
          void onFiles(e.target.files);
          e.target.value = "";
        }}
      />

      <div className="px-2 pt-2">
        <Segmented
          size="sm"
          value={filter}
          onChange={(v) => setFilter(v as AssetFilter)}
          options={FILTERS.map((f) => ({
            value: f.value,
            label: f.value === "all" ? `All${assets.length ? ` ${assets.length}` : ""}` : `${f.label}${kindCount(f.value as AssetKind) ? ` ${kindCount(f.value as AssetKind)}` : ""}`,
          }))}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {busy > 0 && (
          <p className="px-1 pb-2 text-[11px] text-accent-400">Importing {busy} file{busy === 1 ? "" : "s"}…</p>
        )}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-ink-600 px-3 py-6 text-center">
            <EditorIcon name="image" size={18} className="text-ink-600" />
            <p className="text-[11.5px] leading-relaxed text-ink-500">
              {filter === "all"
                ? "Drop files here or click Add. Images, videos, GLB 3D models and favicons are sorted automatically."
                : `No ${KIND_LABEL[filter as AssetKind].toLowerCase()}s yet.`}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-1.5">
            {filtered.map((a) => (
              <AssetCard key={a.id} asset={a} used={usedIds.has(a.id)} />
            ))}
          </div>
        )}
      </div>
      <div className="border-t border-ink-700/60 px-3 py-1.5">
        <p className="text-[10px] leading-snug text-ink-600">
          Drag an asset onto the canvas and it lands exactly where you drop it. 3D models become live scenes.
        </p>
      </div>
    </div>
  );
}
