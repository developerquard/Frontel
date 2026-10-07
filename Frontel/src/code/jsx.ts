/**
 * JSX emission — turns schema nodes into real React component source.
 *
 * Generated components use plain classNames + semantic tags; styles live in
 * styles.css, animations are driven by data-attributes handled in runtime.ts.
 */
import type { ElementNode, Project } from "@/schemas/types";
import { ICON_PATHS } from "@/lib/icons";
import { getEffect3D } from "@/schemas/effects3d";
import { getShaderDef } from "@/three/shaderBackgrounds";
import { assetUrlFor } from "./assets";
import { vantaOptionsLiteral } from "./effects3dTemplate";
import { pascal } from "./shared";

export interface EmitNode {
  imports: Set<string>;
  hooks: Set<string>;
  handlers: string[];
  /** True while emitting inside a <form>, where a button submits it. */
  inForm?: boolean;
  /** Project-level flags gathered during emission (read by the generator). */
  exportsVanta?: boolean;
  exportsShader?: boolean;
  /** Code constants (GLSL bodies) emitted before the component function. */
  prelude?: Set<string>;
}

export interface ComponentSpec {
  /** Component function name (PascalCase, unique). */
  name: string;
  /** Source code of the component file. */
  code: string;
}



function jsxText(text: string): string {
  return JSON.stringify(text);
}

/** Emits a JS template literal that safely embeds GLSL source. */
function emitTemplateLiteral(src: string): string {
  return "`" + src.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${") + "`";
}

/** Marker at the head of editor-side shader fragments (replaced by the generated runtime's own head). */
export const HEAD_MARKER = "__FE_SHADER_HEAD__";

/** Data attributes that the generated runtime (reveal/scroll fx) consumes. */
function fxDAttrs(node: ElementNode): string {
  const attrs: string[] = [];
  const a = node.animation;
  if (!a) return "";
  const reveal = ["fade", "fade-up", "fade-down", "slide-left", "slide-right", "zoom-in"].includes(a.type);
  if (reveal) attrs.push("data-reveal");
  if (a.type === "parallax") attrs.push(`data-parallax={${a.intensity ?? 0.4}}`);
  if (a.type === "background-transition" && a.colors) {
    attrs.push(`data-bg-from="${a.colors[0]}"`);
    attrs.push(`data-bg-to="${a.colors[1]}"`);
  }
  if (a.type === "scroll-progress") attrs.push("data-scroll-progress");
  return attrs.length ? " " + attrs.join(" ") : "";
}

function selfClose(tag: string, attrs: string): string {
  const a = attrs.replace(/\s+/g, " ").trim();
  return a ? `<${tag} ${a} />` : `<${tag} />`;
}

export function emitNodeJsx(
  node: ElementNode,
  project: Project,
  classMap: Map<string, string>,
  ctx: EmitNode,
  indent: number,
): string {
  const pad = "  ".repeat(indent);
  const cls = classMap.get(node.id);
  const clsAttr = cls ? `className="${cls}"` : "";
  const fx = fxDAttrs(node);
  const anchorAttr = node.anchorId ? ` data-fe-anchor="${node.anchorId}"` : "";

  const kids = (extraIndent = 0) =>
    node.children
      .map((cid) => {
        const child = project.nodes[cid];
        return child ? emitNodeJsx(child, project, classMap, ctx, indent + 1 + extraIndent) : null;
      })
      .filter(Boolean)
      .join("\n");

  switch (node.type) {
    case "section":
      return `${pad}<section ${clsAttr}${anchorAttr}${fx}>\n${kids()}\n${pad}</section>`;
    case "container":
    case "flex":
    case "grid":
    case "stack":
      return `${pad}<div ${clsAttr}${fx}>\n${kids()}\n${pad}</div>`;
    case "heading":
      return `${pad}<h${node.props.level ?? 2} ${clsAttr}${fx}>{${jsxText(node.props.text ?? "")}}</h${node.props.level ?? 2}>`;
    case "text":
      return `${pad}<p ${clsAttr}${fx}>{${jsxText(node.props.text ?? "")}}</p>`;
    case "image":
    case "gif": {
      const src = assetUrlFor(node.props.assetId, project);
      const alt = node.props.alt ?? "";
      return selfClose("img", `${clsAttr} src="${src}" alt="${alt.replace(/"/g, "&quot;")}" ${fx}`);
    }
    case "video": {
      const src = assetUrlFor(node.props.assetId, project);
      const attrs = [
        clsAttr,
        `src="${src}"`,
        node.props.controls !== false ? "controls" : "",
        node.props.autoplay ? "autoPlay" : "",
        node.props.loop ? "loop" : "",
        node.props.muted !== false ? "muted" : "",
        "playsInline",
        fx,
      ]
        .filter(Boolean)
        .join(" ");
      return selfClose("video", attrs);
    }
    case "icon": {
      const d = ICON_PATHS[node.props.icon ?? "spark"] ?? ICON_PATHS["spark"];
      return selfClose("svg", `${clsAttr} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"${fx}`)
        .replace("<svg ", "<svg width={24} height={24} ")
        .replace(/ \/>$/, `>\n${pad}  <path d="${d}" />\n${pad}</svg>`);
    }
    case "logo": {
      const label = node.props.label
        ? `\n${pad}  <span style={{ fontSize: 17, fontWeight: 700 }}>${node.props.label}</span>`
        : "";
      return `${pad}<span className="${cls ?? ""}" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
${pad}  <svg width={28} height={28} viewBox="0 0 24 24" fill="none">
${pad}    <rect x="2" y="2" width="20" height="20" rx="6" fill="var(--fe-primary)" />
${pad}    <path d="M7 17V7l10 10V7" stroke="var(--fe-primary-contrast)" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
${pad}  </svg>${label}
${pad}</span>`;
    }
    case "button": {
      const onClick = node.onClick;
      let handler = "";
      if (onClick?.kind === "navigate") {
        ctx.imports.add("react-router-dom:useNavigate");
        ctx.hooks.add("const navigate = useNavigate();");
        handler = ` onClick={() => navigate("${onClick.path}")}`;
      } else if (onClick?.kind === "open-url") {
        handler = ` onClick={() => window.open("${onClick.url}", "_blank", "noopener")}`;
      } else if (onClick?.kind === "scroll-to") {
        handler = ` onClick={() => document.querySelector('[data-fe-anchor="${onClick.anchorId}"]')?.scrollIntoView({ behavior: "smooth" })}`;
      }
      return `${pad}<button type="${ctx.inForm ? "submit" : "button"}" ${clsAttr}${handler}${fx}>{${jsxText(node.props.label ?? "Button")}}</button>`;
    }
    case "link": {
      const onClick = node.onClick;
      if (onClick?.kind === "navigate") {
        ctx.imports.add("react-router-dom:Link");
        return `${pad}<Link to="${onClick.path}" ${clsAttr}${fx}>{${jsxText(node.props.label ?? "Link")}}</Link>`;
      }
      const href = node.props.href ?? "#";
      const external = /^https?:/i.test(href);
      const target = external ? ' target="_blank" rel="noopener noreferrer"' : "";
      return `${pad}<a href="${href}"${target} ${clsAttr}${fx}>{${jsxText(node.props.label ?? "Link")}}</a>`;
    }
    case "input":
      return selfClose(
        "input",
        `${clsAttr} type="${node.props.inputType ?? "text"}" name="${slugName(node.props.label)}" placeholder="${(node.props.placeholder ?? "").replace(/"/g, "&quot;")}"${node.props.required ? " required" : ""}${fx}`,
      );
    case "select": {
      const options = (node.props.options ?? [])
        .map((o) => `${pad}  <option value="${o}">${o}</option>`)
        .join("\n");
      return `${pad}<select ${clsAttr} name="${slugName(node.props.label)}"${fx}>
${options}
${pad}</select>`;
    }
    case "checkbox":
      return `${pad}<label ${clsAttr}${fx}>
${pad}  <input type="checkbox" name="${slugName(node.props.label)}" />
${pad}  <span>${node.props.label ?? "Checkbox"}</span>
${pad}</label>`;
    case "divider":
      return `${pad}<div ${clsAttr}${fx} />`;
    case "scene3d":
      // A scene is a backdrop layer inside its own box, so children stack on
      // top of it (mirrors SceneNode in the live renderer).
      return scene3dWrapper(node, project, classMap, ctx, indent, scene3dTag(node, project, ctx));
    case "form": {
      const action = node.props.action;
      let handlerDecl = "";
      let onSubmitAttr = "";
      if (action && action.kind === "submit-api") {
        ctx.imports.add("react:useState");
        handlerDecl = `  const [status, setStatus] = useState<"idle" | "sending" | "error" | "done">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    setStatus("sending");
    try {
      const res = await fetch("${action.url}", {
        method: "${action.method}",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(\`Request failed with status \${res.status}\`);
      setStatus("done");
      setMessage("Request succeeded.");
      form.reset();
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Request failed.");
    }
  }`;
        onSubmitAttr = ' onSubmit={handleSubmit}';
      } else if (action && action.kind === "navigate") {
        ctx.imports.add("react-router-dom:useNavigate");
        ctx.hooks.add("const navigate = useNavigate();");
        onSubmitAttr = ' onSubmit={(e) => { e.preventDefault(); navigate("' + action.path + '"); }}';
      }
      if (handlerDecl) ctx.handlers.push(handlerDecl);
      // Form children are emitted with the in-form flag, so a button inside the
      // form becomes type="submit" and can actually send it.
      const formCtx: EmitNode = { ...ctx, inForm: true };
      const formKids = node.children
        .map((cid) => {
          const child = project.nodes[cid];
          return child ? emitNodeJsx(child, project, classMap, formCtx, indent + 1) : null;
        })
        .filter(Boolean)
        .join("\n");
      const statusLine = action?.kind === "submit-api"
        ? `\n${pad}  {message && <p className="form-status" data-status={status}>{message}</p>}`
        : "";
      return `${pad}<form${onSubmitAttr} ${clsAttr}${fx} noValidate>
${formKids}${statusLine}
${pad}</form>`;
    }
    default:
      return `${pad}<div ${clsAttr}${fx}>\n${kids()}\n${pad}</div>`;
  }
}

/**
 * The scene runtime tag for a scene3d node — no wrapper, no indentation.
 * Preset effects emit the self-contained VantaBackground3D /
 * ShaderBackground3D components, custom GLSL emits ShaderBackground3D with the
 * user's fragment body, and everything else is the three.js stage.
 */
function scene3dTag(node: ElementNode, project: Project, ctx: EmitNode): string {
  const c = node.scene3d;
  const mode = c?.mode ?? (c?.effectId ? "effect" : "shape");

  if (mode === "effect" && c?.effectId) {
    const preset = getEffect3D(c.effectId);
    if (preset?.family === "vanta") {
      ctx.imports.add("./VantaBackground3D:VantaBackground3D");
      ctx.exportsVanta = true;
      const intColorKeys = new Set(preset.params.filter((p) => p.kind === "color" && p.intColor).map((p) => p.key));
      const opts = vantaOptionsLiteral({ ...preset.defaults, ...(c.effectParams ?? {}) }, intColorKeys);
      return selfClose("VantaBackground3D", `effect="${preset.vantaEffect}" options={${opts}}`);
    }
    if (preset?.family === "shader") {
      ctx.imports.add("./ShaderBackground3D:ShaderBackground3D");
      ctx.exportsShader = true;
      const glsl = getShaderDef(preset.shaderId ?? "")?.fragment;
      const constName = `SHADER_${(preset.shaderId ?? "fx").toUpperCase().replace(/-/g, "_")}`;
      if (glsl) ctx.prelude?.add(`${constName} = ${emitTemplateLiteral(glsl.replace(HEAD_MARKER, ""))}`);
      const p = { ...preset.defaults, ...(c.effectParams ?? {}) };
      const props = [
        `colorA="${p.colorA ?? "#2dd4bf"}"`,
        `colorB="${p.colorB ?? "#0396ff"}"`,
        `colorC="${p.colorC ?? "#020014"}"`,
        `speed={${p.speed ?? 1}}`,
        `zoom={${p.zoom ?? 1}}`,
      ].join(" ");
      return selfClose("ShaderBackground3D", `code={${constName}} ${props}`);
    }
    if (preset?.family === "objects") {
      ctx.imports.add("./Scene3D:Scene3D");
      const p = { ...preset.defaults, ...(c.effectParams ?? {}) };
      const props = [
        `shape="${c.shape ?? "torus-knot"}"`,
        `color="${p.color ?? "#2dd4bf"}"`,
        `rotationSpeed={${p.rotationSpeed ?? 0.4}}`,
        `floatAmplitude={${p.floatAmplitude ?? 0.25}}`,
        `cameraDistance={${p.cameraDistance ?? 5}}`,
        `scrollInfluence={0.3}`,
        `wireframe={false}`,
      ].join(" ");
      return selfClose("Scene3D", props);
    }
  }

  if (mode === "shader" && c?.shaderCode) {
    ctx.imports.add("./ShaderBackground3D:ShaderBackground3D");
    ctx.exportsShader = true;
    ctx.prelude?.add(`SHADER_CUSTOM = ${emitTemplateLiteral(c.shaderCode)}`);
    return selfClose("ShaderBackground3D", "code={SHADER_CUSTOM}");
  }

  ctx.imports.add("./Scene3D:Scene3D");
  const modelAsset = c?.modelAssetId ? project.assets[c.modelAssetId] : undefined;
  const modelUrl = modelAsset ? assetUrlFor(modelAsset.id, project) : "";
  const props = [
    `shape="${c?.shape ?? "torus-knot"}"`,
    modelUrl ? `modelUrl="${modelUrl}"` : "",
    modelUrl ? `modelScale={${c?.modelScale ?? 1}}` : "",
    `color="${c?.color ?? "#2dd4bf"}"`,
    `rotationSpeed={${c?.rotationSpeed ?? 0.4}}`,
    `floatAmplitude={${c?.floatAmplitude ?? 0.25}}`,
    `cameraDistance={${c?.cameraDistance ?? 5}}`,
    `scrollInfluence={${c?.scrollInfluence ?? 0.3}}`,
    `wireframe={${c?.wireframe ?? false}}`,
  ]
    .filter(Boolean)
    .join(" ");
  return selfClose("Scene3D", props);
}

/**
 * Wraps a scene tag in the node's own box: the scene becomes a backdrop layer
 * and the node's children are emitted after it, so they render on top.
 */
function scene3dWrapper(
  node: ElementNode,
  project: Project,
  classMap: Map<string, string>,
  ctx: EmitNode,
  indent: number,
  tag: string,
): string {
  const pad = "  ".repeat(indent);
  const inner = `${pad}  `;
  const cls = classMap.get(node.id);
  const clsAttr = cls ? `className="${cls}"` : "";
  const anchorAttr = node.anchorId ? ` data-fe-anchor="${node.anchorId}"` : "";
  const kids = node.children
    .map((cid) => {
      const child = project.nodes[cid];
      return child ? emitNodeJsx(child, project, classMap, ctx, indent + 1) : null;
    })
    .filter(Boolean)
    .join("\n");
  return [
    `${pad}<div ${clsAttr}${anchorAttr}${fxDAttrs(node)}>`,
    `${inner}{/* 3D backdrop — everything below sits on top of it */}`,
    `${inner}<div style={{ position: "absolute", inset: 0, zIndex: -1, overflow: "hidden", borderRadius: "inherit" }}>`,
    `${inner}  ${tag}`,
    `${inner}</div>`,
    ...(kids ? [kids] : []),
    `${pad}</div>`,
  ].join("\n");
}

function slugName(label: string | undefined): string {
  if (!label) return "field";
  return (
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "field"
  );
}

/** Builds one generated component file from a top-level node. */
export function emitComponent(
  node: ElementNode,
  project: Project,
  classMap: Map<string, string>,
  componentName: string,
): ComponentSpec {
  const ctx: EmitNode = { imports: new Set(), hooks: new Set(), handlers: [], prelude: new Set() };
  const body = emitNodeJsx(node, project, classMap, ctx, 2);

  const importLines: string[] = [];
  const reactImports = new Set<string>();
  const routerImports = new Set<string>();
  for (const imp of ctx.imports) {
    const [from, name] = imp.split(":");
    if (from === "react") reactImports.add(name);
    else if (from === "react-router-dom") routerImports.add(name);
    else importLines.push(`import { ${name} } from "${from}";`);
  }
  if (reactImports.size) importLines.unshift(`import { ${[...reactImports].sort().join(", ")} } from "react";`);
  if (routerImports.size) importLines.push(`import { ${[...routerImports].sort().join(", ")} } from "react-router-dom";`);

  const prelude = ctx.prelude ?? new Set<string>();
  const code = `${importLines.join("\n")}
${[...prelude].map((p) => `const ${p};`).join("\n")}${prelude.size ? "\n\n" : ""}
export function ${componentName}() {
${[...ctx.hooks].map((h) => `  ${h}`).join("\n")}
${ctx.handlers.join("\n")}
  return (
${body}
  );
}
`;
  return { name: componentName, code };
}

/** Unique component name allocator per project. */
export function componentNameAllocator(): (base: string) => string {
  const taken = new Set<string>(["App", "Main", "Scene3D"]);
  return (raw: string) => {
    let name = pascal(raw) || "Component";
    let i = 2;
    while (taken.has(name)) name = `${pascal(raw)}${i++}`;
    taken.add(name);
    return name;
  };
}
