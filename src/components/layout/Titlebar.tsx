import { useEffect, useMemo, useState } from "react";
import { getCurrentWindow, type Window } from "@tauri-apps/api/window";
import { useLocation, useNavigate } from "react-router-dom";
import { Close, Copy, Minus, Square } from "pixelarticons/react";

function createBrowserWindowStub(): Pick<
  Window,
  "close" | "isMaximized" | "minimize" | "onResized" | "toggleMaximize"
> {
  return {
    close: async () => undefined,
    isMaximized: async () => false,
    minimize: async () => undefined,
    onResized: async () => () => undefined,
    toggleMaximize: async () => undefined,
  };
}

function getSafeCurrentWindow() {
  if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) {
    return createBrowserWindowStub();
  }
  return getCurrentWindow();
}

const tabs = [
  { label: "Open", view: "open" },
  { label: "Recent", view: "recent" },
  { label: "Queue", view: "queue" },
] as const;

export function Titlebar() {
  const [maximized, setMaximized] = useState(false);
  const appWindow = useMemo(() => getSafeCurrentWindow(), []);
  const location = useLocation();
  const navigate = useNavigate();
  const activeView = new URLSearchParams(location.search).get("view") || "open";

  useEffect(() => {
    const unlisten = appWindow.onResized(async () => {
      setMaximized(await appWindow.isMaximized());
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [appWindow]);

  const openView = (view: (typeof tabs)[number]["view"]) => {
    navigate(view === "open" ? "/" : `/?view=${view}`);
  };

  return (
    <header
      data-tauri-drag-region
      onDoubleClick={() => appWindow.toggleMaximize()}
      className="app-titlebar"
    >
      <button
        type="button"
        className="brand-button"
        onClick={() => openView("open")}
        aria-label="OpenExpress home"
      >
        <img src="/openexpress-logo-pixel.svg" alt="OpenExpress" />
      </button>

      <nav className="titlebar-tabs" aria-label="Workspace">
        {tabs.map((tab) => (
          <button
            key={tab.view}
            type="button"
            className={location.pathname === "/" && activeView === tab.view ? "active" : ""}
            onClick={() => openView(tab.view)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div data-tauri-drag-region className="titlebar-spacer" />

      <div className="local-status">
        Local / Offline
      </div>

      <div className="window-controls">
        <button type="button" aria-label="Minimize window" onClick={() => appWindow.minimize()}>
          <Minus width={16} height={16} />
        </button>
        <button
          type="button"
          aria-label={maximized ? "Restore window" : "Maximize window"}
          onClick={() => appWindow.toggleMaximize()}
        >
          {maximized ? <Copy width={14} height={14} /> : <Square width={14} height={14} />}
        </button>
        <button type="button" aria-label="Close window" onClick={() => appWindow.close()}>
          <Close width={16} height={16} />
        </button>
      </div>
    </header>
  );
}
