import { useEffect, useState } from "react";
import { Crop } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { resolveOutputPath } from "../../lib/output";
import { ToolPage } from "../../components/common/ToolPage";
import { FileDropzone } from "../../components/common/FileDropzone";
import { ResultPanel } from "../../components/common/ResultPanel";
import { ErrorPanel } from "../../components/common/ErrorPanel";
import { ProgressBar } from "../../components/common/ProgressBar";
import { VideoPlayer } from "../../components/common/VideoPlayer";
import { Button } from "../../components/ui";
import { useProcess } from "../../hooks/useProcess";
import { usePrefilledFile } from "../../hooks/usePrefilledFile";
import { addSuffix, formatBytes } from "../../lib/utils";

interface VideoResult {
  output_path: string;
  file_size: number;
}

interface VideoInfo {
  duration_secs: number;
  width: number;
  height: number;
  codec: string;
  file_size: number;
}

const VIDEO_EXTS = ["mp4", "webm", "avi", "mov", "mkv"];

type Aspect = "landscape" | "portrait" | "square" | "source";

const PRESETS: { id: Aspect; label: string; ratio: number | null }[] = [
  { id: "landscape", label: "16:9", ratio: 16 / 9 },
  { id: "portrait", label: "9:16", ratio: 9 / 16 },
  { id: "square", label: "1:1", ratio: 1 },
  { id: "source", label: "Source", ratio: null },
];

/**
 * Returns the largest centered rect that fits inside `sw x sh` at the given
 * target aspect ratio. `ratio` null means "use source dims (no-op)".
 */
function computeCenteredCrop(sw: number, sh: number, ratio: number | null) {
  if (ratio === null) return { width: sw, height: sh, x: 0, y: 0 };
  const sourceRatio = sw / sh;
  let cw: number;
  let ch: number;
  if (sourceRatio > ratio) {
    ch = sh;
    cw = Math.round(sh * ratio);
  } else {
    cw = sw;
    ch = Math.round(sw / ratio);
  }
  // ffmpeg requires even dimensions for most codecs.
  cw -= cw % 2;
  ch -= ch % 2;
  const x = Math.floor((sw - cw) / 2);
  const y = Math.floor((sh - ch) / 2);
  return { width: cw, height: ch, x, y };
}

export function VideoCrop() {
  const [inputPaths, setInputPaths] = useState<string[]>([]);
  const [info, setInfo] = useState<VideoInfo | null>(null);
  const [aspect, setAspect] = useState<Aspect>("landscape");
  const single = useProcess<VideoResult>({
    tool: "Crop",
    trackProgress: true,
    cancelCommand: "cancel_video_job",
  });

  const handleFiles = (paths: string[]) => {
    setInputPaths(paths);
    setInfo(null);
    single.reset();
  };
  usePrefilledFile(handleFiles);

  const clear = () => {
    setInputPaths([]);
    setInfo(null);
    single.reset();
  };

  useEffect(() => {
    if (inputPaths.length === 0) return;
    let cancelled = false;
    invoke<VideoInfo>("get_video_info", { inputPath: inputPaths[0] })
      .then((v) => {
        if (!cancelled) setInfo(v);
      })
      .catch(() => {
        if (!cancelled) setInfo(null);
      });
    return () => {
      cancelled = true;
    };
  }, [inputPaths]);

  const cropRect = info
    ? computeCenteredCrop(info.width, info.height, PRESETS.find((p) => p.id === aspect)!.ratio)
    : null;

  const handleProcess = async () => {
    if (inputPaths.length === 0 || !info || !cropRect) return;
    const inputPath = inputPaths[0];
    const outputPath = await resolveOutputPath({
      suggested: addSuffix(inputPath, "cropped"),
      filters: [{ name: "Videos", extensions: VIDEO_EXTS }],
    });
    if (!outputPath) return;
    await single.run("crop_video", {
      inputPath,
      outputPath,
      width: cropRect.width,
      height: cropRect.height,
      x: cropRect.x,
      y: cropRect.y,
    });
  };

  const upload = (
    <FileDropzone
      accept={VIDEO_EXTS}
      onFiles={handleFiles}
      label="Drop a video here or click to browse"
    />
  );

  const preview = inputPaths.length > 0 ? <VideoPlayer path={inputPaths[0]} /> : null;

  const controls = (
    <div className="surface-elevated p-5 space-y-4 animate-fade-in-up">
      <div>
        <label className="block text-[13px] font-medium text-text-secondary mb-2">
          Aspect ratio
        </label>
        <div className="grid grid-cols-4 gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setAspect(p.id)}
              className={`py-2 text-[13px] font-medium border transition-all ${
                aspect === p.id
                  ? "bg-primary text-primary-light border-primary"
                  : "bg-bg-secondary border-border text-text-secondary hover:border-primary/30 hover:text-text"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {info && cropRect && (
        <div className="text-[12px] text-text-muted tabular-nums">
          Source {info.width}x{info.height} -&gt; output {cropRect.width}x{cropRect.height}
          {aspect !== "source" && (
            <> (offset {cropRect.x},{cropRect.y})</>
          )}
        </div>
      )}

      <Button
        fullWidth
        onClick={handleProcess}
        disabled={single.loading || !info || inputPaths.length === 0}
      >
        {single.loading
          ? "Cropping..."
          : !info && inputPaths.length > 0
            ? "Reading video..."
            : "Crop video"}
      </Button>
    </div>
  );

  return (
    <ToolPage
      title="Crop Video"
      description="Center-crop a video to a target aspect ratio."
      icon={<Crop size={22} />}
      upload={upload}
      preview={preview}
      controls={controls}
      onClear={inputPaths.length > 0 ? clear : undefined}
    >
      {single.loading && (
        <ProgressBar
          percent={single.progress ?? -1}
          label="Cropping video..."
          onCancel={single.cancel}
        />
      )}

      {single.error && <ErrorPanel error={single.error} />}

      {single.result && (
        <ResultPanel
          outputPath={single.result.output_path}
          stats={[{ label: "File size", value: formatBytes(single.result.file_size) }]}
        />
      )}
    </ToolPage>
  );
}
