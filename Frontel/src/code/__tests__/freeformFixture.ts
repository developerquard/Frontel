/**
 * Fixture for freeform + styles export verification.
 *
 * It builds the project through the REAL store (not by hand-writing nodes), so
 * the checks below cover the actual drag-and-drop model:
 *
 *   - free placement inside a container promotes that container to
 *     position:relative and records the node's left/top
 *   - empty page space materializes the page's canvas layer as the first child
 *   - the host grows (min-height) so a box dropped past its bottom is never cut
 *   - a drop is ONE undo step, and undo restores the pre-drop tree
 *   - "write a pinned heading and a 3D scene, with a navbar section below"
 *   - a 3D scene is a CONTAINER: UI dropped on it becomes its child, so it
 *     renders on top of the effect (the "background scene" model)
 *   - freeing a `fill`-width box keeps it fluid: only the auto axis is pinned,
 *     so a full-width bar keeps stretching to the window
 *   - text variants / surface presets apply as ordinary style patches, and
 *     gradient + glow + font survive into the generated CSS and index.html
 *
 * The resulting project is then run through the code generator by
 * scripts/verify-freeform-export.mjs and typechecked as real output.
 */
import { makeScratchProject } from "@/schemas/factory";
import { useEditor } from "@/lib/store";
import { isFreeformLayer } from "@/lib/freeform";
import { getTextPreset } from "@/schemas/textPresets";
import { getSurfacePreset } from "@/schemas/visualPresets";
import { fontStack } from "@/schemas/fonts";
import { isContainerType } from "@/schemas/registry";
import type { ElementNode, Project } from "@/schemas/types";

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(`freeform model check failed: ${message}`);
}

/**
 * Minimal browser shim so the store can run outside a browser: it only needs
 * timers (autosave debounce) and a DOM query (measuring a node's height).
 */
function shimBrowserGlobals(): void {
  const g = globalThis as unknown as { window?: unknown; document?: unknown };
  if (!g.window) {
    g.window = { setTimeout, clearTimeout };
  }
  if (!g.document) {
    // No DOM here: measurements return null and the store falls back to the
    // authored values, which is exactly what the export reads.
    g.document = { querySelector: () => null };
  }
}

/**
 * Builds the fixture by driving the store exactly the way the editor does.
 * Returns the resulting project (the active project in the store).
 */
export function buildFreeformTestProject(): Project {
  shimBrowserGlobals();
  const project = makeScratchProject("Freeform Test");
  const page = project.pages[0];
  const rootId = page.rootId;

  const store = useEditor;
  store.setState({
    projects: [project],
    activeProjectId: project.id,
    activePageId: page.id,
    selectedId: null,
    past: [],
    future: [],
  });
  const s = () => store.getState();
  const nodes = () => {
    const p = s().getProject();
    assert(p, "no active project");
    return p!.nodes;
  };

  /* ---- 1. a flow navbar section: sections stay the page's backbone ---- */
  const navbarId = s().addSectionAt("navbar");
  assert(navbarId, "navbar section was not created");

  /* ---- 2. a card container as a flow block ---- */
  const cardId = s().addElementAt("container", rootId, 1);
  assert(cardId, "card container was not created");
  assert(nodes()[cardId!].style.base.position !== "relative", "card starts unpromoted");

  /* ---- 3. free placement INSIDE the card ---- */
  const heading = s().createAtPoint("heading", {
    parentId: cardId!,
    left: 120,
    top: 64,
    width: 480,
    height: 96,
  });
  assert(heading, "heading was not created");
  const headingNode = nodes()[heading!];
  assert(headingNode.style.base.position === "absolute", "heading is free-positioned");
  assert(headingNode.style.base.left === 120 && headingNode.style.base.top === 64, "left/top recorded");
  assert(nodes()[cardId!].style.base.position === "relative", "card promoted to relative");
  assert(nodes()[cardId!].children.includes(heading!), "heading lives inside the card");

  /* ---- 4. dragging it further down grows the card, nothing is clipped ---- */
  s().dropFree(heading!, { hostId: cardId!, left: 120, top: 256, hostMinHeight: 256 + 96 + 16 });
  const cardMin = nodes()[cardId!].style.base.minHeight;
  assert(
    typeof cardMin === "number" && cardMin >= 368,
    `card grew to fit (got ${String(cardMin)})`,
  );
  assert(nodes()[heading!].style.base.top === 256, "heading moved to the new offset");

  /* ---- 5. one drop = one undo step ---- */
  const before = s().past.length;
  s().dropFree(heading!, { hostId: cardId!, left: 200, top: 128 });
  assert(s().past.length === before + 1, "drop pushed exactly one history entry");
  s().undo();
  assert(nodes()[heading!].style.base.left === 120, "undo restored the previous position");
  s().redo();
  assert(nodes()[heading!].style.base.left === 200, "redo re-applied the drop");

  /* ---- 6. layout: returning a free box to the host's flow ---- */
  s().makeFlow(heading!);
  assert(nodes()[heading!].style.base.position === undefined, "makeFlow strips positioning");
  assert(nodes()[heading!].style.base.left === undefined, "makeFlow strips left");
  s().makeFree(heading!, { left: 200, top: 128 });
  assert(nodes()[heading!].style.base.position === "absolute", "makeFree restores free placement");

  /* ---- 7. empty page space: the canvas layer appears as the first child ---- */
  // The host height comes from the editor, which measures the host and only asks
  // for growth when the new box would overflow it (top + height + 2 boxes).
  const badge = s().createAtPoint("text", {
    left: 80,
    top: 640,
    width: 360,
    height: 72,
    hostMinHeight: 640 + 72 + 16,
  });
  assert(badge, "free text was not created");
  const root = nodes()[rootId];
  const layerId = root.children[0];
  assert(isFreeformLayer(nodes()[layerId]), "canvas layer is the page's first child");
  assert(nodes()[layerId].children.includes(badge!), "free text lives in the canvas layer");
  assert(nodes()[layerId].children[0] === badge!, "first free element sits at the back");
  const layerMin = nodes()[layerId].style.base.minHeight;
  assert(
    typeof layerMin === "number" && layerMin >= 640 + 72 + 16,
    `canvas layer grew to hold the box (got ${String(layerMin)})`,
  );

  /* ---- 8. a free element can be pulled into another box, and back out ---- */
  s().dropFree(badge!, { hostId: cardId!, left: 320, top: 300, hostMinHeight: 300 + 72 + 16 });
  assert(nodes()[cardId!].children.includes(badge!), "text moved into the card");
  assert(!nodes()[layerId].children.includes(badge!), "text left the canvas layer");
  assert(nodes()[badge!].style.base.zIndex !== undefined, "free nodes get a stacking order");

  /* ---- 9. a GLB model scene placed freely, with z below the text ---- */
  const assetId = "assetglb1";
  const scene = s().createAtPoint("scene3d", {
    parentId: layerId,
    left: 0,
    top: 0,
    width: 640,
    height: 360,
    style: { zIndex: 0 },
  });
  assert(scene, "scene was not created");
  s().addAsset({
    id: assetId,
    name: "robot.glb",
    type: "model",
    src: "https://example.com/models/robot.glb",
  });
  s().setScene3D(scene!, { modelAssetId: assetId, shape: "icosahedron", modelScale: 1.2 });

  /* ---- 10. a 3D scene is a CONTAINER: UI on top of the effect ---- */
  assert(isContainerType("scene3d"), "a 3D scene accepts children");
  const backdrop = s().createAtPoint("scene3d", {
    left: 0,
    top: 0,
    width: 1280,
    height: 720,
    style: { zIndex: 0 },
  });
  assert(backdrop, "backdrop scene was not created");
  s().setScene3D(backdrop!, {
    mode: "effect",
    effectId: "fx-aurora",
    effectParams: { colorA: "#00ffa3", colorB: "#0396ff", colorC: "#020014", speed: 1, zoom: 1 },
  });
  const overScene = s().createAtPoint("heading", {
    parentId: backdrop!,
    left: 96,
    top: 240,
    width: 640,
    height: 120,
  });
  assert(overScene, "heading on the scene was not created");
  assert(
    nodes()[backdrop!].children.includes(overScene!),
    "UI dropped on a 3D scene lives inside it, so it paints on top",
  );

  /* ---- 11. text variants + surfaces are plain style patches ---- */
  const variant = getTextPreset("gradient-headline");
  assert(variant, "gradient headline variant exists");
  s().select(null); // page-level insertion, not "into whatever is selected"
  const headline = s().addElement("heading", null, {
    name: variant!.label,
    props: variant!.creates.props,
    style: variant!.style,
  });
  assert(headline, "variant heading was not created");
  assert(
    nodes()[headline!].style.base.textGradient === variant!.style.textGradient,
    "the variant's gradient landed on the node in one step",
  );
  const surface = getSurfacePreset("glass");
  const glassCard = s().addElement("stack", null, { name: surface!.label, style: surface!.style });
  assert(glassCard, "glass card was not created");
  assert(nodes()[glassCard!].style.base.backdropBlur === 18, "glass card carries its blur");

  /* ---- 12. per-element font + glow, and a project typeface ---- */
  s().setStyle(headline!, "base", {
    fontFamily: "space-grotesk",
    textGlow: { color: "primary", blur: 20, spread: 2.5 },
  });
  s().setTheme({ fontId: "sora", font: fontStack("sora") });

  /* ---- 13. freeing a `fill` box keeps it fluid ---- */
  // A section authored to fill the page must keep filling it once it becomes
  // free: pinning it to the pixels it happened to measure at is what made a
  // full-width bar stop following the window (the frozen-band bug).
  assert(nodes()[navbarId!].style.base.width?.kind === "fill", "navbar is authored as fill");
  s().makeFree(navbarId!, { left: 0, top: 0 }, { pinSize: { w: 1192, h: 72 } });
  const freedBar = nodes()[navbarId!];
  assert(freedBar.style.base.position === "absolute", "navbar became free-positioned");
  assert(
    freedBar.style.base.width?.kind === "fill",
    `a freed fill-width box stays fluid (got ${JSON.stringify(freedBar.style.base.width)})`,
  );
  assert(
    freedBar.style.base.height?.kind === "fixed" && freedBar.style.base.height.value === 72,
    `the auto axis is still pinned to the promised size (got ${JSON.stringify(freedBar.style.base.height)})`,
  );

  const finalProject = s().getProject()!;
  assert(finalProject.theme.fontId === "sora", "the theme records its font id");
  assert(
    Object.values(finalProject.nodes).some((n: ElementNode) => n.type === "scene3d"),
    "project contains a 3D scene",
  );
  return finalProject;
}
