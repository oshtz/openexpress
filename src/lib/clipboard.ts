import { invoke } from "@tauri-apps/api/core";

const RASTER_IMAGE_EXTS = ["jpg", "jpeg", "png", "webp", "bmp", "tif", "tiff", "gif"];

export function isClipboardCopyableImage(path: string): boolean {
  const i = path.lastIndexOf(".");
  if (i < 0) return false;
  return RASTER_IMAGE_EXTS.includes(path.slice(i + 1).toLowerCase());
}

export async function copyImageToClipboard(path: string): Promise<void> {
  await invoke("copy_image_to_clipboard", { path });
}

export async function pasteImageAsFile(): Promise<string> {
  return invoke<string>("paste_image_as_file");
}
