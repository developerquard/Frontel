/**
 * End-to-end freeform export verification.
 * 1. Builds a project through the REAL store (free drops into containers, the
 *    page's canvas layer, one-undo-step drops, makeFree/makeFlow, 3D + GLB,
 *    3D scenes as backgrounds that host UI, text variants + surface presets)
 * 2. Generates the export via the real generator (Vite SSR, same aliases as the app)
 * 3. Checks the generated CSS really carries placement AND the new visual
 *    layer (gradient text, glow, per-element fonts, glass backdrop)
 * 4. Writes it to disk and runs `tsc -b` over the generated TS/TSX
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const HERE = import.meta.dirname;
const FRONTEL = path.resolve(HERE, "..", "frontel");
// Generate the test project INSIDE frontel/node_modules/.cache so node/tsc
// resolve react, vite etc. through the normal directory walk-up — no symlinks
// or junctions needed (Windows volumes that forbid reparse points, e.g. exFAT,
// reject fs.symlinkSync and `mklink /J` with EPERM).
const target = path.resolve(FRONTEL, "node_modules", ".cache", "freeform-export-test");

const require = createRequire(path.join(FRONTEL, "package.json"));
const { createServer } = require("vite");

const server = await createServer({
  root: FRONTEL,
  logLevel: "error",
  server: { middlewareMode: true },
  optimizeDeps: { noDiscovery: true, include: [] },
});

try {
  const { buildFreeformTestProject } = await server.ssrLoadModule("/src/code/__tests__/freeformFixture.ts");
  const project = buildFreeformTestProject();

  const { generateProjectFiles } = await server.ssrLoadModule("/src/code/generator.ts");
  const files = generateProjectFiles(project);

  /* ---------------- generated CSS carries the free placement ---------------- */
  const styles = files["src/styles.css"] ?? "";
  const rule = (cls) => {
    const match = styles.match(new RegExp(`\\.${cls} \\{([^}]*)\\}`));
    if (!match) throw new Error(`generated CSS has no .${cls} rule`);
    return match[1];
  };
  const expect = (cls, decl) => {
    if (!rule(cls).includes(decl)) {
      throw new Error(`.${cls} is missing \`${decl}\` in generated CSS`);
    }
  };
  expect("canvas-layer", "position: relative");
  expect("container", "position: relative"); // promoted to host free children
  expect("container", "min-height"); // grown so nothing is clipped
  expect("heading", "position: absolute");
  expect("heading", "left: 200px");
  expect("heading", "top: 128px");
  console.log("OK: generated CSS reproduces free placement (relative hosts + left/top)");

  /* ---------------- a freed fill-width box stays fluid ---------------- */
  // The navbar section is authored width:fill and was freed with a pinned size.
  // Emitting `width: 1192px` here is the frozen-band bug: a full-width bar that
  // stops following the window instead of stretching to it.
  expect("navbar", "position: absolute");
  expect("navbar", "width: 100%");
  expect("navbar", "height: 72px");
  if (/width: 1192px/.test(styles)) {
    throw new Error("a freed fill-width box was frozen to pixels in generated CSS");
  }
  console.log("OK: a freed fill-width box stays fluid (only its auto axis is pinned)");

  /* ---------------- text variants + surfaces reach real CSS ---------------- */
  expect("gradient-headline", "background-clip: text");
  expect("gradient-headline", "-webkit-background-clip: text");
  expect("gradient-headline", "-webkit-text-fill-color: transparent");
  expect("gradient-headline", "background-image: linear-gradient");
  expect("gradient-headline", 'font-family: "Space Grotesk"');
  expect("gradient-headline", "text-shadow: 0 0 20px #2dd4bf, 0 0 50px #2dd4bf");
  expect("glass", "backdrop-filter: blur(18px)");
  expect("glass", "box-shadow: 0 24px 60px -24px rgb(0 0 0 / 0.65)");
  console.log("OK: variants export as real CSS (gradient text, glow, fonts, glass)");

  /* ---------------- fonts are really loaded by the export ---------------- */
  const html = files["index.html"] ?? "";
  if (!html.includes("fonts.googleapis.com/css2?")) {
    throw new Error("index.html does not load the project's webfonts");
  }
  if (!html.includes("Sora") || !html.includes("Space+Grotesk")) {
    throw new Error(`index.html loads the wrong font families:\n${html}`);
  }
  console.log("OK: index.html loads the theme + per-element webfonts");

  /* ---------------- a 3D scene is a backdrop that hosts UI ---------------- */
  const sources = Object.entries(files).filter(([p]) => p.endsWith(".tsx"));
  const sceneEntry = sources.find(([, src]) => src.includes("zIndex: -1"));
  if (!sceneEntry) throw new Error("no generated component renders a 3D backdrop layer");
  const sceneSrc = sceneEntry[1];
  const layerAt = sceneSrc.indexOf("{/* 3D backdrop");
  if (layerAt < 0 || !sceneSrc.slice(0, layerAt).includes("<div className=")) {
    throw new Error("the 3D backdrop layer is not wrapped in the scene's own box");
  }
  const afterLayer = sceneSrc.slice(layerAt);
  const afterClose = afterLayer.slice(afterLayer.indexOf("</div>"));
  if (!/<h[1-6] /.test(afterClose)) {
    throw new Error("scene children are not emitted after the backdrop layer");
  }
  if (!sceneSrc.includes("ShaderBackground3D")) {
    throw new Error("the scene did not emit its effect runtime");
  }
  const sceneClass = sceneSrc.match(/<div className="([\w-]+)"[^>]*>\s*\n\s*\{\/\* 3D backdrop/);
  if (!sceneClass) throw new Error("could not read the scene's class name");
  if (!rule(sceneClass[1]).includes("isolation: isolate")) {
    throw new Error(`.${sceneClass[1]} is missing \`isolation: isolate\``);
  }
  console.log("OK: the 3D scene exports as a backdrop with UI stacked on top");

  fs.rmSync(target, { recursive: true, force: true });
  fs.mkdirSync(target, { recursive: true });
  for (const [p, content] of Object.entries(files)) {
    const full = path.join(target, p);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content.startsWith("base64:") ? Buffer.from(content.slice(7), "base64") : content);
  }
  console.log(`OK: wrote ${Object.keys(files).length} files to ${target}`);

  // Link frontel's node_modules so the TS check can resolve react/vite types.
  // The default target lives under frontel/node_modules/.cache, where module
  // resolution works without any link; keep the junction fallback for custom
  // --target runs on volumes that support reparse points.
  const nm = path.join(target, "node_modules");
  fs.rmSync(nm, { recursive: true, force: true });
  const underFrontelModules = target.startsWith(path.join(FRONTEL, "node_modules") + path.sep);
  if (!underFrontelModules) {
    if (process.platform === "win32") {
      const { execSync } = require("node:child_process");
      execSync(`cmd /c mklink /J "${nm}" "${path.join(FRONTEL, "node_modules")}"`, { stdio: "ignore" });
    } else {
      fs.symlinkSync(path.join(FRONTEL, "node_modules"), nm, "dir");
    }
  }

  // Real build gate: run the generated project's own `tsc -b` (as `npm run build` does).
  const { spawnSync } = require("node:child_process");
  const tscJs = path.join(FRONTEL, "node_modules", "typescript", "bin", "tsc");
  const run = spawnSync(process.execPath, [tscJs, "-b"], { cwd: target, encoding: "utf8" });
  const out = `${run.stdout ?? ""}${run.stderr ?? ""}`.trim();
  if (out) console.log(out.split("\n").slice(0, 12).join("\n"));
  const ok = run.status === 0;
  console.log(ok ? "BUILD OK: generated freeform project passes `tsc -b`" : `BUILD FAILED (exit ${run.status})`);
  process.exitCode = ok ? 0 : 1;
} finally {
  await server.close();
}
