import { useState } from "react";
import { Gauge } from "lucide-react";
import { resolveBatchOutputPath, resolveOutputPath } from "../../lib/output";
import { ErrorPanel } from "../../components/common/ErrorPanel";
import { ToolPage } from "../../components/common/ToolPage";
import { FileDropzone } from "../../components/common/FileDropzone";
import { ResultPanel } from "../../components/common/ResultPanel";
import { ProgressBar } from "../../components/common/ProgressBar";
import { BatchProgress } from "../../components/common/BatchProgress";
import { BatchResultPanel } from "../../components/common/BatchResultPanel";
import { VideoPlayer } from "../../components/common/VideoPlayer";
import { Button } from "../../components/ui";
import { useProcess } from "../../hooks/useProcess";
import { useVideoBatch } from "../../hooks/useVideoBatch";
import { usePrefilledFile } from "../../hooks/usePrefilledFile";
import { addSuffix, formatBytes } from "../../lib/utils";

interface SpeedResult {
  output_path: string;
  file_size: number;
}

const VIDEO_EXTENSIONS = ["mp4", "webm", "avi", "mov", "mkv"];
const SPEED_PRESETS = [0.25, 0.5, 1, 1.5, 2, 4];

export function VideoSpeed() {
  const [inputPaths, setInputPaths] = useState<string[]>([]);
  const [speed, setSpeed] = useState(1.0);
  const single = useProcess<SpeedResult>({
    tool: "Speed",
    trackProgress: true,
    cancelCommand: "cancel_video_job",
  });
  const batch = useVideoBatch<SpeedResult>();
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

  const canRun = inputPaths.length > 0 && speed > 0;

  const handleProcess = async () => {
    if (!canRun) return;

    if (!isBatch) {
      const inputPath = inputPaths[0];
      const outputPath = await resolveOutputPath({
        suggested: addSuffix(inputPath, `${speed}x`),
        filters: [{ name: "Video", extensions: VIDEO_EXTENSIONS }],
      });
      if (!outputPath) return;
      await single.run("change_speed", { inputPath, outputPath, speed });
      return;
    }

    await batch.start(inputPaths, {
      command: "change_speed",
      args: (inputPath) => ({
        inputPath,
        outputPath: resolveBatchOutputPath(inputPath, { suffix: `${speed}x` }),
        speed,
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
      <VideoPlayer path={inputPaths[0]} playbackRate={speed} />
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
        <label className="block text-[13px] font-medium text-text-secondary mb-2">Speed</label>
        <div className="flex flex-wrap gap-2">
          {SPEED_PRESETS.map((preset) => (
            <button
              key={preset}
              onClick={() => setSpeed(preset)}
              className={`px-4 py-2 text-[13px] font-medium border transition-all duration-200 ${
                speed === preset
                  ? "bg-primary text-primary-light border-primary"
                  : "bg-bg-secondary border-border text-text-secondary hover:border-primary/30 hover:text-text"
              }`}
            >
              {preset}x
            </button>
          ))}
        </div>
      </div>

      <Button
        fullWidth
        onClick={handleProcess}
        disabled={!canRun || single.loading || batch.running || inputPaths.length === 0}
      >
        {single.loading
          ? "Processing..."
          : batch.running
            ? `Processing ${batch.completed + 1} of ${batch.total}...`
            : isBatch
              ? `Change speed on ${inputPaths.length} videos`
              : "Change speed"}
      </Button>
    </div>
  );

  return (
    <ToolPage
      title="Change Speed"
      description="Speed up or slow down videos. Drop multiple files to batch-apply."
      icon={<Gauge size={22} />}
      upload={upload}
      preview={preview}
      controls={controls}
      onClear={inputPaths.length > 0 ? clear : undefined}
    >
      {!isBatch && single.loading && (
        <ProgressBar
          percent={single.progress ?? -1}
          label="Changing speed..."
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
