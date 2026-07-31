import type { ComponentType, ReactNode, SVGProps } from "react";
import {
  AiScan,
  AspectRatio,
  AudioWaveform,
  FileText,
  Filter,
  Frame,
  Grid3x3,
  Image,
  ImageNew,
  MicOff,
  Radius,
  Reload,
  Repeat,
  Scale,
  Scissors,
  SectionMinus,
  Shapes,
  Sparkles,
  SpeedFast,
  SquareDashedCursor,
  SquareScissors,
  Undo,
  Video,
  Volume2,
  WavesArrowDown,
  WavesArrowUp,
  Files,
} from "pixelarticons/react";

type PixelIcon = ComponentType<SVGProps<SVGSVGElement>>;

function renderIcon(Icon: PixelIcon, size: number): ReactNode {
  return <Icon width={size} height={size} aria-hidden />;
}

export function iconFor(toolId: string, size = 20): ReactNode {
  const Icon: PixelIcon | undefined = {
    "image-resize": Scale,
    "image-crop": SquareDashedCursor,
    "image-convert": Repeat,
    "image-adjust": Filter,
    "image-compress": SectionMinus,
    "image-rotate": Reload,
    "image-sharpen": Sparkles,
    "image-blur": Radius,
    "image-vector-trace": Shapes,
    "image-remove-bg": SquareScissors,
    "image-upscale": AiScan,
    "video-trim": Scissors,
    "video-convert": Repeat,
    "video-resize": AspectRatio,
    "video-to-gif": Video,
    "video-speed": SpeedFast,
    "video-audio": AudioWaveform,
    "video-crop": Frame,
    "video-reverse": Undo,
    "video-mute": MicOff,
    "video-merge": Files,
    "pdf-merge": Files,
    "image-to-pdf": ImageNew,
    "pdf-compress": SectionMinus,
    "pdf-split": Scissors,
    "pdf-organize": Grid3x3,
    "audio-trim": Scissors,
    "audio-convert": Repeat,
    "audio-fade-in": WavesArrowUp,
    "audio-fade-out": WavesArrowDown,
    "audio-volume": Volume2,
  }[toolId];

  return Icon ? renderIcon(Icon, size) : null;
}

export const CATEGORY_META = {
  image: {
    label: "Image",
    icon: renderIcon(Image, 18),
    bg: "bg-image-light",
    text: "text-image",
  },
  video: {
    label: "Video",
    icon: renderIcon(Video, 18),
    bg: "bg-video-light",
    text: "text-video",
  },
  pdf: {
    label: "PDF",
    icon: renderIcon(FileText, 18),
    bg: "bg-pdf-light",
    text: "text-pdf",
  },
  audio: {
    label: "Audio",
    icon: renderIcon(AudioWaveform, 18),
    bg: "bg-audio-light",
    text: "text-audio",
  },
} as const;
