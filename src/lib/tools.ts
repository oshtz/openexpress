/**
 * Frontend mirror of `src-tauri/src/shell/tools.rs::TOOLS`.
 *
 * Used by the file-type picker (`/pick`) and the Home grid filter. Keep in
 * sync with the Rust slice — if you add a tool there, add it here.
 */

export interface ToolSpec {
  id: string;
  label: string;
  /** Short two-line description shown on tool tiles. */
  description: string;
  /** Frontend route to navigate to when the tool is picked. */
  route: string;
  /** Top-level category for grouping/coloring. */
  category: "image" | "video" | "pdf" | "audio";
  /** File extensions this tool accepts. Lowercase, no leading dot. */
  extensions: readonly string[];
}

const IMAGE_EXTS = ["jpg", "jpeg", "png", "webp", "bmp", "tiff"] as const;
const VIDEO_EXTS = ["mp4", "webm", "avi", "mov", "mkv"] as const;
const PDF_EXTS = ["pdf"] as const;
const AUDIO_EXTS = ["mp3", "wav", "m4a", "flac", "ogg", "aac", "opus"] as const;

export const TOOLS: readonly ToolSpec[] = [
  // Image
  { id: "image-resize", label: "Resize", description: "Custom dimensions & presets", route: "/image/resize", category: "image", extensions: IMAGE_EXTS },
  { id: "image-crop", label: "Crop", description: "Precise area selection", route: "/image/crop", category: "image", extensions: IMAGE_EXTS },
  { id: "image-convert", label: "Convert", description: "Format transformation", route: "/image/convert", category: "image", extensions: IMAGE_EXTS },
  { id: "image-compress", label: "Compress", description: "Reduce file size", route: "/image/compress", category: "image", extensions: IMAGE_EXTS },
  { id: "image-rotate", label: "Rotate / Flip", description: "Rotate & flip", route: "/image/rotate", category: "image", extensions: IMAGE_EXTS },
  { id: "image-adjust", label: "Adjust", description: "Brightness & contrast", route: "/image/adjust", category: "image", extensions: IMAGE_EXTS },
  { id: "image-sharpen", label: "Sharpen", description: "Enhance edge clarity", route: "/image/sharpen", category: "image", extensions: IMAGE_EXTS },
  { id: "image-blur", label: "Blur", description: "Gaussian blur", route: "/image/blur", category: "image", extensions: IMAGE_EXTS },
  { id: "image-vector-trace", label: "Trace to SVG", description: "Raster to vector", route: "/image/vector-trace", category: "image", extensions: IMAGE_EXTS },
  { id: "image-remove-bg", label: "Remove BG", description: "AI background removal", route: "/image/remove-bg", category: "image", extensions: IMAGE_EXTS },
  { id: "image-upscale", label: "AI Upscale", description: "Super-resolution 2x / 4x", route: "/image/upscale", category: "image", extensions: IMAGE_EXTS },
  // Video
  { id: "video-trim", label: "Trim", description: "Cut video segments", route: "/video/trim", category: "video", extensions: VIDEO_EXTS },
  { id: "video-convert", label: "Convert", description: "Format conversion", route: "/video/convert", category: "video", extensions: VIDEO_EXTS },
  { id: "video-resize", label: "Resize", description: "Change resolution", route: "/video/resize", category: "video", extensions: VIDEO_EXTS },
  { id: "video-to-gif", label: "To GIF", description: "Animated GIF export", route: "/video/gif", category: "video", extensions: VIDEO_EXTS },
  { id: "video-speed", label: "Speed", description: "Playback rate control", route: "/video/speed", category: "video", extensions: VIDEO_EXTS },
  { id: "video-audio", label: "Extract audio", description: "Pull audio track", route: "/video/audio", category: "video", extensions: VIDEO_EXTS },
  { id: "video-crop", label: "Crop", description: "Center-crop to aspect ratio", route: "/video/crop", category: "video", extensions: VIDEO_EXTS },
  { id: "video-reverse", label: "Reverse", description: "Play backwards", route: "/video/reverse", category: "video", extensions: VIDEO_EXTS },
  { id: "video-mute", label: "Mute", description: "Strip audio track", route: "/video/mute", category: "video", extensions: VIDEO_EXTS },
  { id: "video-merge", label: "Merge", description: "Join videos end-to-end", route: "/video/merge", category: "video", extensions: VIDEO_EXTS },
  // PDF
  { id: "pdf-merge", label: "Merge", description: "Combine multiple PDFs", route: "/pdf/merge", category: "pdf", extensions: PDF_EXTS },
  { id: "pdf-compress", label: "Compress", description: "Reduce PDF size", route: "/pdf/compress", category: "pdf", extensions: PDF_EXTS },
  { id: "pdf-to-image", label: "PDF to images", description: "Export pages", route: "/pdf/pdf-to-image", category: "pdf", extensions: PDF_EXTS },
  { id: "pdf-split", label: "Split", description: "Extract page range", route: "/pdf/split", category: "pdf", extensions: PDF_EXTS },
  { id: "pdf-organize", label: "Organize pages", description: "Reorder, delete, rotate", route: "/pdf/organize", category: "pdf", extensions: PDF_EXTS },
  // Cross-category: image → PDF
  { id: "image-to-pdf", label: "Image to PDF", description: "Build a PDF from images", route: "/pdf/image-to-pdf", category: "pdf", extensions: IMAGE_EXTS },
  // Audio
  { id: "audio-trim", label: "Trim", description: "Cut a segment", route: "/audio/trim", category: "audio", extensions: AUDIO_EXTS },
  { id: "audio-convert", label: "Convert", description: "Transcode format", route: "/audio/convert", category: "audio", extensions: AUDIO_EXTS },
  { id: "audio-fade-in", label: "Fade in", description: "Linear fade-in", route: "/audio/fade-in", category: "audio", extensions: AUDIO_EXTS },
  { id: "audio-fade-out", label: "Fade out", description: "Linear fade-out", route: "/audio/fade-out", category: "audio", extensions: AUDIO_EXTS },
  { id: "audio-volume", label: "Volume", description: "Gain adjustment", route: "/audio/volume", category: "audio", extensions: AUDIO_EXTS },
];

export function extensionOf(path: string): string {
  const i = path.lastIndexOf(".");
  return i >= 0 ? path.slice(i + 1).toLowerCase() : "";
}

export function toolsForExtension(ext: string): ToolSpec[] {
  const normalized = ext.replace(/^\./, "").toLowerCase();
  return TOOLS.filter((t) => t.extensions.includes(normalized));
}

export function toolsForPath(path: string): ToolSpec[] {
  return toolsForExtension(extensionOf(path));
}
