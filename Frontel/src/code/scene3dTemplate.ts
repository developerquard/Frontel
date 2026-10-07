/**
 * Template for the generated project's Scene3D component.
 *
 * Inlined as source (not imported from the editor) so the exported app is
 * fully independent of the Frontel editor runtime.
 */
export const SCENE3D_TEMPLATE = `import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

interface Scene3DProps {
  shape: "torus-knot" | "icosahedron" | "box" | "sphere";
  modelUrl?: string;
  modelScale?: number;
  color: string;
  rotationSpeed: number;
  floatAmplitude: number;
  cameraDistance: number;
  scrollInfluence: number;
  wireframe: boolean;
  className?: string;
}

export function Scene3D(props: Scene3DProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let renderer: THREE.WebGLRenderer;
    try {
      const test = document.createElement("canvas");
      const gl = test.getContext("webgl2") ?? test.getContext("webgl");
      if (!gl) {
        setFailed(true);
        return;
      }
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setFailed(true);
      return;
    }

    const width = host.clientWidth || 600;
    const height = host.clientHeight || 400;
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    host.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0, props.cameraDistance);

    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(4, 6, 6);
    scene.add(key);
    const fill = new THREE.DirectionalLight(new THREE.Color(props.color), 0.9);
    fill.position.set(-5, -2, 4);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffffff, 0.7);
    rim.position.set(0, 3, -6);
    scene.add(rim);
    scene.add(new THREE.AmbientLight(0xffffff, 0.35));

    let geometry: THREE.BufferGeometry;
    switch (props.shape) {
      case "icosahedron": geometry = new THREE.IcosahedronGeometry(1.4, 0); break;
      case "box": geometry = new THREE.BoxGeometry(1.9, 1.9, 1.9); break;
      case "sphere": geometry = new THREE.SphereGeometry(1.4, 48, 48); break;
      default: geometry = new THREE.TorusKnotGeometry(1.05, 0.34, 180, 24);
    }
    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(props.color),
      metalness: 0.55,
      roughness: 0.28,
      wireframe: props.wireframe,
    });
    let mesh: THREE.Object3D = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    // Optional GLB/GLTF model: loaded async, replaces the procedural shape.
    if (props.modelUrl) {
      const url = props.modelUrl;
      new GLTFLoader().load(
        url,
        (gltf) => {
          const model = gltf.scene;
          const box = new THREE.Box3().setFromObject(model);
          const size = new THREE.Vector3();
          const center = new THREE.Vector3();
          box.getSize(size);
          box.getCenter(center);
          const radius = Math.max(size.x, size.y, size.z) / 2 || 1;
          model.position.sub(center);
          model.scale.setScalar((1.5 / radius) * (props.modelScale ?? 1));
          scene.remove(mesh);
          mesh = model;
          scene.add(model);
        },
        undefined,
        () => { /* keep procedural fallback on load failure */ },
      );
    }

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const speed = reduced ? 0 : props.rotationSpeed;
    const floatAmp = reduced ? 0 : props.floatAmplitude;
    let scrollProgress = 0;
    let raf = 0;
    let disposed = false;
    const start = performance.now();

    function tick() {
      if (disposed) return;
      const t = (performance.now() - start) / 1000;
      if (speed) mesh.rotation.y = t * speed;
      mesh.rotation.x = Math.sin(t * 0.4) * 0.25 + scrollProgress * props.scrollInfluence * Math.PI;
      if (floatAmp) mesh.position.y = Math.sin(t * 1.4) * floatAmp;
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    }
    tick();

    const onScroll = () => {
      const max = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      scrollProgress = max <= 0 ? 0 : Math.min(1, Math.max(0, document.documentElement.scrollTop / max));
    };
    if (props.scrollInfluence > 0) {
      document.addEventListener("scroll", onScroll, { passive: true });
      onScroll();
    }
    const observer = new ResizeObserver(() => {
      const w = host.clientWidth || width;
      const h = host.clientHeight || height;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    });
    observer.observe(host);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      document.removeEventListener("scroll", onScroll);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [props.shape, props.color, props.rotationSpeed, props.floatAmplitude, props.cameraDistance, props.scrollInfluence, props.wireframe, props.modelUrl, props.modelScale]);

  return (
    <div ref={hostRef} className={props.className} style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
      {failed && (
        <div
          aria-label="3D scene fallback"
          style={{
            width: "72%",
            maxWidth: 420,
            aspectRatio: "1 / 1",
            borderRadius: "50%",
            background:
              props.shape === "sphere"
                ? \`radial-gradient(circle at 32% 30%, \${props.color}, transparent 68%)\`
                : \`conic-gradient(from 200deg at 50% 45%, \${props.color}, transparent 62%), radial-gradient(circle at 68% 62%, \${props.color}, transparent 55%)\`,
            opacity: 0.9,
            pointerEvents: "none",
          }}
        />
      )}
    </div>
  );
}
`;

/** The generated runtime: reveal/parallax/background/scroll-progress effects. */
export const RUNTIME_TEMPLATE = `import { useEffect } from "react";

/**
 * Generated Frontel runtime — applies reveal, parallax, background-transition
 * and scroll-progress effects declared via data attributes.
 */
export function useFrontelRuntime() {
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cleanups: (() => void)[] = [];

    if (!reduced) {
      // Reveal on scroll into view.
      const revealEls = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
      if (revealEls.length) {
        const io = new IntersectionObserver(
          (entries) => {
            for (const entry of entries) {
              if (entry.isIntersecting) {
                entry.target.classList.add("is-visible");
                io.unobserve(entry.target);
              }
            }
          },
          { threshold: 0.15 },
        );
        revealEls.forEach((el) => io.observe(el));
        cleanups.push(() => io.disconnect());
      }

      // Parallax + background transition + scroll progress bar.
      const parallaxEls = Array.from(document.querySelectorAll<HTMLElement>("[data-parallax]"));
      const bgEls = Array.from(document.querySelectorAll<HTMLElement>("[data-bg-from]"));
      const progressEls = Array.from(document.querySelectorAll<HTMLElement>("[data-scroll-progress]"));
      if (parallaxEls.length || bgEls.length || progressEls.length) {
        let raf = 0;
        const vp = (el: HTMLElement) => {
          const vh = window.innerHeight;
          const r = el.getBoundingClientRect();
          const total = vh + r.height;
          return total <= 0 ? 0 : Math.min(1, Math.max(0, (vh - r.top) / total));
        };
        const update = () => {
          for (const el of parallaxEls) {
            const intensity = Number(el.dataset.parallax) || 0.4;
            el.style.transform = \`translateY(\${(vp(el) - 0.5) * -intensity * 160}px)\`;
          }
          for (const el of bgEls) {
            const from = el.dataset.bgFrom ?? "#000000";
            const to = el.dataset.bgTo ?? "#ffffff";
            el.style.background = mix(from, to, vp(el));
          }
          for (const el of progressEls) {
            const max = document.documentElement.scrollHeight - document.documentElement.clientHeight;
            const p = max <= 0 ? 0 : Math.min(1, Math.max(0, document.documentElement.scrollTop / max));
            el.style.background = \`linear-gradient(90deg, var(--fe-primary) \${p * 100}%, transparent \${p * 100}%)\`;
          }
        };
        const onScroll = () => {
          cancelAnimationFrame(raf);
          raf = requestAnimationFrame(update);
        };
        document.addEventListener("scroll", onScroll, { passive: true });
        update();
        cleanups.push(() => {
          document.removeEventListener("scroll", onScroll);
          cancelAnimationFrame(raf);
        });
      }
    }

    return () => cleanups.forEach((fn) => fn());
  }, []);
}

function hexToRgb(hex: string): [number, number, number] {
  const m = hex.replace("#", "");
  const v = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  const n = parseInt(v, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix(from: string, to: string, t: number): string {
  try {
    const a = hexToRgb(from);
    const b = hexToRgb(to);
    return \`rgb(\${Math.round(a[0] + (b[0] - a[0]) * t)}, \${Math.round(a[1] + (b[1] - a[1]) * t)}, \${Math.round(a[2] + (b[2] - a[2]) * t)})\`;
  } catch {
    return from;
  }
}
`;
