import { invoke } from "@tauri-apps/api/core";

export async function allowAssetPaths(paths: string[]): Promise<void> {
  const internals = (
    window as Window & {
      __TAURI_INTERNALS__?: { transformCallback?: unknown };
    }
  ).__TAURI_INTERNALS__;
  if (paths.length === 0 || typeof internals?.transformCallback !== "function") return;
  await invoke("allow_asset_paths", { paths });
}
