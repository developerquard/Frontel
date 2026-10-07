import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { useEditor } from "./lib/store.ts";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Dev-only hook for automated verification (tree-shaken from prod builds).
if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).useEditor = useEditor;
}
