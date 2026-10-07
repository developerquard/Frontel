import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

/**
 * 3D scene runtime shared by the editor canvas and the generated project.
 * The code generator re-emits this logic inline in the generated Scene3D
 * component so exports stay independent of the Frontel editor runtime.
 */

export interface Scene3DParams {
  shape: "torus-knot" | "icosahedron" | "box" | "sphere";
  /** Optional GLB/GLTF URL. When loadable it replaces the procedural shape. */
  modelUrl?: string;
  /** Uniform scale for the loaded model. 1 = authored size. */
  modelScale?: number;
  color: string;
  rotationSpeed: number;
  floatAmplitude: number;
  cameraDistance: number;
  scrollInfluence: number;
  wireframe: boolean;
}

/** Computes the scale that fits a model inside a unit bounding sphere. */
function fitScale(object: THREE.Object3D, targetRadius = 1.5): number {
  const box = new THREE.Box3().setFromObject(object);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  const radius = Math.max(size.x, size.y, size.z) / 2 || 1;
  object.position.sub(center); // re-center the model at the origin
  return targetRadius / radius;
}

export function createScene3D(
  container: HTMLElement,
  params: Scene3DParams,
): { dispose: () => void; setScroll: (p: number) => void } {
  const width = container.clientWidth || 600;
  const height = container.clientHeight || 400;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);
  renderer.domElement.style.display = "block";

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
  camera.position.set(0, 0, params.cameraDistance);

  // Lighting: key + fill + rim for a polished look.
  const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
  keyLight.position.set(4, 6, 6);
  scene.add(keyLight);
  const fillLight = new THREE.DirectionalLight(new THREE.Color(params.color), 0.9);
  fillLight.position.set(-5, -2, 4);
  scene.add(fillLight);
  const rimLight = new THREE.DirectionalLight(0xffffff, 0.7);
  rimLight.position.set(0, 3, -6);
  scene.add(rimLight);
  scene.add(new THREE.AmbientLight(0xffffff, 0.35));

  let geometry: THREE.BufferGeometry | null = null;
  let material: THREE.MeshStandardMaterial | null = null;
  let mesh: THREE.Object3D;
  let disposed = false;

  const buildProcedural = (): THREE.Object3D => {
    switch (params.shape) {
      case "icosahedron":
        geometry = new THREE.IcosahedronGeometry(1.4, 0);
        break;
      case "box":
        geometry = new THREE.BoxGeometry(1.9, 1.9, 1.9);
        break;
      case "sphere":
        geometry = new THREE.SphereGeometry(1.4, 48, 48);
        break;
      default:
        geometry = new THREE.TorusKnotGeometry(1.05, 0.34, 180, 24);
    }
    material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(params.color),
      metalness: 0.55,
      roughness: 0.28,
      wireframe: params.wireframe,
    });
    return new THREE.Mesh(geometry, material);
  };

  mesh = buildProcedural();
  scene.add(mesh);

  // GLB/GLTF model support: loads async and swaps in when ready.
  let loader: GLTFLoader | null = null;
  if (params.modelUrl) {
    try {
      loader = new GLTFLoader();
    } catch {
      loader = null;
    }
  }
  if (loader && params.modelUrl) {
    loader.load(
      params.modelUrl,
      (gltf) => {
        if (disposed) return;
        const model = gltf.scene;
        const s = fitScale(model) * (params.modelScale ?? 1);
        model.scale.setScalar(s);
        scene.remove(mesh);
        if (geometry) geometry.dispose();
        if (material) material.dispose();
        mesh = model;
        scene.add(model);
      },
      undefined,
      () => {
        /* Load failure keeps the procedural fallback — never a blank stage. */
      },
    );
  }

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const speed = reducedMotion ? 0 : params.rotationSpeed;
  const floatAmp = reducedMotion ? 0 : params.floatAmplitude;

  let scrollProgress = 0;
  let raf = 0;
  const start = performance.now();

  function tick() {
    if (disposed) return;
    const t = (performance.now() - start) / 1000;
    if (speed) mesh.rotation.y = t * speed;
    mesh.rotation.x = Math.sin(t * 0.4) * 0.25 + scrollProgress * params.scrollInfluence * Math.PI;
    if (floatAmp) mesh.position.y = Math.sin(t * 1.4) * floatAmp;
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  }
  tick();

  function onResize() {
    const w = container.clientWidth || width;
    const h = container.clientHeight || height;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  const observer = new ResizeObserver(onResize);
  observer.observe(container);

  return {
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      geometry?.dispose();
      material?.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
    setScroll(p: number) {
      scrollProgress = p;
    },
  };
}
