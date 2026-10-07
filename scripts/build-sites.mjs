/**
 * Builds the showcase sites out of the Frontel schema and verifies them.
 *
 * For every site in ../../frontel/src/sites it:
 *   1. generates the project with the app's real code generator
 *   2. writes `sites/<slug>/project.frontel.json` — the file Frontel imports
 *      (Home → Import project…), so the site stays fully editable in the editor
 *   3. re-parses that JSON with the app's own importer (parseProjectJson) to
 *      prove it loads back into Frontel unchanged
 *   4. writes the generated React + TypeScript site to `sites/<slug>/site`
 *   5. typechecks it (`tsc -b`) and production-builds it (`vite build`) in a
 *      sibling directory under frontel/node_modules/.cache, where react, three
 *      and vanta resolve through the normal directory walk-up
 *
 * Nothing in the app is modified: this only reads ./src and writes ./sites.
 *
 * Usage:  node scripts/build-sites.mjs [--skip-build]
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const HERE = import.meta.dirname;
const ROOT = path.resolve(HERE, "..");
const FRONTEL = path.join(ROOT, "frontel");
const OUT = path.join(ROOT, "sites");
const CACHE = path.join(FRONTEL, "node_modules", ".cache", "site-build");
const skipBuild = process.argv.includes("--skip-build");

const require = createRequire(path.join(FRONTEL, "package.json"));
const { createServer, build: viteBuild } = require("vite");

const server = await createServer({
  root: FRONTEL,
  logLevel: "error",
  server: { middlewareMode: true },
  optimizeDeps: { noDiscovery: true, include: [] },
});

/** Writes a generated file map to disk, decoding base64 asset payloads. */
function writeFiles(dest, files) {
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(dest, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(
      full,
      content.startsWith("base64:") ? Buffer.from(content.slice(7), "base64") : content,
    );
  }
}

function copyTree(src, dest) {
  fs.rmSync(dest, { recursive: true, force: true });
  fs.cpSync(src, dest, {
    recursive: true,
    filter: (p) => !/[\\/](node_modules|dist|\.cache)([\\/]|$)/.test(p),
  });
}

const failures = [];

try {
  const { SHOWCASE_SITES } = await server.ssrLoadModule("/src/sites/index.ts");
  const { generateProjectFiles } = await server.ssrLoadModule("/src/code/generator.ts");
  const { parseProjectJson } = await server.ssrLoadModule("/src/lib/exporters.ts");

  fs.mkdirSync(OUT, { recursive: true });

  for (const site of SHOWCASE_SITES) {
    const { project, slug } = site;
    const nodes = Object.values(project.nodes);
    const scenes = nodes.filter((n) => n.type === "scene3d");
    const effects = new Set(scenes.map((n) => n.scene3d?.effectId).filter(Boolean));
    const animated = nodes.filter((n) => n.animation);
    const free = nodes.filter((n) => n.style.base.position === "absolute");

    console.log(`\n── ${site.name} (${slug})`);
    console.log(`   ${project.pages.length} pages: ${site.pages.join("  ")}`);
    console.log(`   ${nodes.length} nodes · ${animated.length} animations · ${effects.size} live 3D effects`);
    for (const id of effects) console.log(`     3D: ${id}`);

    // 1 + 2. the generated project, and the importable Frontel file.
    const files = generateProjectFiles(project);
    const json = JSON.stringify(project, null, 2);
    const siteOut = path.join(OUT, slug);
    fs.mkdirSync(siteOut, { recursive: true });
    fs.writeFileSync(path.join(siteOut, "project.frontel.json"), json);

    // 3. the app's own importer must accept it, with every route intact.
    const reparsed = parseProjectJson(json);
    const wantPaths = project.pages.map((p) => p.path).join("|");
    const gotPaths = reparsed.pages.map((p) => p.path).join("|");
    if (wantPaths !== gotPaths) {
      throw new Error(`${slug}: import round-trip lost pages (${gotPaths} vs ${wantPaths})`);
    }
    if (Object.keys(reparsed.nodes).length !== nodes.length) {
      throw new Error(`${slug}: import round-trip lost nodes`);
    }
    console.log(`   OK: project.frontel.json re-imports (${reparsed.pages.length} routes)`);

    // 4. write the generated site next to it.
    const siteDest = path.join(siteOut, "site");
    writeFiles(siteDest, files);
    console.log(`   OK: wrote ${Object.keys(files).length} generated files to sites/${slug}/site`);

    if (skipBuild) continue;

    // 5. typecheck + production build, in a place where node_modules resolves.
    const buildDir = path.join(CACHE, slug);
    copyTree(siteDest, buildDir);

    const tsc = path.join(FRONTEL, "node_modules", "typescript", "bin", "tsc");
    const tscRun = spawnSync(process.execPath, [tsc, "-b"], { cwd: buildDir, encoding: "utf8" });
    const tscOut = `${tscRun.stdout ?? ""}${tscRun.stderr ?? ""}`.trim();
    if (tscOut) console.log(tscOut.split("\n").slice(0, 10).join("\n"));
    if (tscRun.status !== 0) {
      failures.push(`${slug}: tsc -b failed`);
      console.log(`   FAILED: tsc -b (exit ${tscRun.status})`);
      continue;
    }
    console.log("   OK: tsc -b clean");

    const result = await viteBuild({
      root: buildDir,
      logLevel: "error",
      build: { outDir: "dist", emptyOutDir: true },
    });
    const outputs = Array.isArray(result) ? result : [result];
    const bytes = outputs
      .flatMap((o) => ("output" in o ? o.output : []))
      .reduce((sum, chunk) => sum + (chunk.type === "asset" || chunk.type === "chunk" ? chunk.code?.length ?? 0 : 0), 0);
    console.log(`   OK: vite build produced ${(bytes / 1024).toFixed(1)} KB of assets`);
  }

  if (failures.length) {
    console.error(`\n${failures.length} site(s) failed:\n  ${failures.join("\n  ")}`);
    process.exitCode = 1;
  } else {
    console.log(`\nAll ${SHOWCASE_SITES.length} showcase sites built and verified.`);
  }
} finally {
  await server.close();
}
