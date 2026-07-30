import { useState } from "react";
import { RectangleHorizontal } from "lucide-react";
import { resolveBatchOutputPath, resolveOutputPath } from "../../lib/output";
import { ErrorPanel } from "../../components/common/ErrorPanel";
import { ToolPage } from "../../components/common/ToolPage";
import { FileDropzone } from "../../components/common/FileDropzone";
import { ResultPanel } from "../../components/common/ResultPanel";
import { ProgressBar } from "../../components/common/ProgressBar";
import { BatchProgress } from "../../components/common/BatchProgress";
import { BatchResultPanel } from "../../components/common/BatchResultPanel";
import { VideoPlayer } from "../../components/common/VideoPlayer";
import { Button, Field, Input } from "../../components/ui";
import { useProcess } from "../../hooks/useProcess";
import { useVideoBatch } from "../../hooks/useVideoBatch";
import { usePrefilledFile } from "../../hooks/usePrefilledFile";
import { addSuffix, formatBytes } from "../../lib/utils";

interface ResizeResult {
  output_path: string;
  file_size: number;
}

const VIDEO_EXTENSIONS = ["mp4", "webm", "avi", "mov", "mkv"];

const PRESETS = [
  { label: "1920 x 1080", tag: "16:9", width: 1920, height: 1080 },
  { label: "1080 x 1920", tag: "9:16", width: 1080, height: 1920 },
  { label: "1080 x 1080", tag: "1:1", width: 1080, height: 1080 },
  { label: "1080 x 1350", tag: "4:5", width: 1080, height: 1350 },
];

export function VideoResize() {
  const [inputPaths, setInputPaths] = useState<string[]>([]);
  const [width, setWidth] = useState(1920);
  const [height, setHeight] = useState(1080);
  const single = useProcess<ResizeResult>({
    tool: "Resize Video",
    trackProgress: true,
    cancelCommand: "cancel_video_job",
  });
  const batch = useVideoBatch<ResizeResult>();
  const isBatch = inputPaths.length > 1;

  const handleFiles = (paths: string[]) => {
    setInputPaths(paths);
    single.reset();
    batch.reset();
  };
  usePrefilledFile(handleFiles);

  const clear = () => {
    setInputPaths([]);
    single.reset();
    batch.reset();
  };

  const applyPreset = (w: number, h: number) => {
    setWidth(w);
    setHeight(h);
  };

  const canRun = inputPaths.length > 0 && width > 0 && height > 0;

  const handleProcess = async () => {
    if (!canRun) return;

    if (!isBatch) {
      const inputPath = inputPaths[0];
      const outputPath = await resolveOutputPath({
        suggested: addSuffix(inputPath, `${width}x${height}`),
        filters: [{ name: "Video", extensions: VIDEO_EXTENSIONS }],
      });
      if (!outputPath) return;
      await single.run("resize_video", { inputPath, outputPath, width, height });
      return;
    }

    await batch.start(inputPaths, {
      command: "resize_video",
      args: (inputPath) => ({
        inputPath,
        outputPath: resolveBatchOutputPath(inputPath, { suffix: `${width}x${height}` }),
        width,
        height,
      }),
    });
  };

  const upload = (
    <FileDropzone
      accept={VIDEO_EXTENSIONS}
      multiple
      selectedPaths={inputPaths}
      onFiles={handleFiles}
      label="Drop one or more videos here or click to browse"
    />
  );

  const preview =
    inputPaths.length === 0 ? null : !isBatch ? (
      <VideoPlayer path={inputPaths[0]} />
    ) : (
      <div className="surface-elevated p-5 h-full flex flex-col items-center justify-center text-center">
        <div className="text-[13px] font-semibold text-text mb-1">
          {inputPaths.length} videos selected
        </div>
        <div className="text-[11px] text-text-muted">Batch mode</div>
      </div>
    );

  const controls = (
    <div className="surface-elevated p-5 space-y-4 animate-fade-in-up">
      <div>
        <label className="block text-[13px] font-medium text-text-secondary mb-2">Presets</label>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              onClick={() => applyPreset(preset.width, preset.height)}
              className={`px-3.5 py-2 text-[13px] font-medium border transition-all duration-200 ${
                width === preset.width && height === preset.height
                  ? "bg-primary text-primary-light border-primary"
                  : "bg-bg-secondary border-border text-text-secondary hover:border-primary/30 hover:text-text"
              }`}
            >
              <span>{preset.tag}</span>
              <span className="ml-1.5 opacity-60">{preset.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Width">
          <Input
            type="number"
            min={1}
            value={width}
            onChange={(e) => setWidth(Number(e.target.value))}
            className="tabular-nums"
          />
        </Field>
        <Field label="Height">
          <Input
            type="number"
            min={1}
            value={height}
            onChange={(e) => setHeight(Number(e.target.value))}
            className="tabular-nums"
          />
        </Field>
      </div>

      <Button
        fullWidth
        onClick={handleProcess}
        disabled={!canRun || single.loading || batch.running || inputPaths.length === 0}
      >
        {single.loading
          ? "Resizing..."
          : batch.running
            ? `Resizing ${batch.completed + 1} of ${batch.total}...`
            : isBatch
              ? `Resize ${inputPaths.length} videos`
              : "Resize video"}
      </Button>
    </div>
  );

  return (
    <ToolPage
      title="Resize Video"
      description="Resize to a specific resolution. Drop multiple files to batch-resize."
      icon={<RectangleHorizontal size={22} />}
      upload={upload}
      preview={preview}
      controls={controls}
      onClear={inputPaths.length > 0 ? clear : undefined}
    >
      {!isBatch && single.loading && (
        <ProgressBar
          percent={single.progress ?? -1}
          label="Resizing video..."
          onCancel={single.cancel}
        />
      )}
      {isBatch && (batch.running || batch.total > 0) && (
        <BatchProgress
          total={batch.total}
          completed={batch.completed}
          failed={batch.failedCount}
          current={batch.current}
          onCancel={batch.cancel}
          cancelling={batch.cancelled && batch.running}
        />
      )}

      {!isBatch && single.error && <ErrorPanel error={single.error} />}

      {!isBatch && single.result && (
        <ResultPanel
          outputPath={single.result.output_path}
          stats={[{ label: "File size", value: formatBytes(single.result.file_size) }]}
        />
      )}

      {isBatch && !batch.running && batch.total > 0 && (
        <BatchResultPanel
          succeededCount={batch.succeededCount}
          failedCount={batch.failedCount}
          failed={batch.results
            .filter((r) => r.error !== null)
            .map((r) => ({ input: r.item, error: r.error! }))}
          cancelled={batch.cancelled}
        />
      )}
    </ToolPage>
  );
}
