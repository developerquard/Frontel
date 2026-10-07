/**
 * End-to-end export verification:
 *   factory + section presets → real generator → real project on disk
 * Loads the actual src modules via Vite SSR so `@/` aliases resolve exactly
 * as they do in the app. Vite is resolved from frontel/node_modules.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const HERE = import.meta.dirname;
const FRONTEL = path.resolve(HERE, "..", "frontel");
const target = process.argv[2] ?? path.resolve(HERE, "..", ".freebuff", "export-test");

const require = createRequire(path.join(FRONTEL, "package.json"));
const { createServer } = await import(pathToFileURL(require.resolve("vite", { paths: [FRONTEL] })));

const server = await createServer({
  root: FRONTEL,
  logLevel: "error",
  server: { middlewareMode: true },
  appType: "custom",
});

try {
  const { makeScratchProject } = await server.ssrLoadModule("/src/schemas/factory.ts");
  const { buildSection } = await server.ssrLoadModule("/src/schemas/sections.ts");
  const { generateProjectFiles } = await server.ssrLoadModule("/src/code/generator.ts");

  // Simulate a real user session: empty page → add Navbar, Hero (with an
  // action + edited text), Features, CTA (anchored), Footer.
  const project = makeScratchProject("Verify Export");
  const page = project.pages[0];
  const root = project.nodes[page.rootId];

  const addSection = (preset) => {
    const { nodes, rootId } = buildSection(preset, project.nodes);
    Object.assign(project.nodes, nodes);
    root.children.push(rootId);
    return rootId;
  };

  addSection("navbar");
  const heroId = addSection("hero");
  addSection("features");
  const ctaSectionId = addSection("cta");
  addSection("footer");

  // Edit like the inspector would.
  const hero = project.nodes[heroId];
  const headingId = hero.children[0];
  project.nodes[headingId].props.text = "Ship sites at lightning speed";
  const actionsId = hero.children[2];
  const primaryCtaId = project.nodes[actionsId].children[0];
  project.nodes[primaryCtaId].onClick = { kind: "scroll-to", anchorId: "cta" };
  project.nodes[ctaSectionId].anchorId = "cta";

  const files = generateProjectFiles(project);
  fs.rmSync(target, { recursive: true, force: true });
  for (const [p, content] of Object.entries(files)) {
    const full = path.join(target, p);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }
  console.log(`OK: wrote ${Object.keys(files).length} files to ${target}`);
  const home = files["src/pages/HomePage.tsx"];
  console.log("sections:", home.match(/import \{ (\w+) \}/g).join(", "));
  console.log("action:", /onClick=\{[^}]*\}/.exec(files["src/components/Hero.tsx"])?.[0] ?? "none");
} finally {
  await server.close();
}
