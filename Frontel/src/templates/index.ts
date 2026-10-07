/**
 * Starter templates. Each is a normal Frontel project — fully editable once
 * opened, and demonstrated by the same renderer/codegen as any other project.
 */
import type { ElementNode, ElementType, Project, StyleProps } from "@/schemas/types";
import { DEFAULT_THEME, uid } from "@/schemas/factory";

/* ---------------- tiny builder ---------------- */

interface Built {
  node: ElementNode;
  kids: Built[];
}

/**
 * Builds a node. `style` may carry `tablet`/`mobile` keys — they are split
 * into the StyleSet override layers instead of polluting base styles.
 */
function build(
  type: ElementType,
  name: string,
  style: StyleProps & { tablet?: StyleProps; mobile?: StyleProps },
  props: ElementNode["props"] = {},
  kids: Built[] = [],
  extra: Partial<ElementNode> = {},
): Built {
  const { tablet, mobile, ...base } = style;
  return {
    node: {
      id: uid(),
      type,
      name,
      props,
      style: { base, ...(tablet ? { tablet } : {}), ...(mobile ? { mobile } : {}) },
      children: [],
      ...extra,
    },
    kids,
  };
}

function flatten(roots: Built[]): Record<string, ElementNode> {
  const nodes: Record<string, ElementNode> = {};
  const walk = (b: Built) => {
    b.node.children = b.kids.map((k) => k.node.id);
    nodes[b.node.id] = b.node;
    b.kids.forEach(walk);
  };
  roots.forEach(walk);
  return nodes;
}

function makeProject(
  name: string,
  theme: Project["theme"],
  pages: { name: string; path: string; sections: Built[] }[],
): Project {
  const nodes = flatten(pages.flatMap((p) => p.sections));
  const pageRecords = pages.map((p) => {
    const rootId = uid("page");
    nodes[rootId] = {
      id: rootId,
      type: "section",
      name: p.name,
      props: {},
      style: {
        base: {
          display: "flex",
          flexDirection: "column",
          width: { kind: "fill" },
          minHeight: "100vh",
          background: theme.colors.background,
        },
      },
      children: p.sections.map((b) => b.node.id),
    };
    return { id: uid("p"), name: p.name, path: p.path, rootId };
  });
  return {
    version: 1,
    id: uid("prj"),
    name,
    homePageId: pageRecords[0].id,
    pages: pageRecords,
    nodes,
    assets: {},
    theme,
    updatedAt: Date.now(),
  };
}

/* ---------------- shared pieces ---------------- */

function navbar(bg: string): Built {
  return build("section", "Navbar", {
    display: "flex",
    flexDirection: "row",
    justify: "space-between",
    align: "center",
    padding: [18, 48, 18, 48],
    width: { kind: "fill" },
    background: bg,
  }, {}, [
    build("logo", "Brand", {}, { label: "Nebula" }),
    build("flex", "Nav Links", {
      display: "flex",
      flexDirection: "row",
      gap: 28,
      align: "center",
      mobile: { visible: false },
    }, {}, [
      build("link", "Product Link", {}, { label: "Product", href: "#features" }),
      build("link", "Pricing Link", {}, { label: "Pricing", href: "/pricing" }, [], {
        onClick: { kind: "navigate", path: "/pricing" },
      }),
      build("link", "Docs Link", {}, { label: "Docs", href: "#" }),
    ]),
    build("button", "Nav CTA", {
      fontSize: 14,
      fontWeight: 600,
      padding: [9, 18, 9, 18],
      borderRadius: 8,
      mobile: { visible: false },
    }, { label: "Get started", variant: "primary" }),
  ]);
}

function footer(bg: string): Built {
  return build("section", "Footer", {
    display: "flex",
    flexDirection: "column",
    align: "center",
    gap: 10,
    padding: [40, 24, 40, 24],
    width: { kind: "fill" },
    background: bg,
  }, {}, [
    build("divider", "Footer Divider", { thickness: 1, orientation: "horizontal", color: "#262d3e", width: { kind: "fill" } }),
    build("text", "Footer Text", { fontSize: 13, color: "#8b93a9", textAlign: "center" }, {
      text: "© 2026 Nebula Labs. Built with Frontel.",
    }),
  ]);
}

function featureCard(icon: string, title: string, body: string): Built {
  return build("stack", `${title} Card`, {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    padding: [24, 24, 24, 24],
    borderRadius: 14,
    background: "#10131a",
    borderWidth: 1,
    borderColor: "#1c212e",
  }, {}, [
    build("icon", "Card Icon", { width: { kind: "fixed", value: 22, unit: "px" }, color: "#2dd4bf" }, { icon }),
    build("heading", "Card Title", { fontSize: 18, fontWeight: 700, textAlign: "left" }, { text: title, level: 3 }),
    build("text", "Card Body", { fontSize: 14, lineHeight: 1.6, color: "#8b93a9", textAlign: "left" }, { text: body }),
  ], {
    animation: { type: "fade-up", trigger: "on-scroll", duration: 500, delay: 0, easing: "ease-out" },
  });
}

function planCard(name: string, price: string, features: string[], featured: boolean): Built {
  return build("stack", `${name} Plan`, {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    padding: [28, 28, 28, 28],
    borderRadius: 16,
    background: featured ? "#0f1f1b" : "#10131a",
    borderWidth: 1,
    borderColor: featured ? "#2dd4bf" : "#1c212e",
  }, {}, [
    build("text", "Plan Name", { fontSize: 14, fontWeight: 600, color: "#8b93a9", textAlign: "left" }, { text: name }),
    build("heading", "Plan Price", { fontSize: 40, fontWeight: 800, textAlign: "left" }, { text: price, level: 2 }),
    ...features.map((f) =>
      build("flex", "Plan Feature", { display: "flex", flexDirection: "row", gap: 8, align: "center" }, {}, [
        build("icon", "Check Icon", { width: { kind: "fixed", value: 14, unit: "px" }, color: "#2dd4bf" }, { icon: "check" }),
        build("text", "Feature Text", { fontSize: 13.5, textAlign: "left", color: "#b7bfd2" }, { text: f }),
      ]),
    ),
    build("button", "Plan Button", {
      fontSize: 14,
      fontWeight: 600,
      padding: [10, 0, 10, 0],
      borderRadius: 9,
    }, { label: featured ? "Start free trial" : `Choose ${name}`, variant: featured ? "primary" : "outline" }),
  ]);
}

function spec(value: string, label: string): Built {
  return build("stack", `${label} Spec`, {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    padding: [22, 22, 22, 22],
    borderRadius: 14,
    background: "#10131a",
    borderWidth: 1,
    borderColor: "#1c212e",
  }, {}, [
    build("heading", "Spec Value", { fontSize: 30, fontWeight: 800, textAlign: "left" }, { text: value, level: 3 }),
    build("text", "Spec Label", { fontSize: 13, color: "#8b93a9", textAlign: "left" }, { text: label }),
  ]);
}

/* ---------------- 1. SaaS landing (multi-page) ---------------- */

function saasLanding(): Project {
  const theme = structuredClone(DEFAULT_THEME);

  const home = [
    navbar("#0c0e13"),
    build("section", "Hero", {
      display: "flex",
      flexDirection: "column",
      align: "center",
      justify: "center",
      gap: 22,
      padding: [110, 24, 110, 24],
      width: { kind: "fill" },
      background: "radial-gradient(ellipse 80% 60% at 50% 0%, #10233f 0%, #0c0e13 65%)",
    }, {}, [
      build("button", "Hero Badge", {
        fontSize: 12,
        fontWeight: 600,
        padding: [6, 14, 6, 14],
        borderRadius: 999,
        background: "#10233a",
        color: "#5eead4",
        borderWidth: 1,
        borderColor: "#1d3a54",
      }, { label: "✦ Now in public beta" }),
      build("heading", "Hero Heading", {
        fontSize: 72,
        fontWeight: 800,
        lineHeight: 1.05,
        letterSpacing: -2.5,
        textAlign: "center",
        color: "#e6eaf4",
        tablet: { fontSize: 56 },
        mobile: { fontSize: 40 },
      }, { text: "Ship your product at nebula speed", level: 1 }, [], {
        animation: { type: "fade-up", trigger: "on-load", duration: 700, delay: 0, easing: "ease-out" },
      }),
      build("text", "Hero Sub", {
        fontSize: 19,
        lineHeight: 1.6,
        color: "#8b93a9",
        textAlign: "center",
        width: { kind: "fixed", value: 640, unit: "px" },
        mobile: { width: { kind: "fill" }, fontSize: 16 },
      }, {
        text: "Nebula unifies analytics, releases and feature flags in one dashboard your whole team will actually enjoy using.",
      }),
      build("flex", "Hero Actions", { display: "flex", flexDirection: "row", gap: 14, justify: "center" }, {}, [
        build("button", "Primary CTA", {
          fontSize: 15,
          fontWeight: 700,
          padding: [13, 28, 13, 28],
          borderRadius: 10,
        }, { label: "Start free trial", variant: "primary" }, [], {
          onClick: { kind: "scroll-to", anchorId: "cta" },
          animation: { type: "hover-lift", trigger: "on-load", duration: 200, delay: 0, easing: "ease-out" },
        }),
        build("button", "Secondary CTA", {
          fontSize: 15,
          fontWeight: 600,
          padding: [13, 28, 13, 28],
          borderRadius: 10,
        }, { label: "View pricing", variant: "outline" }, [], {
          onClick: { kind: "navigate", path: "/pricing" },
        }),
      ]),
    ]),
    build("section", "Features", {
      display: "flex",
      flexDirection: "column",
      align: "center",
      gap: 36,
      padding: [96, 48, 96, 48],
      width: { kind: "fill" },
      background: "#0c0e13",
    }, {}, [
      build("heading", "Features Heading", { fontSize: 34, fontWeight: 800, textAlign: "center", letterSpacing: -1 }, {
        text: "Everything your release needs",
        level: 2,
      }),
      build("grid", "Feature Grid", {
        display: "grid",
        gridColumns: 3,
        gap: 20,
        width: { kind: "fixed", value: 1120, unit: "px" },
        tablet: { gridColumns: 2 },
        mobile: { gridColumns: 1 },
      }, {}, [
        featureCard("zap", "Realtime pipelines", "Metrics stream in sub-second. No batch windows, no stale charts."),
        featureCard("shield", "Progressive rollouts", "Ship to 1% then watch the graphs before going wider."),
        featureCard("terminal", "CLI-first config", "Everything is code. Diff, review and revert like software."),
      ]),
    ], { anchorId: "features" }),
    build("section", "CTA", {
      display: "flex",
      flexDirection: "column",
      align: "center",
      gap: 18,
      padding: [90, 24, 90, 24],
      width: { kind: "fill" },
      background: "linear-gradient(180deg, #0c0e13 0%, #0d1a17 100%)",
    }, {}, [
      build("heading", "CTA Heading", {
        fontSize: 40,
        fontWeight: 800,
        textAlign: "center",
        letterSpacing: -1,
        mobile: { fontSize: 30 },
      }, { text: "Ready to launch faster?", level: 2 }),
      build("text", "CTA Sub", { fontSize: 16, color: "#8b93a9", textAlign: "center" }, {
        text: "Join 2,000+ teams shipping with Nebula.",
      }),
      build("button", "CTA Button", {
        fontSize: 15,
        fontWeight: 700,
        padding: [13, 30, 13, 30],
        borderRadius: 10,
      }, { label: "Create your workspace", variant: "primary" }),
    ], { anchorId: "cta" }),
    footer("#0c0e13"),
  ];

  const pricing = [
    navbar("#0c0e13"),
    build("section", "Pricing Hero", {
      display: "flex",
      flexDirection: "column",
      align: "center",
      gap: 14,
      padding: [80, 24, 40, 24],
      width: { kind: "fill" },
      background: "#0c0e13",
    }, {}, [
      build("heading", "Pricing Heading", { fontSize: 52, fontWeight: 800, letterSpacing: -2, textAlign: "center", mobile: { fontSize: 34 } }, {
        text: "Simple, honest pricing",
        level: 1,
      }),
      build("text", "Pricing Sub", { fontSize: 17, color: "#8b93a9", textAlign: "center" }, {
        text: "Start free. Upgrade when your team does.",
      }),
    ]),
    build("section", "Plans", {
      display: "flex",
      flexDirection: "column",
      align: "center",
      padding: [40, 48, 96, 48],
      width: { kind: "fill" },
      background: "#0c0e13",
    }, {}, [
      build("grid", "Plan Grid", {
        display: "grid",
        gridColumns: 3,
        gap: 20,
        width: { kind: "fixed", value: 1040, unit: "px" },
        tablet: { gridColumns: 1 },
        mobile: { gridColumns: 1 },
      }, {}, [
        planCard("Hobby", "$0", ["1 project", "Community support", "Core analytics"], false),
        planCard("Team", "$29", ["Unlimited projects", "Progressive rollouts", "Priority support"], true),
        planCard("Scale", "$99", ["SAML SSO", "Audit logs", "Dedicated success"], false),
      ]),
    ]),
    footer("#0c0e13"),
  ];

  return makeProject("Nebula SaaS", theme, [
    { name: "Home", path: "/", sections: home },
    { name: "Pricing", path: "/pricing", sections: pricing },
  ]);
}

/* ---------------- 2. Portfolio ---------------- */

function portfolio(): Project {
  const theme = structuredClone(DEFAULT_THEME);
  theme.colors.primary = "#f59e0b";
  theme.colors.primaryContrast = "#221302";

  const work = (title: string, tag: string): Built =>
    build("stack", `${title} Project`, {
      display: "flex",
      flexDirection: "column",
      gap: 8,
      padding: [20, 20, 20, 20],
      borderRadius: 14,
      background: "#141822",
      borderWidth: 1,
      borderColor: "#262d3e",
      tablet: { padding: [16, 16, 16, 16] },
    }, {}, [
      build("image", `${title} Cover`, {
        width: { kind: "fill" },
        height: { kind: "fixed", value: 180, unit: "px" },
        borderRadius: 10,
        objectFit: "cover",
      }, { alt: title }),
      build("text", `${title} Tag`, { fontSize: 11, fontWeight: 600, color: "#f59e0b", textAlign: "left" }, { text: tag.toUpperCase() }),
      build("heading", `${title} Title`, { fontSize: 19, fontWeight: 700, textAlign: "left" }, { text: title, level: 3 }),
    ], {
      animation: { type: "hover-lift", trigger: "on-load", duration: 250, delay: 0, easing: "ease-out" },
    });

  const home = [
    build("section", "Intro", {
      display: "flex",
      flexDirection: "column",
      justify: "center",
      gap: 16,
      padding: [120, 48, 120, 48],
      width: { kind: "fill" },
      background: "radial-gradient(ellipse 70% 70% at 20% 20%, #241a06 0%, #0c0e13 60%)",
    }, {}, [
      build("logo", "Signature", {}, { label: "Mara Voss" }),
      build("heading", "Intro Heading", {
        fontSize: 64,
        fontWeight: 800,
        letterSpacing: -2,
        lineHeight: 1.08,
        textAlign: "left",
        width: { kind: "fixed", value: 720, unit: "px" },
        mobile: { fontSize: 38, width: { kind: "fill" } },
      }, { text: "Design engineer crafting interfaces that feel inevitable.", level: 1 }, [], {
        animation: { type: "fade-up", trigger: "on-load", duration: 700, delay: 0, easing: "ease-out" },
      }),
      build("text", "Intro Sub", { fontSize: 17, lineHeight: 1.6, color: "#8b93a9", textAlign: "left" }, {
        text: "Ten years across brand, product and frontend. Currently exploring the space where design systems meet real code.",
      }),
      build("flex", "Social Row", { display: "flex", flexDirection: "row", gap: 18 }, {}, [
        build("link", "GitHub Link", {}, { label: "GitHub", href: "https://github.com" }),
        build("link", "Twitter Link", {}, { label: "Twitter", href: "https://twitter.com" }),
        build("link", "Email Link", {}, { label: "Email", href: "mailto:hi@example.com" }),
      ]),
    ]),
    build("section", "Selected Work", {
      display: "flex",
      flexDirection: "column",
      gap: 24,
      padding: [80, 48, 80, 48],
      width: { kind: "fill" },
      background: "#0c0e13",
    }, {}, [
      build("heading", "Work Heading", { fontSize: 28, fontWeight: 700, textAlign: "left" }, { text: "Selected work", level: 2 }),
      build("grid", "Work Grid", {
        display: "grid",
        gridColumns: 3,
        gap: 20,
        width: { kind: "fill" },
        tablet: { gridColumns: 2 },
        mobile: { gridColumns: 1 },
      }, {}, [
        work("Orbit Analytics", "Product design"),
        work("Ledger CLI", "Brand + frontend"),
        work("Pulse Design System", "Open source"),
      ]),
    ]),
    build("section", "Contact", {
      display: "flex",
      flexDirection: "column",
      align: "center",
      gap: 16,
      padding: [90, 24, 90, 24],
      width: { kind: "fill" },
      background: "#10131a",
    }, {}, [
      build("heading", "Contact Heading", { fontSize: 34, fontWeight: 800, textAlign: "center" }, { text: "Let's work together", level: 2 }),
      build("form", "Contact Form", {
        display: "flex",
        flexDirection: "column",
        gap: 12,
        width: { kind: "fixed", value: 440, unit: "px" },
        mobile: { width: { kind: "fill" } },
      }, { action: { kind: "none" } }, [
        build("input", "Email Input", {
          fontSize: 14,
          padding: [12, 14, 12, 14],
          borderRadius: 10,
          width: { kind: "fill" },
          background: "#0c0e13",
          color: "#e6eaf4",
          borderWidth: 1,
          borderColor: "#262d3e",
        }, { label: "Email", inputType: "email", placeholder: "you@example.com", required: true }),
        build("button", "Send Button", {
          fontSize: 14,
          fontWeight: 700,
          padding: [12, 0, 12, 0],
          borderRadius: 10,
        }, { label: "Send message", variant: "primary" }),
      ]),
    ]),
    footer("#0c0e13"),
  ];

  return makeProject("Mara Voss Portfolio", theme, [{ name: "Home", path: "/", sections: home }]);
}

/* ---------------- 3. Product launch (3D + API form) ---------------- */

function productLaunch(): Project {
  const theme = structuredClone(DEFAULT_THEME);
  theme.colors.primary = "#818cf8";
  theme.colors.primaryContrast = "#0b0d1f";
  theme.colors.background = "#08090c";

  const home = [
    navbar("#08090c"),
    build("section", "Launch Hero", {
      display: "flex",
      flexDirection: "row",
      align: "center",
      gap: 40,
      padding: [80, 64, 80, 64],
      width: { kind: "fill" },
      background: "#08090c",
      tablet: { flexDirection: "column", padding: [60, 32, 60, 32] },
    }, {}, [
      build("stack", "Launch Copy", {
        display: "flex",
        flexDirection: "column",
        gap: 18,
        width: { kind: "fill" },
      }, {}, [
        build("heading", "Launch Heading", {
          fontSize: 60,
          fontWeight: 800,
          letterSpacing: -2,
          lineHeight: 1.05,
          textAlign: "left",
          mobile: { fontSize: 38 },
        }, { text: "The headset for your second brain.", level: 1 }, [], {
          animation: { type: "fade-up", trigger: "on-load", duration: 700, delay: 0, easing: "ease-out" },
        }),
        build("text", "Launch Sub", { fontSize: 17, lineHeight: 1.65, color: "#8b93a9", textAlign: "left" }, {
          text: "Halo pairs spatial audio with a thoughtfully minimal interface. Preorders open March 2027.",
        }),
        build("form", "Waitlist Form", {
          display: "flex",
          flexDirection: "row",
          gap: 10,
          width: { kind: "fill" },
          mobile: { flexDirection: "column" },
        }, { action: { kind: "submit-api", method: "POST", url: "/api/waitlist" } }, [
          build("input", "Waitlist Email", {
            fontSize: 14,
            padding: [12, 14, 12, 14],
            borderRadius: 10,
            width: { kind: "fill" },
            background: "#10131a",
            color: "#e6eaf4",
            borderWidth: 1,
            borderColor: "#262d3e",
          }, { label: "Email", inputType: "email", placeholder: "you@example.com", required: true }),
          build("button", "Notify Button", {
            fontSize: 14,
            fontWeight: 700,
            padding: [12, 22, 12, 22],
            borderRadius: 10,
          }, { label: "Notify me", variant: "primary" }),
        ]),
      ]),
      build("scene3d", "Halo Scene", {
        width: { kind: "fill" },
        height: { kind: "fixed", value: 420, unit: "px" },
        borderRadius: 18,
      }, {}, [], {
        scene3d: {
          shape: "icosahedron",
          color: "#818cf8",
          rotationSpeed: 0.35,
          floatAmplitude: 0.3,
          cameraDistance: 5.5,
          scrollInfluence: 0.35,
          wireframe: false,
        },
        animation: { type: "parallax", trigger: "on-load", duration: 600, delay: 0, easing: "ease-out", intensity: 0.35 },
      }),
    ]),
    build("section", "Specs", {
      display: "flex",
      flexDirection: "column",
      gap: 28,
      padding: [90, 64, 90, 64],
      width: { kind: "fill" },
      background: "linear-gradient(180deg, #08090c 0%, #0e101d 100%)",
    }, {}, [
      build("heading", "Specs Heading", { fontSize: 34, fontWeight: 800, textAlign: "center" }, { text: "Engineered, not assembled.", level: 2 }),
      build("grid", "Spec Grid", {
        display: "grid",
        gridColumns: 3,
        gap: 18,
        width: { kind: "fill" },
        tablet: { gridColumns: 2 },
        mobile: { gridColumns: 1 },
      }, {}, [
        spec("40h", "Battery life"),
        spec("38g", "Total weight"),
        spec("SNR 94", "Microphone array"),
      ]),
    ]),
    footer("#08090c"),
  ];

  return makeProject("Halo Launch", theme, [{ name: "Home", path: "/", sections: home }]);
}

/* ---------------- registry ---------------- */

export interface TemplateMeta {
  id: "saas" | "portfolio" | "launch";
  name: string;
  description: string;
  preview: string;
}

export const TEMPLATE_META: TemplateMeta[] = [
  {
    id: "saas",
    name: "SaaS Landing",
    description: "Multi-page marketing site with hero, feature grid, pricing and working navigation.",
    preview: "radial-gradient(ellipse 90% 100% at 50% 0%, #10233f 0%, #0c0e13 70%)",
  },
  {
    id: "portfolio",
    name: "Portfolio",
    description: "Personal site with work grid, hover interactions and a contact form.",
    preview: "radial-gradient(ellipse 90% 100% at 20% 0%, #241a06 0%, #0c0e13 70%)",
  },
  {
    id: "launch",
    name: "Product Launch",
    description: "Single-page launch with a live 3D scene, parallax and a real API waitlist form.",
    preview: "radial-gradient(ellipse 90% 100% at 80% 0%, #1d1f3f 0%, #08090c 70%)",
  },
];

export const TEMPLATES: Record<TemplateMeta["id"], () => Project> = {
  saas: saasLanding,
  portfolio,
  launch: productLaunch,
};
