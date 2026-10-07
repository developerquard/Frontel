/**
 * Code generator — the schema's second pure consumer.
 *
 * Deterministic function: Project → FileMap of a complete, runnable,
 * multi-page Vite + React + TypeScript project. The renderer and this
 * generator read the same schema; neither can drift from the other.
 */
import type { Project } from "@/schemas/types";
import { buildClassMap, generateCss } from "./cssgen";
import { emitComponent, componentNameAllocator } from "./jsx";
import { pascal } from "./shared";
import { assetExportPath, bytesToBase64, dataUrlBase64, dataUrlToBytes } from "./assets";
import { SCENE3D_TEMPLATE, RUNTIME_TEMPLATE } from "./scene3dTemplate";
import { fontsUsedBy, googleFontsHref } from "@/schemas/fonts";
import { VANTA_BG_3D_TEMPLATE, SHADER_BG_3D_TEMPLATE } from "./effects3dTemplate";

export type FileMap = Record<string, string>;

function sanitizePath(p: string): string {
  const clean = p === "/" ? "" : p.replace(/\/+$/, "");
  return clean || "";
}

/** True if any node in the project uses a 3D scene or API form. */
function projectUses3D(project: Project): boolean {
  return Object.values(project.nodes).some((n) => n.type === "scene3d");
}

/** True if any scene node uses a vanta-family effect. */
function projectUsesVanta(project: Project): boolean {
  return Object.values(project.nodes).some(
    (n) =>
      n.type === "scene3d" &&
      (n.scene3d?.mode ?? (n.scene3d?.effectId ? "effect" : "shape")) === "effect" &&
      n.scene3d?.effectId?.startsWith("vanta-"),
  );
}

/** True if any scene node uses a GLSL shader (preset or custom). */
function projectUsesShader(project: Project): boolean {
  return Object.values(project.nodes).some((n) => {
    if (n.type !== "scene3d") return false;
    const mode = n.scene3d?.mode ?? (n.scene3d?.effectId ? "effect" : "shape");
    if (mode === "shader") return true;
    return mode === "effect" && !!n.scene3d?.effectId && !n.scene3d.effectId.startsWith("vanta-") && n.scene3d.effectId !== "obj-torus" && n.scene3d.effectId !== "obj-crystal";
  });
}



export function generateProjectFiles(project: Project): FileMap {
  const files: FileMap = {};
  const classMap = buildClassMap(project);
  const alloc = componentNameAllocator();

  /* ---------------- per-page components ---------------- */
  const pageComponents: { pagePath: string; componentName: string }[] = [];

  for (const page of project.pages) {
    const root = project.nodes[page.rootId];
    if (!root) continue;
    const pageName = `${pascal(page.name)}Page`;
    const sections = root.children.map((cid) => {
      const node = project.nodes[cid];
      if (!node) return null;
      const compName = alloc(node.name);
      const spec = emitComponent(node, project, classMap, compName);
      files[`src/components/${compName}.tsx`] = spec.code;
      return { compName };
    });
    const valid = sections.filter(Boolean) as { compName: string }[];
    const importLines = valid.map((s) => `import { ${s.compName} } from "../components/${s.compName}";`);
    const jsxLines = valid.map((s) => `      <${s.compName} />`);

    files[`src/pages/${pageName}.tsx`] = `${importLines.join("\n")}

export function ${pageName}() {
  return (
    <>
${jsxLines.join("\n")}
    </>
  );
}
`;
    pageComponents.push({ pagePath: sanitizePath(page.path), componentName: pageName });
  }

  /* ---------------- App + routing ---------------- */
  const routes = pageComponents
    .map(
      (p) =>
        `        <Route path="${p.pagePath || "/"}" element={<${p.componentName} />} />`,
    )
    .join("\n");

  const nav = project.pages.length > 1 ? `        <Route path="*" element={<NotFound />} />` : "";
  const notFoundComp = `
function NotFound() {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "var(--fe-font)" }}>
      <div style={{ textAlign: "center" }}>
        <h1 style={{ fontSize: 42, fontWeight: 800 }}>404</h1>
        <p style={{ color: "var(--fe-muted)" }}>This page does not exist.</p>
      </div>
    </main>
  );
}
`;

  files["src/App.tsx"] = `import { Routes, Route } from "react-router-dom";
${pageComponents
  .map((p) => `import { ${p.componentName} } from "./pages/${p.componentName}";`)
  .join("\n")}

export default function App() {
  return (
    <Routes>
${routes}
${nav}
    </Routes>
  );
}
${nav ? notFoundComp : ""}
`;

  /* ---------------- main.tsx + index.html ---------------- */
  files["src/main.tsx"] = `import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
`;

  // Runtime hook component (reveal/parallax/scroll fx) if any animation exists.
  const hasRuntimeFx = Object.values(project.nodes).some((n) => {
    const a = n.animation;
    return a && (a.type === "parallax" || a.type === "background-transition" || a.type === "scroll-progress" || ["fade","fade-up","fade-down","slide-left","slide-right","zoom-in"].includes(a.type));
  });

  if (hasRuntimeFx) {
    files["src/runtime.ts"] = RUNTIME_TEMPLATE;
    files["src/main.tsx"] = files["src/main.tsx"]
      .replace('import App from "./App";', 'import App from "./App";\nimport { useFrontelRuntime } from "./runtime";')
      .replace(
        "      <App />",
        `      <App />\n      <RuntimeBridge />`,
      );
    files["src/main.tsx"] += `
function RuntimeBridge() {
  useFrontelRuntime();
  return null;
}
`;
  }

  if (projectUses3D(project)) {
    files["src/components/Scene3D.tsx"] = SCENE3D_TEMPLATE;
  }
  if (projectUsesVanta(project)) {
    files["src/components/VantaBackground3D.tsx"] = VANTA_BG_3D_TEMPLATE;
  }
  if (projectUsesShader(project)) {
    files["src/components/ShaderBackground3D.tsx"] = SHADER_BG_3D_TEMPLATE;
  }

  /* ---------------- styles.css ---------------- */
  const theme = project.theme;
  files["src/styles.css"] = `${generateCss(project, classMap)}

:root {
  --fe-bg: ${theme.colors.background};
  --fe-surface: ${theme.colors.surface};
  --fe-text: ${theme.colors.text};
  --fe-muted: ${theme.colors.textMuted};
  --fe-primary: ${theme.colors.primary};
  --fe-primary-contrast: ${theme.colors.primaryContrast};
  --fe-border: ${theme.colors.border};
  --fe-radius: ${theme.radius}px;
  --fe-font: ${theme.font};
}

body {
  margin: 0;
  background: var(--fe-bg);
  color: var(--fe-text);
  font-family: var(--fe-font);
  -webkit-font-smoothing: antialiased;
}

* { box-sizing: border-box; }

img, video { max-width: 100%; }

button, input, select, textarea { font-family: inherit; }

.form-status[data-status="error"] { color: #f87171; }
.form-status[data-status="done"] { color: var(--fe-primary); }
.form-status[data-status="sending"] { color: var(--fe-muted); }

/* Generated by Frontel — schema version ${project.version} */
`;

  /* ---------------- index.html ---------------- */
  // Real webfonts for the theme typeface plus any per-element font override,
  // so the export renders in the same faces the editor did.
  const fontsHref = googleFontsHref(fontsUsedBy(project));
  const fontLinks = fontsHref
    ? `    <link rel="preconnect" href="https://fonts.googleapis.com" />\n    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />\n    <link rel="stylesheet" href="${fontsHref}" />\n`
    : "";
  files["index.html"] = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${project.name}</title>
${fontLinks}  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;

  /* ---------------- package.json / tsconfig / vite ---------------- */
  const uses3d = projectUses3D(project);
  const usesVanta = projectUsesVanta(project);
  const deps: Record<string, string> = {
    react: "^19.1.0",
    "react-dom": "^19.1.0",
    "react-router-dom": "^7.1.5",
  };
  if (uses3d) deps.three = "^0.182.0";
  if (usesVanta) deps.vanta = "^0.5.24";

  files["package.json"] = JSON.stringify(
    {
      name: slugSafe(project.name),
      private: true,
      version: "0.1.0",
      type: "module",
      scripts: {
        dev: "vite",
        build: "tsc -b && vite build",
        preview: "vite preview",
      },
      dependencies: deps,
      devDependencies: {
        "@types/react": "^19.1.8",
        "@types/react-dom": "^19.1.6",
        ...(uses3d ? { "@types/three": "^0.182.0" } : {}),
        "@vitejs/plugin-react": "^5.0.0",
        typescript: "~5.8.3",
        vite: "^7.1.2",
      },
    },
    null,
    2,
  );

  files["tsconfig.json"] = JSON.stringify(
    {
      files: [],
      references: [
        { path: "./tsconfig.app.json" },
        { path: "./tsconfig.node.json" },
      ],
    },
    null,
    2,
  );

  files["tsconfig.app.json"] = JSON.stringify(
    {
      compilerOptions: {
        tsBuildInfoFile: "./node_modules/.tmp/tsconfig.app.tsbuildinfo",
        target: "ES2023",
        lib: ["ES2023", "DOM", "DOM.Iterable"],
        module: "ESNext",
        moduleResolution: "bundler",
        jsx: "react-jsx",
        strict: true,
        noEmit: true,
        skipLibCheck: true,
        noUnusedLocals: true,
        noUnusedParameters: true,
        noFallthroughCasesInSwitch: true,
        types: ["vite/client"],
      },
      include: ["src"],
    },
    null,
    2,
  );

  files["tsconfig.node.json"] = JSON.stringify(
    {
      compilerOptions: {
        target: "ES2023",
        lib: ["ES2023"],
        module: "ESNext",
        moduleResolution: "bundler",
        skipLibCheck: true,
        allowSyntheticDefaultImports: true,
        strict: true,
        noEmit: true,
        types: ["node"],
      },
      include: ["vite.config.ts"],
    },
    null,
  );

  files["vite.config.ts"] = `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
});
`;

  // vanta ships its vendored three/p5 bundles as plain .js with no type
  // declarations. The generated project is strict TypeScript, so declare them:
  // without this the exported project's own `npm run build` (tsc -b) fails with
  // TS7016 the moment a project uses any vanta background effect.
  if (usesVanta) {
    files["src/vendor.d.ts"] = `declare module "vanta/vendor/three.r134.min.js";
declare module "vanta/vendor/p5.min.js";
`;
  }

  files["README.md"] = `# ${project.name}

Generated by **Frontel** — built visually, exported as real code.

## Run

\`\`\`bash
npm install
npm run dev
\`\`\`

## Structure

\`\`\`
src/
├── main.tsx        entry point (BrowserRouter)
├── App.tsx         routes
├── pages/          one component per project page
├── components/     one component per top-level section
├── Scene3D.tsx     3D scene runtime (three.js)${uses3d ? "" : " (present only when used)"}
${usesVanta ? "├── VantaBackground3D.tsx  vanta.js background effect runtime\n├── vendor.d.ts     ambient types for vanta's vendored bundles\n" : ""}${projectUsesShader(project) ? "├── ShaderBackground3D.tsx  custom GLSL background runtime\n" : ""}└── styles.css      all styling incl. responsive rules
\`\`\`

## Pages

${pageComponents.map((p) => `- \`/${p.pagePath}\` → \`${p.componentName}\``).join("\n")}

This project is plain Vite + React + TypeScript. It has no dependency on the
Frontel editor and can be modified like any hand-written frontend.
`;

  /* ---------------- assets ---------------- */
  for (const asset of Object.values(project.assets)) {
    const path = assetExportPath(asset);
    // Uploads are stored as base64 data URLs: emit the payload as-is rather
    // than decoding and re-encoding it (which overflowed the stack on large
    // images and took Export and the Source panel down with it).
    const direct = dataUrlBase64(asset.src);
    if (direct) {
      files[path] = `base64:${direct}`;
      continue;
    }
    const data = dataUrlToBytes(asset.src);
    if (data) {
      // Binary assets are stored as base64 in the FileMap and encoded on export.
      files[path] = `base64:${bytesToBase64(data.bytes)}`;
      continue;
    }
    if (/^https?:/i.test(asset.src)) continue; // remote assets need no file
    files[path] = asset.src;
  }

  return files;
}

function slugSafe(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "frontel-project"
  );
}

/** Combined export used by Source panel + zip export. */
export function generateProjectBundle(project: Project): { files: FileMap } {
  return { files: generateProjectFiles(project) };
}
