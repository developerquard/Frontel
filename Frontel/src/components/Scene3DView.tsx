import { useEffect, useMemo, useRef, useState } from "react";
import { createScene3D } from "@/three/scene";
import { DEFAULT_SCENE_3D, type Scene3DConfig } from "@/schemas/types";

/**
 * Mounts the three.js scene into a div, with a static CSS-art fallback when
 * WebGL is unavailable. Identical behavior is re-emitted by the code generator
 * in the exported project's Scene3D component.
 */
export function Scene3DView({
  config,
  modelUrl,
}: {
  config: Partial<Scene3DConfig>;
  /** Resolved URL of a GLB/GLTF asset, when one is assigned. */
  modelUrl?: string;
}) {
  // The config is rebuilt from scratch on every render, so its VALUE is the
  // dependency: keyed on identity, the effect below re-ran on every parent
  // render and tore down + rebuilt the WebGL renderer each time (hover, drags,
  // selection…), exhausting the browser's WebGL contexts and freezing the
  // editor mid-gesture. Value-keyed, it only rebuilds when the scene changes.
  const cfgKey = JSON.stringify(config ?? {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const cfg = useMemo(() => ({ ...DEFAULT_SCENE_3D, ...config }), [cfgKey]);
  const hostRef = useRef<HTMLDivElement>(null);
  const [webglFailed, setWebglFailed] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    try {
      const test = document.createElement("canvas");
      const gl = test.getContext("webgl2") ?? test.getContext("webgl");
      if (!gl) {
        setWebglFailed(true);
        return;
      }
    } catch {
      setWebglFailed(true);
      return;
    }

    let instance: ReturnType<typeof createScene3D> | null = null;
    let scrollHandler: (() => void) | null = null;
    try {
      instance = createScene3D(host, { ...cfg, modelUrl });
      if (cfg.scrollInfluence > 0) {
        const doc = host.ownerDocument;
        scrollHandler = () => {
          const max = doc.documentElement.scrollHeight - doc.documentElement.clientHeight;
          const p = max <= 0 ? 0 : Math.min(1, Math.max(0, doc.documentElement.scrollTop / max));
          instance?.setScroll(p);
        };
        doc.addEventListener("scroll", scrollHandler, { passive: true });
        scrollHandler();
      }
    } catch {
      setWebglFailed(true);
    }

    return () => {
      instance?.dispose();
      if (scrollHandler) host.ownerDocument.removeEventListener("scroll", scrollHandler);
    };
  }, [cfg, modelUrl]);

  return (
    <div
      ref={hostRef}
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {webglFailed && <StaticSceneFallback color={cfg.color} shape={cfg.shape} />}
    </div>
  );
}

/** Pure-CSS fallback shown when WebGL is unavailable. */
export function StaticSceneFallback({
  color,
  shape,
}: {
  color: string;
  shape: Scene3DConfig["shape"];
}) {
  const gradient =
    shape === "sphere"
      ? `radial-gradient(circle at 32% 30%, ${color}, transparent 68%)`
      : shape === "box"
        ? `linear-gradient(135deg, ${color} 0%, transparent 55%), linear-gradient(315deg, ${color} 0%, transparent 55%)`
        : `conic-gradient(from 200deg at 50% 45%, ${color}, transparent 62%), radial-gradient(circle at 68% 62%, ${color}, transparent 55%)`;
  return (
    <div
      aria-label="3D scene fallback"
      style={{
        width: "72%",
        height: "72%",
        maxWidth: 420,
        aspectRatio: "1 / 1",
        borderRadius: "50%",
        background: gradient,
        opacity: 0.9,
        filter: "blur(0.5px)",
        pointerEvents: "none",
      }}
    />
  );
}
