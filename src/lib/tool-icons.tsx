import type { ReactNode } from "react";
import {
  Scaling,
  Crop,
  RefreshCw,
  SunMedium,
  Minimize2,
  RotateCw,
  Scissors,
  Sparkles,
  Droplet,
  Shapes,
  Rewind,
  VolumeX,
  LayoutGrid,
  Volume2,
  TrendingUp,
  TrendingDown,
  Headphones,
  Wand2,
  FileVideo,
  RectangleHorizontal,
  Film,
  Gauge,
  Music,
  Merge,
  FileImage,
  FileDown,
  FileArchive,
  Image as ImageIcon,
  Video,
  FileText,
} from "lucide-react";

/**
 * Maps a `ToolSpec.id` to its Lucide icon. Single source of truth for icons
 * so PickTool / Home / Sidebar all stay in sync.
 */
export function iconFor(toolId: string, size = 20): ReactNode {
  switch (toolId) {
    case "image-resize":
      return <Scaling size={size} />;
    case "image-crop":
      return <Crop size={size} />;
    case "image-convert":
      return <RefreshCw size={size} />;
    case "image-adjust":
      return <SunMedium size={size} />;
    case "image-compress":
      return <Minimize2 size={size} />;
    case "image-rotate":
      return <RotateCw size={size} />;
    case "image-sharpen":
      return <Sparkles size={size} />;
    case "image-blur":
      return <Droplet size={size} />;
    case "image-vector-trace":
      return <Shapes size={size} />;
    case "image-remove-bg":
      return <Scissors size={size} />;
    case "image-upscale":
      return <Wand2 size={size} />;
    case "video-trim":
      return <Scissors size={size} />;
    case "video-convert":
      return <FileVideo size={size} />;
    case "video-resize":
      return <RectangleHorizontal size={size} />;
    case "video-to-gif":
      return <Film size={size} />;
    case "video-speed":
      return <Gauge size={size} />;
    case "video-audio":
      return <Music size={size} />;
    case "video-crop":
      return <Crop size={size} />;
    case "video-reverse":
      return <Rewind size={size} />;
    case "video-mute":
      return <VolumeX size={size} />;
    case "video-merge":
      return <Merge size={size} />;
    case "pdf-merge":
      return <Merge size={size} />;
    case "image-to-pdf":
      return <FileImage size={size} />;
    case "pdf-to-image":
      return <FileDown size={size} />;
    case "pdf-compress":
      return <FileArchive size={size} />;
    case "pdf-split":
      return <Scissors size={size} />;
    case "pdf-organize":
      return <LayoutGrid size={size} />;
    case "audio-trim":
      return <Scissors size={size} />;
    case "audio-convert":
      return <RefreshCw size={size} />;
    case "audio-fade-in":
      return <TrendingUp size={size} />;
    case "audio-fade-out":
      return <TrendingDown size={size} />;
    case "audio-volume":
      return <Volume2 size={size} />;
    default:
      return null;
  }
}

/**
 * Category icon + accent classes used by Home and PickTool category headers.
 */
export const CATEGORY_META = {
  image: {
    label: "Image",
    icon: <ImageIcon size={18} />,
    bg: "bg-image-light",
    text: "text-image",
  },
  video: {
    label: "Video",
    icon: <Video size={18} />,
    bg: "bg-video-light",
    text: "text-video",
  },
  pdf: {
    label: "PDF",
    icon: <FileText size={18} />,
    bg: "bg-pdf-light",
    text: "text-pdf",
  },
  audio: {
    label: "Audio",
    icon: <Headphones size={18} />,
    bg: "bg-audio-light",
    text: "text-audio",
  },
} as const;
