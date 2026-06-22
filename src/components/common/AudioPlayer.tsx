import { convertFileSrc } from "@tauri-apps/api/core";

interface AudioPlayerProps {
  path: string;
  onLoadedMetadata?: (duration: number) => void;
  className?: string;
}

export function AudioPlayer({ path, onLoadedMetadata, className = "" }: AudioPlayerProps) {
  return (
    <div
      className={`surface-elevated p-6 flex flex-col items-center justify-center min-h-[280px] ${className}`}
    >
      <audio
        src={convertFileSrc(path)}
        controls
        onLoadedMetadata={(e) => onLoadedMetadata?.(e.currentTarget.duration)}
        className="w-full max-w-md"
        style={{ height: 40 }}
      />
      <p
        className="mt-4 text-center"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          color: "var(--color-text-muted)",
          wordBreak: "break-all",
          maxWidth: "40ch",
        }}
      >
        {path}
      </p>
    </div>
  );
}
