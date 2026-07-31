import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const isMac = typeof navigator !== "undefined" && navigator.platform.toLowerCase().includes("mac");

/**
 * Global keyboard shortcuts for app navigation. Tool-page shortcuts (Ctrl+S
 * to save, Esc to cancel) belong in the individual pages so they can hook
 * into the page-local state machine.
 */
export function useKeyboardShortcuts() {
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't hijack typing inside inputs / textareas / contenteditables.
      const target = e.target as HTMLElement | null;
      if (target?.matches?.("input, textarea, [contenteditable=true]")) return;

      if (e.key === "F1" || e.key === "F2" || e.key === "F3") {
        e.preventDefault();
        navigate(e.key === "F1" ? "/" : e.key === "F2" ? "/settings" : "/?view=queue");
        return;
      }

      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (!mod) return;

      switch (e.key.toLowerCase()) {
        case ",":
          e.preventDefault();
          navigate("/settings");
          break;
        case "h":
          // Ctrl/Cmd+H is "hide" on macOS — skip there to avoid clashing.
          if (!isMac) {
            e.preventDefault();
            navigate("/");
          }
          break;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigate]);
}
