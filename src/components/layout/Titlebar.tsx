import { useState, useEffect, useMemo } from "react";
import { getCurrentWindow, type Window } from "@tauri-apps/api/window";
import { Minus, Square, X, Copy } from "lucide-react";

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

export function Titlebar() {
  const [maximized, setMaximized] = useState(false);
  const appWindow = useMemo(() => getSafeCurrentWindow(), []);

  useEffect(() => {
    const unlisten = appWindow.onResized(async () => {
      setMaximized(await appWindow.isMaximized());
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [appWindow]);

  return (
    <div
      data-tauri-drag-region
      onDoubleClick={() => appWindow.toggleMaximize()}
      className="h-9 flex items-center shrink-0 bg-bg border-b border-border select-none"
    >
      <div data-tauri-drag-region className="flex-1 min-w-0" />

      <div className="flex items-center h-full border-l border-border">
        <button
          type="button"
          aria-label="Minimize window"
          onClick={() => appWindow.minimize()}
          className="inline-flex items-center justify-center w-11 h-full text-text-muted hover:bg-text hover:text-bg"
        >
          <Minus size={12} strokeWidth={1.5} />
        </button>
        <button
          type="button"
          aria-label={maximized ? "Restore window" : "Maximize window"}
          onClick={() => appWindow.toggleMaximize()}
          className="inline-flex items-center justify-center w-11 h-full text-text-muted hover:bg-text hover:text-bg"
        >
          {maximized ? (
            <Copy size={10} strokeWidth={1.5} className="scale-x-[-1]" />
          ) : (
            <Square size={10} strokeWidth={1.5} />
          )}
        </button>
        <button
          type="button"
          aria-label="Close window"
          onClick={() => appWindow.close()}
          className="inline-flex items-center justify-center w-11 h-full text-text-muted hover:bg-danger hover:text-bg"
        >
          <X size={12} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}
