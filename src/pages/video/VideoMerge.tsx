import { useState } from "react";
import { Merge, X, ArrowUp, ArrowDown } from "lucide-react";
import { resolveOutputPath } from "../../lib/output";
import { ToolPage } from "../../components/common/ToolPage";
import { FileDropzone } from "../../components/common/FileDropzone";
import { ResultPanel } from "../../components/common/ResultPanel";
import { ErrorPanel } from "../../components/common/ErrorPanel";
import { ProgressBar } from "../../components/common/ProgressBar";
import { Button } from "../../components/ui";
import { useProcess } from "../../hooks/useProcess";
import { usePrefilledFile } from "../../hooks/usePrefilledFile";
import { formatBytes, getFileName, getDirName } from "../../lib/utils";

interface VideoResult {
  output_path: string;
  file_size: number;
}

const VIDEO_EXTS = ["mp4", "webm", "avi", "mov", "mkv"];

export function VideoMerge() {
  const [inputPaths, setInputPaths] = useState<string[]>([]);
  const single = useProcess<VideoResult>({
    tool: "Merge Video",
    trackProgress: true,
    cancelCommand: "cancel_video_job",
  });

  const handleFiles = (paths: string[]) => {
    setInputPaths((prev) => [...prev, ...paths]);
    single.reset();
  };
  usePrefilledFile(handleFiles);

  const clear = () => {
    setInputPaths([]);
    single.reset();
  };

  const removeFile = (index: number) =>
    setInputPaths((prev) => prev.filter((_, i) => i !== index));

  const moveFile = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= inputPaths.length) return;
    setInputPaths((prev) => {
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const handleProcess = async () => {
    if (inputPaths.length < 2) return;
    const outputPath = await resolveOutputPath({
      suggested: "merged.mp4",
      filters: [{ name: "Videos", extensions: VIDEO_EXTS }],
    });
    if (!outputPath) return;
    await single.run("merge_videos", { inputPaths, outputPath });
  };

  const upload = (
    <FileDropzone
      accept={VIDEO_EXTS}
      multiple
      selectedPaths={inputPaths}
      onFiles={handleFiles}
      label="Drop videos here or click to browse"
    />
  );

  const preview = inputPaths.length > 0 ? (
    <div className="surface-elevated p-5 animate-fade-in-up">
      <h3 className="text-[13px] font-semibold text-text mb-3">
        Videos in order
        <span className="ml-1.5 text-text-muted font-normal">({inputPaths.length})</span>
      </h3>
      <div className="bg-bg-secondary p-1.5 space-y-1">
        {inputPaths.map((path, i) => (
          <div
            key={`${path}-${i}`}
            className="flex items-center gap-2 px-3 py-2 hover:bg-surface-hover transition-colors duration-150 group"
          >
            <span className="text-[12px] text-text-muted tabular-nums min-w-[1.5rem] text-center font-medium">
              {i + 1}
            </span>
            <span className="text-[13px] text-text flex-1 truncate">{getFileName(path)}</span>
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
              <button
                onClick={() => moveFile(i, -1)}
                disabled={i === 0}
                className="p-1 text-text-muted hover:text-text hover:bg-bg-secondary disabled:opacity-30 transition-colors duration-150"
              >
                <ArrowUp size={13} />
              </button>
              <button
                onClick={() => moveFile(i, 1)}
                disabled={i === inputPaths.length - 1}
                className="p-1 text-text-muted hover:text-text hover:bg-bg-secondary disabled:opacity-30 transition-colors duration-150"
              >
                <ArrowDown size={13} />
              </button>
              <button
                onClick={() => removeFile(i)}
                className="p-1 text-text-muted hover:text-danger hover:bg-danger-light transition-colors duration-150"
              >
                <X size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  ) : null;

  const controls = (
    <div className="surface-elevated p-5 animate-fade-in-up">
      <Button
        fullWidth
        onClick={handleProcess}
        disabled={inputPaths.length < 2 || single.loading}
      >
        {single.loading ? "Merging..." : "Merge videos"}
      </Button>
      {inputPaths.length === 1 && (
        <p className="text-[11px] text-text-muted mt-2">Add at least one more video to merge.</p>
      )}
    </div>
  );

  return (
    <ToolPage
      title="Merge Videos"
      description="Join multiple videos end-to-end. Inputs are re-encoded so mismatched codecs and resolutions stitch cleanly."
      icon={<Merge size={22} />}
      upload={upload}
      preview={preview}
      controls={controls}
      onClear={inputPaths.length > 0 ? clear : undefined}
    >
      {single.loading && (
        <ProgressBar
          percent={single.progress ?? -1}
          label="Merging videos..."
          onCancel={single.cancel}
        />
      )}

      {single.error && <ErrorPanel error={single.error} />}

      {single.result && (
        <ResultPanel
          outputPath={single.result.output_path}
          stats={[{ label: "File size", value: formatBytes(single.result.file_size) }]}
          onOpenFolder={async () => {
            const { open } = await import("@tauri-apps/plugin-shell");
            open(getDirName(single.result!.output_path));
          }}
        />
      )}
    </ToolPage>
  );
}
