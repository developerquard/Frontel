import type { Asset, Project } from "@/schemas/types";
import { slug } from "./shared";

/**
 * Resolves a node's assetId to the URL it will have in the exported project:
 * uploaded assets are emitted as files under public/assets/.
 */
export function assetUrlFor(assetId: string | null | undefined, project: Project): string {
  if (!assetId) return "";
  const asset = project.assets[assetId];
  if (!asset) return "";
  if (/^https?:/i.test(asset.src)) return asset.src;
  return `/assets/${slug(asset.name) || asset.id}${extOf(asset)}`;
}

function extOf(asset: Asset): string {
  const m = /\.(png|jpe?g|gif|webp|avif|svg|ico|mp4|webm|mov|glb|gltf)(\?|$)/i.exec(asset.name);
  return m ? `.${m[1].toLowerCase()}` : extFromMime(asset.src);
}

function extFromMime(src: string): string {
  const m = /^data:([^;,]+)/.exec(src);
  if (!m) return "";
  const mime = m[1];
  const table: Record<string, string> = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "image/svg+xml": ".svg",
    "image/avif": ".avif",
    "image/x-icon": ".ico",
    "image/vnd.microsoft.icon": ".ico",
    "video/mp4": ".mp4",
    "video/webm": ".webm",
    "model/gltf-binary": ".glb",
    "model/gltf+json": ".gltf",
  };
  return table[mime] ?? "";
}

/** File path (public/assets/...) where an asset's data URL is written on export. */
export function assetExportPath(asset: Asset): string {
  return `public/assets/${slug(asset.name) || asset.id}${extOf(asset)}`;
}

/**
 * Raw base64 payload of a base64 data URL, when the source is one.
 *
 * Uploaded assets are stored as data URLs, so this is the common case — and
 * handing the payload straight to the exporter avoids a decode/re-encode round
 * trip that used to spread every byte of the image into one function call and
 * overflow the stack on anything multi-megabyte.
 */
export function dataUrlBase64(src: string): string | null {
  const m = /^data:([^;,]+);base64,([\s\S]*)$/.exec(src);
  return m ? m[2] : null;
}

/** Base64-encodes bytes in chunks (safe for large binaries). */
export function bytesToBase64(bytes: Uint8Array): string {
  const CHUNK = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/** Decoded bytes of a data-URL asset (or null for remote URLs). */
export function dataUrlToBytes(src: string): { mime: string; bytes: Uint8Array } | null {
  const m = /^data:([^;,]+)(;base64)?,(.*)$/.exec(src);
  if (!m) return null;
  const mime = m[1];
  const raw = m[3];
  if (m[2]) {
    const bin = atob(raw);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return { mime, bytes };
  }
  return { mime, bytes: new TextEncoder().encode(decodeURIComponent(raw)) };
}
