import type { ElementType } from "./types";

export type ElementCategory = "layout" | "content" | "interactive" | "visual";

export interface ElementDef {
  label: string;
  category: ElementCategory;
  hasChildren: boolean;
}

export const ELEMENT_DEFS: Record<ElementType, ElementDef> = {
  section: { label: "Section", category: "layout", hasChildren: true },
  container: { label: "Container", category: "layout", hasChildren: true },
  flex: { label: "Row", category: "layout", hasChildren: true },
  grid: { label: "Grid", category: "layout", hasChildren: true },
  stack: { label: "Stack", category: "layout", hasChildren: true },
  heading: { label: "Heading", category: "content", hasChildren: false },
  text: { label: "Text", category: "content", hasChildren: false },
  image: { label: "Image", category: "content", hasChildren: false },
  gif: { label: "GIF", category: "content", hasChildren: false },
  video: { label: "Video", category: "content", hasChildren: false },
  icon: { label: "Icon", category: "content", hasChildren: false },
  logo: { label: "Logo", category: "content", hasChildren: false },
  button: { label: "Button", category: "interactive", hasChildren: false },
  link: { label: "Link", category: "interactive", hasChildren: false },
  input: { label: "Input", category: "interactive", hasChildren: false },
  select: { label: "Select", category: "interactive", hasChildren: false },
  checkbox: { label: "Checkbox", category: "interactive", hasChildren: false },
  form: { label: "Form", category: "interactive", hasChildren: true },
  divider: { label: "Divider", category: "visual", hasChildren: false },
  // A 3D scene is a container: the effect renders as its own background layer,
  // so any element dropped onto the scene sits on top of it (see NodeView).
  scene3d: { label: "3D Background", category: "visual", hasChildren: true },
};

export const CATEGORY_ORDER: ElementCategory[] = [
  "layout",
  "content",
  "interactive",
  "visual",
];

export function isContainerType(type: ElementType): boolean {
  return ELEMENT_DEFS[type]?.hasChildren ?? false;
}
