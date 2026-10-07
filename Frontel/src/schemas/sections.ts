/**
 * Section presets — one-click, real-schema starting points for common page
 * blocks (Navbar, Hero, Features, Pricing, CTA, Footer). Each preset becomes
 * ordinary ElementNodes: fully editable, and codegen treats it like anything
 * hand-built. No new machinery — just factory data.
 */
import { makeNode } from "./factory";
import type { ElementNode, ElementType, NodeId, StyleProps } from "./types";

export interface SectionPreset {
  id: string;
  label: string;
  icon: string;
}

interface Built {
  node: ElementNode;
  kids: Built[];
}

/** Create one schema node with a fresh id. */
function n(
  type: ElementType,
  name: string,
  base: StyleProps,
  props: ElementNode["props"] = {},
  kids: Built[] = [],
  extra: Partial<ElementNode> = {},
): Built {
  const node: ElementNode = {
    ...makeNode(type),
    name,
    props,
    style: { base },
    ...extra,
  };
  node.children = kids.map((k) => k.node.id);
  return { node, kids };
}

/** Flatten a built tree into a nodes map, uniquifying names against existing nodes. */
function flatten(root: Built, existing: Record<NodeId, ElementNode>): Record<NodeId, ElementNode> {
  const nodes: Record<NodeId, ElementNode> = {};
  const taken = new Set(Object.values(existing).map((x) => x.name));
  const walk = (b: Built) => {
    let name = b.node.name;
    if (taken.has(name)) {
      let i = 2;
      while (taken.has(`${b.node.name} ${i}`)) i += 1;
      name = `${b.node.name} ${i}`;
    }
    taken.add(name);
    nodes[b.node.id] = { ...b.node, name };
    b.kids.forEach(walk);
  };
  walk(root);
  return nodes;
}

/**
 * Builds a section preset as real schema nodes.
 * Returns the new nodes plus the id of the section root (to insert + select).
 */
export function buildSection(
  presetId: string,
  existing: Record<NodeId, ElementNode>,
): { nodes: Record<NodeId, ElementNode>; rootId: NodeId } {
  const root = builders[presetId]?.() ?? builders["cta"]();
  return { nodes: flatten(root, existing), rootId: root.node.id };
}

const CARD = {
  display: "flex" as const,
  flexDirection: "column" as const,
  gap: 10,
  padding: [24, 24, 24, 24] as [number, number, number, number],
  borderRadius: 14,
  background: "surface",
  borderWidth: 1,
  borderColor: "border",
};

const INPUT = {
  fontSize: 14,
  padding: [12, 14, 12, 14] as [number, number, number, number],
  borderRadius: 10,
  width: { kind: "fill" as const },
  background: "surface",
  color: "text",
  borderWidth: 1,
  borderColor: "border",
};

const builders: Record<string, () => Built> = {
  navbar: () =>
    n(
      "section",
      "Navbar",
      {
        display: "flex",
        flexDirection: "row",
        justify: "space-between",
        align: "center",
        padding: [18, 48, 18, 48],
        width: { kind: "fill" },
        background: "background",
      },
      {},
      [
        n("logo", "Brand", {}, { label: "Frontel" }),
        n("flex", "Nav Links", { display: "flex", flexDirection: "row", gap: 28, align: "center" }, {}, [
          n("link", "Features Link", {}, { label: "Features", href: "#features" }),
          n("link", "Pricing Link", {}, { label: "Pricing", href: "#pricing" }),
        ]),
        n(
          "button",
          "Nav CTA",
          { fontSize: 14, fontWeight: 600, padding: [9, 18, 9, 18], borderRadius: 8 },
          { label: "Get started", variant: "primary" },
        ),
      ],
    ),

  hero: () =>
    n(
      "section",
      "Hero",
      {
        display: "flex",
        flexDirection: "column",
        align: "center",
        justify: "center",
        gap: 20,
        padding: [110, 24, 110, 24],
        width: { kind: "fill" },
        background: "background",
      },
      {},
      [
        n(
          "heading",
          "Hero Heading",
          { fontSize: 64, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2, textAlign: "center" },
          { text: "Your headline here", level: 1 },
        ),
        n(
          "text",
          "Hero Sub",
          { fontSize: 18, lineHeight: 1.6, color: "muted", textAlign: "center", width: { kind: "fixed", value: 620, unit: "px" } },
          { text: "One clear sentence describing the value of your product." },
        ),
        n("flex", "Hero Actions", { display: "flex", flexDirection: "row", gap: 14, justify: "center" }, {}, [
          n(
            "button",
            "Primary CTA",
            { fontSize: 15, fontWeight: 700, padding: [13, 28, 13, 28], borderRadius: 10 },
            { label: "Get started", variant: "primary" },
          ),
          n(
            "button",
            "Secondary CTA",
            { fontSize: 15, fontWeight: 600, padding: [13, 28, 13, 28], borderRadius: 10 },
            { label: "Learn more", variant: "outline" },
          ),
        ]),
      ],
    ),

  /** Hero with a freeform (absolutely positioned) composition: 3D backdrop + overlaid copy. */
  hero3d: () =>
    n(
      "section",
      "Hero 3D",
      {
        display: "flex",
        flexDirection: "column",
        width: { kind: "fill" },
        minHeight: 620,
        background: "background",
      },
      {},
      [
        // A relative canvas box hosts everything; children place themselves
        // anywhere inside it.
        n(
          "section",
          "Canvas layer",
          {
            display: "flex",
            flexDirection: "column",
            position: "relative",
            width: { kind: "fill" },
            minHeight: 620,
            overflow: "visible",
            background: "transparent",
          },
          { freeformLayer: true },
          [
            // The scene IS the background: the copy below is nested inside it,
            // so it renders on top of the live 3D object and can be dragged
            // anywhere within the scene's box.
            n(
              "scene3d",
              "Hero Scene",
              {
                position: "absolute",
                left: 120,
                top: 60,
                width: { kind: "fixed", value: 1040, unit: "px" },
                height: { kind: "fixed", value: 520, unit: "px" },
                borderRadius: 20,
                overflow: "hidden",
                background: "linear-gradient(120deg, #0b1a1a 0%, #0c0e13 70%)",
                zIndex: 0,
              },
              {},
              [
                n(
                  "text",
                  "Hero Eyebrow",
                  {
                    position: "absolute",
                    left: 60,
                    top: 92,
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: 2.4,
                    textTransform: "uppercase",
                    color: "primary",
                    textAlign: "left",
                  },
                  { text: "Live 3D, real UI" },
                ),
                n(
                  "heading",
                  "Hero Heading",
                  {
                    position: "absolute",
                    left: 60,
                    top: 132,
                    width: { kind: "fixed", value: 560, unit: "px" },
                    fontSize: 56,
                    fontWeight: 800,
                    lineHeight: 1.06,
                    letterSpacing: -2,
                    textAlign: "left",
                    color: "text",
                  },
                  { text: "Create in three dimensions", level: 1 },
                ),
                n(
                  "text",
                  "Hero Sub",
                  {
                    position: "absolute",
                    left: 60,
                    top: 300,
                    width: { kind: "fixed", value: 440, unit: "px" },
                    fontSize: 16.5,
                    lineHeight: 1.6,
                    color: "muted",
                    textAlign: "left",
                  },
                  { text: "A live 3D background with normal UI on top — drag, layer and animate everything directly on the canvas." },
                ),
                n(
                  "button",
                  "Hero CTA",
                  {
                    position: "absolute",
                    left: 60,
                    top: 400,
                    fontSize: 15,
                    fontWeight: 700,
                    padding: [13, 28, 13, 28],
                    borderRadius: 10,
                  },
                  { label: "Explore the demo", variant: "primary" },
                ),
              ],
              {
                scene3d: {
                  shape: "icosahedron",
                  color: "#2dd4bf",
                  rotationSpeed: 0.35,
                  floatAmplitude: 0.3,
                  cameraDistance: 6,
                  scrollInfluence: 0.3,
                  wireframe: false,
                },
              },
            ),
          ],
        ),
      ],
    ),

  features: () =>
    n(
      "section",
      "Features",
      {
        display: "flex",
        flexDirection: "column",
        align: "center",
        gap: 36,
        padding: [96, 48, 96, 48],
        width: { kind: "fill" },
        background: "background",
      },
      {},
      [
        n(
          "heading",
          "Features Heading",
          { fontSize: 34, fontWeight: 800, textAlign: "center", letterSpacing: -1 },
          { text: "Everything you need", level: 2 },
        ),
        n("grid", "Feature Grid", { display: "grid", gridColumns: 3, gap: 20, width: { kind: "fixed", value: 1120, unit: "px" } }, {}, [
          n("stack", "Feature Card", CARD, {}, [
            n("icon", "Card Icon", { width: { kind: "fixed", value: 22, unit: "px" }, color: "primary" }, { icon: "zap" }),
            n("heading", "Card Title", { fontSize: 18, fontWeight: 700, textAlign: "left" }, { text: "Fast by default", level: 3 }),
            n("text", "Card Body", { fontSize: 14, lineHeight: 1.6, color: "muted", textAlign: "left" }, { text: "Describe this feature in a sentence or two." }),
          ]),
          n("stack", "Feature Card 2", CARD, {}, [
            n("icon", "Card Icon 2", { width: { kind: "fixed", value: 22, unit: "px" }, color: "primary" }, { icon: "shield" }),
            n("heading", "Card Title 2", { fontSize: 18, fontWeight: 700, textAlign: "left" }, { text: "Secure out of the box", level: 3 }),
            n("text", "Card Body 2", { fontSize: 14, lineHeight: 1.6, color: "muted", textAlign: "left" }, { text: "Describe this feature in a sentence or two." }),
          ]),
          n("stack", "Feature Card 3", CARD, {}, [
            n("icon", "Card Icon 3", { width: { kind: "fixed", value: 22, unit: "px" }, color: "primary" }, { icon: "rocket" }),
            n("heading", "Card Title 3", { fontSize: 18, fontWeight: 700, textAlign: "left" }, { text: "Built to scale", level: 3 }),
            n("text", "Card Body 3", { fontSize: 14, lineHeight: 1.6, color: "muted", textAlign: "left" }, { text: "Describe this feature in a sentence or two." }),
          ]),
        ]),
      ],
    ),

  pricing: () =>
    n(
      "section",
      "Pricing",
      {
        display: "flex",
        flexDirection: "column",
        align: "center",
        gap: 36,
        padding: [96, 48, 96, 48],
        width: { kind: "fill" },
        background: "background",
      },
      {},
      [
        n(
          "heading",
          "Pricing Heading",
          { fontSize: 34, fontWeight: 800, textAlign: "center", letterSpacing: -1 },
          { text: "Simple, honest pricing", level: 2 },
        ),
        n("grid", "Plan Grid", { display: "grid", gridColumns: 3, gap: 20, width: { kind: "fixed", value: 1040, unit: "px" } }, {}, [
          n("stack", "Hobby Plan", { ...CARD, gap: 12, padding: [28, 28, 28, 28] }, {}, [
            n("text", "Plan Name", { fontSize: 14, fontWeight: 600, color: "muted", textAlign: "left" }, { text: "Hobby" }),
            n("heading", "Plan Price", { fontSize: 40, fontWeight: 800, textAlign: "left" }, { text: "$0", level: 2 }),
            n("button", "Plan Button", { fontSize: 14, fontWeight: 600, padding: [10, 0, 10, 0], borderRadius: 9 }, { label: "Start free", variant: "outline" }),
          ]),
          n("stack", "Team Plan", { ...CARD, gap: 12, padding: [28, 28, 28, 28], borderWidth: 2, borderColor: "primary" }, {}, [
            n("text", "Plan Name 2", { fontSize: 14, fontWeight: 600, color: "muted", textAlign: "left" }, { text: "Team" }),
            n("heading", "Plan Price 2", { fontSize: 40, fontWeight: 800, textAlign: "left" }, { text: "$29", level: 2 }),
            n("button", "Plan Button 2", { fontSize: 14, fontWeight: 600, padding: [10, 0, 10, 0], borderRadius: 9 }, { label: "Choose Team", variant: "primary" }),
          ]),
          n("stack", "Scale Plan", { ...CARD, gap: 12, padding: [28, 28, 28, 28] }, {}, [
            n("text", "Plan Name 3", { fontSize: 14, fontWeight: 600, color: "muted", textAlign: "left" }, { text: "Scale" }),
            n("heading", "Plan Price 3", { fontSize: 40, fontWeight: 800, textAlign: "left" }, { text: "$99", level: 2 }),
            n("button", "Plan Button 3", { fontSize: 14, fontWeight: 600, padding: [10, 0, 10, 0], borderRadius: 9 }, { label: "Choose Scale", variant: "outline" }),
          ]),
        ]),
      ],
    ),

  cta: () =>
    n(
      "section",
      "CTA",
      {
        display: "flex",
        flexDirection: "column",
        align: "center",
        gap: 18,
        padding: [90, 24, 90, 24],
        width: { kind: "fill" },
        background: "background",
      },
      {},
      [
        n(
          "heading",
          "CTA Heading",
          { fontSize: 40, fontWeight: 800, textAlign: "center", letterSpacing: -1 },
          { text: "Ready to get started?", level: 2 },
        ),
        n("text", "CTA Sub", { fontSize: 16, color: "muted", textAlign: "center" }, {
          text: "Join thousands of teams already on board.",
        }),
        n(
          "button",
          "CTA Button",
          { fontSize: 15, fontWeight: 700, padding: [13, 30, 13, 30], borderRadius: 10 },
          { label: "Get started free", variant: "primary" },
        ),
      ],
    ),

  contact: () =>
    n(
      "section",
      "Contact",
      {
        display: "flex",
        flexDirection: "column",
        align: "center",
        gap: 20,
        padding: [90, 24, 90, 24],
        width: { kind: "fill" },
        background: "background",
      },
      {},
      [
        n("heading", "Contact Heading", { fontSize: 34, fontWeight: 800, textAlign: "center" }, { text: "Get in touch", level: 2 }),
        n("form", "Contact Form", { display: "flex", flexDirection: "column", gap: 12, width: { kind: "fixed", value: 420, unit: "px" } }, { action: { kind: "none" } }, [
          n("input", "Email Input", INPUT, { label: "Email", inputType: "email", placeholder: "you@example.com", required: true }),
          n("button", "Send Button", { fontSize: 14, fontWeight: 700, padding: [12, 0, 12, 0], borderRadius: 10 }, { label: "Send message", variant: "primary" }),
        ]),
      ],
    ),

  footer: () =>
    n(
      "section",
      "Footer",
      {
        display: "flex",
        flexDirection: "column",
        align: "center",
        gap: 10,
        padding: [40, 24, 40, 24],
        width: { kind: "fill" },
        background: "background",
      },
      {},
      [
        n("divider", "Footer Divider", { thickness: 1, orientation: "horizontal", color: "border", width: { kind: "fill" } }),
        n("text", "Footer Text", { fontSize: 13, color: "muted", textAlign: "center" }, {
          text: "© 2026 Your Company. Built with Frontel.",
        }),
      ],
    ),
};

export const SECTION_PRESETS: SectionPreset[] = [
  { id: "navbar", label: "Navbar", icon: "layout" },
  { id: "hero", label: "Hero", icon: "sparkle" },
  { id: "hero3d", label: "Hero 3D", icon: "box" },
  { id: "features", label: "Features", icon: "grid" },
  { id: "pricing", label: "Pricing", icon: "layers" },
  { id: "cta", label: "CTA", icon: "wand" },
  { id: "contact", label: "Contact", icon: "mail" },
  { id: "footer", label: "Footer", icon: "section" },
];
