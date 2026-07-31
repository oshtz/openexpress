import { useState } from "react";
import { Film } from "lucide-react";
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
import { replaceExtension, formatBytes } from "../../lib/utils";

interface GifResult {
  output_path: string;
  file_size: number;
}

const VIDEO_EXTENSIONS = ["mp4", "webm", "avi", "mov", "mkv"];

export function VideoToGif() {
  const [inputPaths, setInputPaths] = useState<string[]>([]);
  const [fps, setFps] = useState(10);
  const [width, setWidth] = useState(480);
  const single = useProcess<GifResult>({
    tool: "To GIF",
    trackProgress: true,
    cancelCommand: "cancel_video_job",
  });
  const batch = useVideoBatch<GifResult>();
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

  const canRun = inputPaths.length > 0 && fps > 0 && width > 0;

  const handleProcess = async () => {
    if (!canRun) return;

    if (!isBatch) {
      const inputPath = inputPaths[0];
      const outputPath = await resolveOutputPath({
        suggested: replaceExtension(inputPath, "gif"),
        filters: [{ name: "GIF", extensions: ["gif"] }],
      });
      if (!outputPath) return;
      await single.run("video_to_gif", { inputPath, outputPath, fps, width });
      return;
    }

    await batch.start(inputPaths, {
      command: "video_to_gif",
      args: (inputPath) => ({
        inputPath,
        outputPath: resolveBatchOutputPath(inputPath, {
          suffix: "anim",
          targetExtension: "gif",
        }),
        fps,
        width,
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
      <div className="grid grid-cols-2 gap-4">
        <Field label="FPS">
          <Input
            type="number"
            min={1}
            max={60}
            value={fps}
            onChange={(e) => setFps(Number(e.target.value))}
            className="tabular-nums"
          />
        </Field>
        <Field label="Width (px)">
          <Input
            type="number"
            min={1}
            value={width}
            onChange={(e) => setWidth(Number(e.target.value))}
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
          ? "Converting..."
          : batch.running
            ? `Converting ${batch.completed + 1} of ${batch.total}...`
            : isBatch
              ? `Convert ${inputPaths.length} videos`
              : "Convert to GIF"}
      </Button>
    </div>
  );

  return (
    <ToolPage
      title="Video to GIF"
      description="Convert video clips to animated GIFs. Drop multiple files to batch-convert."
      icon={<Film size={22} />}
      upload={upload}
      preview={preview}
      controls={controls}
      onClear={inputPaths.length > 0 ? clear : undefined}
    >
      {!isBatch && single.loading && (
        <ProgressBar
          percent={single.progress ?? -1}
          label="Converting to GIF..."
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
