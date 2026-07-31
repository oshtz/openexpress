import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

interface LaunchAction {
  tool: string | null;
  route: string;
  files: string[];
}

interface TauriEventRuntime {
  transformCallback?: unknown;
}

function canUseTauriEvents(): boolean {
  const internals = (window as Window & { __TAURI_INTERNALS__?: TauriEventRuntime })
    .__TAURI_INTERNALS__;
  return typeof internals?.transformCallback === "function";
}

export function targetForLaunch({ route, files }: LaunchAction): string {
  if (files.length === 0) return route;

  const params = new URLSearchParams();
  for (const file of files) params.append("file", file);
  return `${route}?${params.toString()}`;
}

/**
 * Listens for `launch-action` events emitted by the Rust side when the app
 * is invoked from the OS shell (e.g. right-click → "Resize with OpenExpress").
 * Navigates to the target tool with repeated `?file=<encoded>` parameters so
 * the tool page can pick the complete selection up via `usePrefilledFile`.
 */
export function useLaunchAction() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!canUseTauriEvents()) return;

    let unlisten: UnlistenFn | undefined;
    void listen<LaunchAction>("launch-action", (event) => {
      navigate(targetForLaunch(event.payload));
    }).then((fn) => {
      unlisten = fn;
    }).catch(() => {});
    return () => unlisten?.();
  }, [navigate]);
}
