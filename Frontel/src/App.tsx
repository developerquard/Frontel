import { useState } from "react";
import { useEditor } from "@/lib/store";
import { Home } from "@/components/Home";
import { Workspace } from "@/components/Workspace";
import { Preview } from "@/components/Preview";

type Screen = "home" | "editor" | "preview";

export default function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const activeProjectId = useEditor((s) => s.activeProjectId);

  if (screen === "preview" && activeProjectId) {
    return <Preview onExit={() => setScreen("editor")} />;
  }
  if (screen === "editor" && activeProjectId) {
    return <Workspace onPreview={() => setScreen("preview")} onHome={() => setScreen("home")} />;
  }
  return <Home onOpen={() => setScreen("editor")} />;
}
