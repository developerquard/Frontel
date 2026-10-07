/**
 * Vanta background runtime — mounts a vanta.js effect module into a host
 * element using the module's bundled three.js (r134) and p5 where needed.
 *
 * The vanta dist modules are UMD bundles that export `{ default: factory }`;
 * the factory receives `{ el, THREE, ...options }` and returns a live effect
 * with setOptions/destroy. Effects that need three.js get the module's own
 * vendor build so option-shaped APIs match exactly; p5-based effects
 * (TOPOLOGY, TRUNK) get the bundled p5.
 *
 * Kept dependency-light and failure-tolerant: if a module cannot load, the
 * caller falls back to the CSS gradient swatch so the page never goes blank.
 */
import type { Effect3DPreset } from "@/schemas/effects3d";
import { effectOptions } from "@/schemas/effects3d";

type VantaInstance = {
  destroy: () => void;
  setOptions?: (options: Record<string, unknown>) => void;
  resize?: () => void;
};

type VantaFactory = (options: Record<string, unknown>) => VantaInstance;

let threePromise: Promise<unknown> | null = null;
let p5Promise: Promise<unknown> | null = null;

/**
 * Extracts the effect factory from a vanta dist module under any interop
 * shape: `{ default: factory }`, `{ default: { default: factory } }`, or a
 * namespace carrying `VANTA[name]`.
 */
function resolveFactory(
  mod: Record<string, unknown>,
  effectName: string,
): VantaFactory | null {
  const unwrap = (value: unknown): unknown => {
    let candidate = value;
    for (let depth = 0; depth < 4; depth++) {
      if (candidate && typeof candidate === "object") {
        const obj = candidate as Record<string, unknown>;
        const keys = Object.keys(obj);
        if (keys.length === 1 && keys[0] === "default" && obj.default !== undefined) {
          candidate = obj.default;
          continue;
        }
      }
      break;
    }
    return candidate;
  };
  const asFactory = (value: unknown): VantaFactory | null => {
    if (typeof value === "function") return value as VantaFactory;
    if (value && typeof value === "object") {
      const vanta = (value as Record<string, unknown>).VANTA as
        | Record<string, unknown>
        | undefined;
      const named = vanta?.[effectName] ?? (value as Record<string, unknown>)[effectName];
      if (typeof named === "function") return named as VantaFactory;
    }
    return null;
  };
  return asFactory(unwrap(mod.default ?? mod)) ?? asFactory((mod as Record<string, unknown>).VANTA) ?? null;
}

/**
 * Resolves a UMD vendor module loaded through the bundler's CJS interop:
 * three.r134 populates the exports namespace with symbols at the top level,
 * p5 exports the class as default, and script-style loads leak a global.
 * Interop layers can double-wrap (`{ default: { default: lib } }`), so keep
 * unwrapping single-key `default` envelopes until the real library appears.
 */
function resolveUmd(mod: Record<string, unknown>, globalName: string): unknown {
  const leaked = (globalThis as Record<string, unknown>)[globalName];
  if (leaked) return leaked;
  let candidate: unknown = mod;
  for (let depth = 0; depth < 4; depth++) {
    if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
      const obj = candidate as Record<string, unknown>;
      const keys = Object.keys(obj);
      if (keys.length === 1 && keys[0] === "default" && obj.default !== undefined) {
        candidate = obj.default;
        continue;
      }
    }
    break;
  }
  if (candidate !== mod) return candidate;
  const dflt = (mod as Record<string, unknown>).default;
  if (dflt !== undefined && dflt !== null) return dflt;
  return mod; // namespace object with the library's symbols at the top level
}

/** Lazily loads the vanta-bundled three.js r134 (isolated from the app's three). */
async function loadVantaThree(): Promise<unknown> {
  if (!threePromise) {
    threePromise = import("vanta/vendor/three.r134.min.js")
      .then((mod) => resolveUmd(mod as unknown as Record<string, unknown>, "THREE"))
      .catch(() => {
        threePromise = null;
        throw new Error("vanta three failed to load");
      });
  }
  return threePromise;
}

async function loadP5(): Promise<unknown> {
  if (!p5Promise) {
    p5Promise = import("vanta/vendor/p5.min.js")
      .then((mod) => resolveUmd(mod as unknown as Record<string, unknown>, "p5"))
      .catch(() => {
        p5Promise = null;
        throw new Error("p5 failed to load");
      });
  }
  return p5Promise;
}

/** Static import table for all 14 effect modules (bundled, code-split per effect). */
const MODULES: Record<string, () => Promise<{ default: VantaFactory }>> = {
  BIRDS: () => import("vanta/dist/vanta.birds.min.js"),
  WAVES: () => import("vanta/dist/vanta.waves.min.js"),
  NET: () => import("vanta/dist/vanta.net.min.js"),
  GLOBE: () => import("vanta/dist/vanta.globe.min.js"),
  DOTS: () => import("vanta/dist/vanta.dots.min.js"),
  FOG: () => import("vanta/dist/vanta.fog.min.js"),
  CELLS: () => import("vanta/dist/vanta.cells.min.js"),
  TOPOLOGY: () => import("vanta/dist/vanta.topology.min.js"),
  TRUNK: () => import("vanta/dist/vanta.trunk.min.js"),
  RINGS: () => import("vanta/dist/vanta.rings.min.js"),
  HALO: () => import("vanta/dist/vanta.halo.min.js"),
  RIPPLE: () => import("vanta/dist/vanta.ripple.min.js"),
  CLOUDS: () => import("vanta/dist/vanta.clouds.min.js"),
  CLOUDS2: () => import("vanta/dist/vanta.clouds2.min.js"),
};

const P5_EFFECTS = new Set(["TOPOLOGY", "TRUNK"]);

export interface VantaMount {
  setOptions: (options: Record<string, unknown>) => void;
  dispose: () => void;
}

/**
 * Mounts a vanta effect into `host`. The host keeps its own background color;
 * vanta paints the canvas itself using backgroundColor.
 */
export async function mountVantaEffect(
  host: HTMLElement,
  preset: Effect3DPreset,
  params: Record<string, unknown> | undefined,
  mouse: { x: number; y: number } | null,
): Promise<VantaMount | null> {
  const effectName = preset.vantaEffect;
  const loadModule = effectName ? MODULES[effectName] : undefined;
  if (!effectName || !loadModule) return null;

  let THREE: unknown;
  let p5: unknown;
  try {
    THREE = await loadVantaThree();
    if (P5_EFFECTS.has(effectName)) p5 = await loadP5();
    const mod = await loadModule();
    const factory = resolveFactory(mod as unknown as Record<string, unknown>, effectName);
    if (!factory) return null;

    const options: Record<string, unknown> = {
      el: host,
      THREE,
      ...(p5 ? { p5 } : {}),
      mouseControls: false,
      touchControls: false,
      gyroControls: false,
      minHeight: 200,
      minWidth: 200,
      ...effectOptions(preset, params),
    };

    const instance: VantaInstance = factory(options);
    if (mouse) {
      const r = host.getBoundingClientRect();
      instance.setOptions?.({});
      host.dispatchEvent(new MouseEvent("mousemove", { clientX: r.left + mouse.x, clientY: r.top + mouse.y, bubbles: false }));
    }

    return {
      setOptions(next) {
        try {
          instance.setOptions?.(next);
        } catch {
          /* some effects only read options at init */
        }
      },
      dispose() {
        try {
          instance.destroy();
        } catch {
          /* already gone */
        }
        // Vanta injects a canvas child — remove leftovers so React can reuse the host.
        host.querySelectorAll("canvas").forEach((c) => c.remove());
      },
    };
  } catch (err) {
    console.warn("[Frontel vanta] mount failed:", err);
    return null;
  }
}
