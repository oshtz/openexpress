import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

interface LaunchAction {
  tool: string;
  route: string;
  file: string | null;
}

interface TauriEventRuntime {
  transformCallback?: unknown;
}

function canUseTauriEvents(): boolean {
  const internals = (window as Window & { __TAURI_INTERNALS__?: TauriEventRuntime })
    .__TAURI_INTERNALS__;
  return typeof internals?.transformCallback === "function";
}

/**
 * Listens for `launch-action` events emitted by the Rust side when the app
 * is invoked from the OS shell (e.g. right-click → "Resize with OpenExpress").
 * Navigates to the target tool with `?file=<encoded>` so the tool page can
 * pick it up via `usePrefilledFile`.
 */
export function useLaunchAction() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!canUseTauriEvents()) return;

    let unlisten: UnlistenFn | undefined;
    void listen<LaunchAction>("launch-action", (event) => {
      const { route, file } = event.payload;
      const target = file
        ? `${route}?file=${encodeURIComponent(file)}`
        : route;
      navigate(target);
    }).then((fn) => {
      unlisten = fn;
    }).catch(() => {});
    return () => unlisten?.();
  }, [navigate]);
}
