import JSZip from "jszip";
import type { Project } from "@/schemas/types";
import { generateProjectFiles } from "@/code/generator";

/** Triggers a browser download for a blob. */
function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.style.display = "none";
  // The anchor has to be in the document for the click to count as a real user
  // download, and the object URL must outlive the click — revoking it
  // immediately cancelled the download in embedded browsers.
  document.body.appendChild(a);
  a.click();
  window.setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 10_000);
}

export function downloadProjectJson(project: Project) {
  const json = JSON.stringify(project, null, 2);
  download(new Blob([json], { type: "application/json" }), `${slugFile(project.name)}.frontel.json`);
}

/** Parses imported project JSON, validating the minimum shape. */
export function parseProjectJson(text: string): Project {
  const data = JSON.parse(text) as Project;
  if (!data || typeof data !== "object") throw new Error("Not a Frontel project");
  if (!data.nodes || !data.pages || !data.theme) throw new Error("Missing project fields");
  if (data.version !== 1) throw new Error(`Unsupported schema version: ${data.version}`);
  return data;
}

export async function downloadProjectZip(project: Project) {
  const zip = new JSZip();
  const files = generateProjectFiles(project);

  for (const [path, content] of Object.entries(files)) {
    if (content.startsWith("base64:")) {
      // Binary assets: decode the base64 payload into real bytes.
      const bin = atob(content.slice(7));
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      zip.file(path, bytes);
    } else {
      zip.file(path, content);
    }
  }

  const blob = await zip.generateAsync({ type: "blob" });
  download(blob, `${slugFile(project.name)}.zip`);
}

function slugFile(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "frontel-project"
  );
}
