import { useState } from "react";
import { Rewind } from "lucide-react";
import { resolveBatchOutputPath, resolveOutputPath } from "../../lib/output";
import { ToolPage } from "../../components/common/ToolPage";
import { FileDropzone } from "../../components/common/FileDropzone";
import { ResultPanel } from "../../components/common/ResultPanel";
import { ErrorPanel } from "../../components/common/ErrorPanel";
import { ProgressBar } from "../../components/common/ProgressBar";
import { BatchProgress } from "../../components/common/BatchProgress";
import { BatchResultPanel } from "../../components/common/BatchResultPanel";
import { VideoPlayer } from "../../components/common/VideoPlayer";
import { Button, Checkbox } from "../../components/ui";
import { useProcess } from "../../hooks/useProcess";
import { useVideoBatch } from "../../hooks/useVideoBatch";
import { usePrefilledFile } from "../../hooks/usePrefilledFile";
import { addSuffix, formatBytes } from "../../lib/utils";

interface VideoResult {
  output_path: string;
  file_size: number;
}

const VIDEO_EXTS = ["mp4", "webm", "avi", "mov", "mkv"];

export function VideoReverse() {
  const [inputPaths, setInputPaths] = useState<string[]>([]);
  const [keepAudio, setKeepAudio] = useState(true);
  const single = useProcess<VideoResult>({
    tool: "Reverse",
    trackProgress: true,
    cancelCommand: "cancel_video_job",
  });
  const batch = useVideoBatch<VideoResult>();
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

  const handleProcess = async () => {
    if (inputPaths.length === 0) return;

    if (!isBatch) {
      const inputPath = inputPaths[0];
      const outputPath = await resolveOutputPath({
        suggested: addSuffix(inputPath, "reversed"),
        filters: [{ name: "Videos", extensions: VIDEO_EXTS }],
      });
      if (!outputPath) return;
      await single.run("reverse_video", { inputPath, outputPath, keepAudio });
      return;
    }

    await batch.start(inputPaths, {
      command: "reverse_video",
      args: (inputPath) => ({
        inputPath,
        outputPath: resolveBatchOutputPath(inputPath, { suffix: "reversed" }),
        keepAudio,
      }),
    });
  };

  const upload = (
    <FileDropzone
      accept={VIDEO_EXTS}
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
      <Checkbox
        label="Reverse audio too"
        checked={keepAudio}
        onChange={(e) => setKeepAudio(e.target.checked)}
      />

      <Button
        fullWidth
        onClick={handleProcess}
        disabled={single.loading || batch.running || inputPaths.length === 0}
      >
        {single.loading
          ? "Reversing..."
          : batch.running
            ? `Reversing ${batch.completed + 1} of ${batch.total}...`
            : isBatch
              ? `Reverse ${inputPaths.length} videos`
              : "Reverse video"}
      </Button>
    </div>
  );

  return (
    <ToolPage
      title="Reverse Video"
      description="Play a video backwards. Drop multiple files to batch-reverse."
      icon={<Rewind size={22} />}
      upload={upload}
      preview={preview}
      controls={controls}
      onClear={inputPaths.length > 0 ? clear : undefined}
    >
      {!isBatch && single.loading && (
        <ProgressBar
          percent={single.progress ?? -1}
          label="Reversing video..."
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
