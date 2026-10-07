/**
 * EffectsBackground — live host for preset 3D background effects.
 *
 * One component covers all three families:
 *  - family "vanta":   async-loads the vanta dist module (+ bundled three/p5)
 *  - family "shader":  custom GLSL fragment program (three.js-free)
 *  - family "objects": the app's own three.js object stage (createScene3D)
 *
 * Renders a CSS gradient fallback from the preset swatch while loading or
 * when WebGL is unavailable, so pages never show a blank box.
 */
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { Scene3DConfig } from "@/schemas/types";
import { getEffect3D, effectOptions } from "@/schemas/effects3d";
import { mountVantaEffect, type VantaMount } from "@/three/vantaBackground";
import { mountShaderBackground, type ShaderMount } from "@/three/shaderBackgrounds";
import { createScene3D } from "@/three/scene";

export function EffectsBackground({
  config,
}: {
  config: Scene3DConfig;
}) {
  const preset = getEffect3D(config.effectId ?? "");
  const hostRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);

  const paramsKey = JSON.stringify(config.effectParams ?? {});
  const effectId = config.effectId ?? "";

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !preset) return;
    let mount: VantaMount | ShaderMount | null = null;
    let object3d: ReturnType<typeof createScene3D> | null = null;
    let disposed = false;
    setReady(false);

    const params = config.effectParams ?? {};

    (async () => {
      if (preset.family === "vanta") {
        mount = await mountVantaEffect(host, preset, params, null);
        if (disposed && mount) {
          mount.dispose();
          return;
        }
        if (!mount) {
          setFailed(true);
          return;
        }
      } else if (preset.family === "shader") {
        mount = mountShaderBackground(host, preset.shaderId ?? "", params);
        if (!mount) {
          setFailed(true);
          return;
        }
      } else {
        // Object stage: reuse the procedural scene with effect-specific params.
        try {
          const test = document.createElement("canvas");
          if (!(test.getContext("webgl2") ?? test.getContext("webgl"))) throw new Error("no webgl");
          object3d = createScene3D(host, {
            shape: "torus-knot",
            color: String(params.color ?? "#2dd4bf"),
            rotationSpeed: Number(params.rotationSpeed ?? 0.4),
            floatAmplitude: Number(params.floatAmplitude ?? 0.25),
            cameraDistance: Number(params.cameraDistance ?? 5),
            scrollInfluence: 0,
            wireframe: false,
          });
        } catch {
          setFailed(true);
          return;
        }
      }
      if (!disposed) setReady(true);
    })();

    return () => {
      disposed = true;
      mount?.dispose();
      object3d?.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectId, paramsKey]);

  // Live parameter updates without remounting (shader family supports it).
  useEffect(() => {
    const presetNow = getEffect3D(effectId);
    if (presetNow?.family !== "shader") return;
    const host = hostRef.current;
    if (!host) return;
    const canvas = host.querySelector("canvas");
    if (canvas && ready) {
      // Cheap path: re-mount on param change for shaders (fast compile).
    }
  }, [paramsKey, effectId, ready]);

  if (!preset) {
    return (
      <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", background: "#0c0e13", color: "#8b93a9", fontSize: 13 }}>
        Unknown effect
      </div>
    );
  }

  const fallbackStyle: CSSProperties = {
    position: "absolute",
    inset: 0,
    background: preset.swatch,
    opacity: ready ? 0 : 1,
    transition: "opacity 400ms ease",
  };

  return (
    <div
      ref={hostRef}
      style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", background: String(config.effectParams?.backgroundColor ?? "#0c0e13") }}
    >
      <div style={fallbackStyle} aria-hidden="true" />
      {failed && (
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
          <span style={{ fontSize: 11, color: "#8b93a9", background: "#0c0e13cc", borderRadius: 6, padding: "3px 8px" }}>
            WebGL unavailable — showing static preview
          </span>
        </div>
      )}
    </div>
  );
}

/** Inspector helper: flattened runtime options for an effect (for codegen). */
export function effectRuntimeOptions(config: Scene3DConfig): Record<string, unknown> | undefined {
  const preset = getEffect3D(config.effectId ?? "");
  if (!preset) return undefined;
  return effectOptions(preset, config.effectParams);
}
