/**
 * Canvas-frame geometry helpers.
 *
 * Every overlay measurement is frame-local: the canvas frame (marked with
 * `data-fe-frame`) is the position:relative element the chrome is mounted in,
 * so its padding box is the origin. Sharing these helpers means the selection
 * chrome and the Inspector measure exactly the way Canvas does.
 */
import type { NodeId } from "@/schemas/types";
import type { Rect } from "./grid";

/** The canvas frame element — the page's coordinate origin. */
export function canvasFrameEl(): HTMLElement | null {
  return document.querySelector<HTMLElement>("[data-fe-frame]");
}

/** Frame-local rect of a rendered element. */
export function rectInFrame(
  el: HTMLElement,
  frame: HTMLElement | null = canvasFrameEl(),
): Rect | null {
  if (!frame) return null;
  const r = el.getBoundingClientRect();
  const f = frame.getBoundingClientRect();
  return {
    left: r.left - f.left - frame.clientLeft,
    top: r.top - f.top - frame.clientTop,
    right: r.right - f.left - frame.clientLeft,
    bottom: r.bottom - f.top - frame.clientTop,
  };
}

/** Frame-local rect of a rendered node. */
export function nodeRectInFrame(
  id: NodeId,
  frame: HTMLElement | null = canvasFrameEl(),
): Rect | null {
  if (!frame) return null;
  const el = frame.querySelector<HTMLElement>(`[data-fe-node="${id}"]`);
  return el ? rectInFrame(el, frame) : null;
}

/** Offset of a node's top-left inside an ancestor node, in frame-local px. */
export function offsetWithin(
  id: NodeId,
  ancestorId: NodeId,
  frame: HTMLElement | null = canvasFrameEl(),
): { left: number; top: number } | null {
  const self = nodeRectInFrame(id, frame);
  const host = nodeRectInFrame(ancestorId, frame);
  if (!self || !host) return null;
  return { left: self.left - host.left, top: self.top - host.top };
}
