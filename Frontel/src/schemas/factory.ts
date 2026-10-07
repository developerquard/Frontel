import {
  DEFAULT_SCENE_3D,
  type ElementNode,
  type ElementProps,
  type ElementType,
  type NodeId,
  type Page,
  type Project,
  type ProjectTheme,
  type StyleProps,
} from "./types";

let counter = 0;
export function uid(prefix = "n"): string {
  counter += 1;
  return `${prefix}${Date.now().toString(36)}${counter.toString(36)}`;
}

export const DEFAULT_THEME: ProjectTheme = {
  colors: {
    background: "#0c0e13",
    surface: "#141822",
    text: "#e6eaf4",
    textMuted: "#8b93a9",
    primary: "#2dd4bf",
    primaryContrast: "#05201c",
    border: "#262d3e",
  },
  font: "Inter, ui-sans-serif, system-ui, sans-serif",
  radius: 10,
};

/** Default style applied when an element is created. */
export function defaultStyle(type: ElementType): StyleProps {
  switch (type) {
    case "section":
      return {
        display: "flex",
        flexDirection: "column",
        justify: "center",
        align: "center",
        padding: [96, 24, 96, 24],
        width: { kind: "fill" },
        height: { kind: "auto" },
        background: "#0c0e13",
      };
    case "container":
      return {
        display: "flex",
        flexDirection: "column",
        width: { kind: "fixed", value: 1120, unit: "px" },
        maxWidth: 1120,
      };
    case "flex":
      return {
        display: "flex",
        flexDirection: "row",
        justify: "flex-start",
        align: "center",
        gap: 16,
        wrap: true,
      };
    case "stack":
      return {
        display: "flex",
        flexDirection: "column",
        justify: "flex-start",
        align: "stretch",
        gap: 16,
      };
    case "grid":
      return {
        display: "grid",
        gridColumns: 3,
        gap: 24,
      };
    case "heading":
      return {
        fontSize: 48,
        fontWeight: 800,
        lineHeight: 1.1,
        letterSpacing: -1,
        color: "#e6eaf4",
        textAlign: "center",
      };
    case "text":
      return {
        fontSize: 17,
        fontWeight: 400,
        lineHeight: 1.65,
        color: "#8b93a9",
        textAlign: "center",
      };
    case "image":
    case "gif":
      return {
        width: { kind: "fixed", value: 480, unit: "px" },
        height: { kind: "auto" },
        borderRadius: 12,
        objectFit: "cover",
        opacity: 1,
      };
    case "video":
      return {
        width: { kind: "fill" },
        height: { kind: "auto" },
        borderRadius: 12,
        objectFit: "cover",
      };
    case "icon":
      return { width: { kind: "fixed", value: 24, unit: "px" }, color: "#e6eaf4" };
    case "logo":
      return {
        width: { kind: "fixed", value: 28, unit: "px" },
        height: { kind: "fixed", value: 28, unit: "px" },
      };
    case "button":
      return {
        fontSize: 15,
        fontWeight: 600,
        padding: [12, 24, 12, 24],
        borderRadius: 10,
        cursor: "pointer",
      };
    case "link":
      return { fontSize: 15, fontWeight: 500, color: "#2dd4bf", cursor: "pointer" };
    case "input":
      return {
        fontSize: 15,
        padding: [12, 14, 12, 14],
        borderRadius: 10,
        width: { kind: "fill" },
        background: "#141822",
        color: "#e6eaf4",
        borderWidth: 1,
        borderColor: "#262d3e",
      };
    case "select":
      return {
        fontSize: 15,
        padding: [12, 14, 12, 14],
        borderRadius: 10,
        background: "#141822",
        color: "#e6eaf4",
        borderWidth: 1,
        borderColor: "#262d3e",
      };
    case "checkbox":
      return { fontSize: 14, color: "#8b93a9" };
    case "form":
      return {
        display: "flex",
        flexDirection: "column",
        gap: 12,
        width: { kind: "fixed", value: 420, unit: "px" },
      };
    case "divider":
      return { thickness: 1, orientation: "horizontal", color: "#262d3e" };
    case "scene3d":
      // Positioned so the scene can host free children on top of its own
      // background layer (see SceneNode in NodeView).
      return {
        position: "relative",
        width: { kind: "fill" },
        height: { kind: "fixed", value: 420, unit: "px" },
      };
    default:
      return {};
  }
}

/**
 * Defaults tuned for direct creation on the canvas (draw-to-create, asset
 * drops). Sized to the natural draw rectangle rather than fixed presets.
 */
export function defaultStyleForBox(type: ElementType, w: number, h: number): StyleProps {
  const box = (min: number): StyleProps => ({
    width: { kind: "fixed", value: Math.max(min, Math.round(w)), unit: "px" },
    height: { kind: "fixed", value: Math.max(min, Math.round(h)), unit: "px" },
  });
  switch (type) {
    case "heading":
      return { ...box(28), fontSize: Math.min(96, Math.max(20, Math.round(h / 1.2 / 2) * 2)), fontWeight: 800, lineHeight: 1.1, letterSpacing: -1, color: "#e6eaf4", textAlign: "left" };
    case "text":
      return { ...box(18), fontSize: 16, lineHeight: 1.55, color: "#8b93a9", textAlign: "left" };
    case "image":
    case "gif":
      return { ...box(60), borderRadius: 12, objectFit: "cover" };
    case "video":
      return { ...box(80), borderRadius: 12, objectFit: "cover" };
    case "button":
      return { fontSize: 14, fontWeight: 600, borderRadius: 10, cursor: "pointer", ...box(40) };
    case "icon":
      return { width: { kind: "fixed", value: Math.max(16, Math.round(Math.min(w, h))), unit: "px" }, color: "#e6eaf4" };
    case "divider":
      return { thickness: Math.max(1, Math.round(h)), orientation: h > 24 ? "vertical" : "horizontal", color: "#262d3e", width: { kind: "fixed", value: Math.max(2, Math.round(w)), unit: "px" }, height: { kind: "fixed", value: Math.max(2, Math.round(h)), unit: "px" } };
    case "scene3d":
      return {
        position: "relative",
        width: { kind: "fixed", value: Math.max(120, Math.round(w)), unit: "px" },
        height: { kind: "fixed", value: Math.max(120, Math.round(h)), unit: "px" },
      };
    default:
      return { ...box(60) };
  }
}

/**
 * Like makeNode, but the name is made unique against existing names by a
 * callback — used by canvas draw-creation so "Text", "Text 2", … never collide.
 */
export function makeNodeWithNamer(
  type: ElementType,
  nameFor: (base: string, taken: Set<string>) => string,
  existingNodes: Record<NodeId, ElementNode> = {},
): ElementNode {
  const base = defaultName(type);
  const taken = new Set(Object.values(existingNodes).map((n) => n.name));
  const name = nameFor(base, taken);
  return {
    id: uid(),
    type,
    name,
    props: defaultProps(type),
    style: { base: defaultStyle(type) },
    children: [],
  };
}

export function defaultProps(type: ElementType): ElementProps {
  switch (type) {
    case "heading":
      return { text: "Build visually. Own the code.", level: 2 };
    case "text":
      return { text: "Describe your product in one clear sentence." };
    case "button":
      return { label: "Get started", variant: "primary" };
    case "link":
      return { label: "Learn more", href: "#" };
    case "icon":
      return { icon: "spark" };
    case "logo":
      return { label: "Frontel" };
    case "input":
      return { label: "Email", inputType: "email", placeholder: "you@example.com" };
    case "select":
      return { label: "Role", options: ["Designer", "Developer", "Founder"] };
    case "checkbox":
      return { label: "Subscribe to updates" };
    case "form":
      return { action: { kind: "none" } };
    case "image":
    case "gif":
      return { alt: "" };
    case "video":
      return { alt: "", controls: true };
    default:
      return {};
  }
}

export function defaultName(type: ElementType): string {
  const names: Record<ElementType, string> = {
    section: "Section",
    container: "Container",
    flex: "Row",
    grid: "Grid",
    stack: "Stack",
    heading: "Heading",
    text: "Text",
    image: "Image",
    gif: "GIF",
    video: "Video",
    icon: "Icon",
    logo: "Logo",
    button: "Button",
    link: "Link",
    input: "Input",
    select: "Select",
    checkbox: "Checkbox",
    form: "Form",
    divider: "Divider",
    scene3d: "3D Background",
  };
  return names[type] ?? "Element";
}

/** Creates a node with a display name made unique within the project. */
export function makeNode(
  type: ElementType,
  existingNodes: Record<NodeId, ElementNode> = {},
): ElementNode {
  const base = defaultName(type);
  const taken = new Set(Object.values(existingNodes).map((n) => n.name));
  let name = base;
  if (taken.has(name)) {
    let i = 2;
    while (taken.has(`${base} ${i}`)) i += 1;
    name = `${base} ${i}`;
  }
  return {
    id: uid(),
    type,
    name,
    props: defaultProps(type),
    style: { base: defaultStyle(type) },
    children: [],
  };
}

export function makePage(name: string, path: string, rootId: NodeId): Page {
  return { id: uid("p"), name, path, rootId };
}

export function makeProject(name: string): Project {
  return {
    version: 1,
    id: uid("prj"),
    name,
    homePageId: "",
    pages: [],
    nodes: {},
    assets: {},
    theme: structuredClone(DEFAULT_THEME),
    updatedAt: Date.now(),
  };
}

/** Creates an empty project with a single blank page. */
export function makeScratchProject(name: string): Project {
  const project = makeProject(name);
  const rootId = uid("page");
  project.nodes[rootId] = {
    id: rootId,
    type: "section",
    name: "Home",
    props: {},      style: {
        base: {
          display: "flex",
          flexDirection: "column",
          justify: "flex-start",
          align: "stretch",
          width: { kind: "fill" },
          minHeight: "100vh",
        },
      },
      children: [],
  };
  const page = makePage("Home", "/", rootId);
  project.pages = [page];
  project.homePageId = page.id;
  return project;
}

/** Deep clone of a project with a fresh id (used by duplicate). */
export function cloneProject(project: Project, newName: string): Project {
  const clone = structuredClone(project);
  clone.id = uid("prj");
  clone.name = newName;
  clone.updatedAt = Date.now();
  return clone;
}

export function makeScene3DNode(existingNodes: Record<NodeId, ElementNode> = {}): ElementNode {
  const node = makeNode("scene3d", existingNodes);
  node.scene3d = structuredClone(DEFAULT_SCENE_3D);
  return node;
}

/** Merges default props with type-specific overrides (used by direct creation). */
export function propsWith(type: ElementType, overrides: ElementProps): ElementProps {
  return { ...defaultProps(type), ...overrides };
}
