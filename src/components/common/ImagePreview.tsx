import { convertFileSrc } from "@tauri-apps/api/core";

interface ImagePreviewProps {
  path: string;
  alt?: string;
  style?: React.CSSProperties;
  className?: string;
  onLoad?: (dimensions: { width: number; height: number }) => void;
}

export function ImagePreview({
  path,
  alt = "Preview",
  style,
  className = "",
  onLoad,
}: ImagePreviewProps) {
  return (
    <div
      className={`overflow-hidden bg-bg-secondary border border-border-subtle flex items-center justify-center p-2 ${className}`}
    >
      <img
        src={convertFileSrc(path)}
        alt={alt}
        style={style}
        className="max-w-full max-h-[350px] object-contain"
        onLoad={(e) => {
          const img = e.currentTarget;
          onLoad?.({ width: img.naturalWidth, height: img.naturalHeight });
        }}
        draggable={false}
      />
    </div>
  );
}
