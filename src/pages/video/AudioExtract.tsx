import { useState } from "react";
import { Music } from "lucide-react";
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
import { replaceExtension, formatBytes } from "../../lib/utils";

interface ExtractResult {
  output_path: string;
  file_size: number;
}

const VIDEO_EXTENSIONS = ["mp4", "webm", "avi", "mov", "mkv"];
const AUDIO_FORMATS = ["mp3", "wav", "ogg", "flac", "aac"] as const;

export function AudioExtract() {
  const [inputPaths, setInputPaths] = useState<string[]>([]);
  const [audioFormat, setAudioFormat] = useState<string>("mp3");
  const single = useProcess<ExtractResult>({
    tool: "Audio",
    trackProgress: true,
    cancelCommand: "cancel_video_job",
  });
  const batch = useVideoBatch<ExtractResult>();
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
        suggested: replaceExtension(inputPath, audioFormat),
        filters: [{ name: "Audio", extensions: [audioFormat] }],
      });
      if (!outputPath) return;
      await single.run("extract_audio", { inputPath, outputPath });
      return;
    }

    await batch.start(inputPaths, {
      command: "extract_audio",
      args: (inputPath) => ({
        inputPath,
        outputPath: resolveBatchOutputPath(inputPath, {
          suffix: "audio",
          targetExtension: audioFormat,
        }),
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
        <label className="block text-[13px] font-medium text-text-secondary mb-2">
          Audio format
        </label>
        <div className="flex flex-wrap gap-2">
          {AUDIO_FORMATS.map((fmt) => (
            <button
              key={fmt}
              onClick={() => setAudioFormat(fmt)}
              className={`px-3.5 py-2 text-[13px] font-medium border transition-all duration-200 ${
                audioFormat === fmt
                  ? "bg-primary text-primary-light border-primary"
                  : "bg-bg-secondary border-border text-text-secondary hover:border-primary/30 hover:text-text"
              }`}
            >
              {fmt.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <Button
        fullWidth
        onClick={handleProcess}
        disabled={single.loading || batch.running || inputPaths.length === 0}
      >
        {single.loading
          ? "Extracting..."
          : batch.running
            ? `Extracting ${batch.completed + 1} of ${batch.total}...`
            : isBatch
              ? `Extract audio from ${inputPaths.length} videos`
              : "Extract audio"}
      </Button>
    </div>
  );

  return (
    <ToolPage
      title="Extract Audio"
      description="Pull the audio track out of a video. Drop multiple files to batch-extract."
      icon={<Music size={22} />}
      upload={upload}
      preview={preview}
      controls={controls}
      onClear={inputPaths.length > 0 ? clear : undefined}
    >
      {!isBatch && single.loading && (
        <ProgressBar
          percent={single.progress ?? -1}
          label="Extracting audio..."
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
