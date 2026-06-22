import { useState, useCallback } from "react";
import { Scissors } from "lucide-react";
import { resolveOutputPath } from "../../lib/output";
import { ErrorPanel } from "../../components/common/ErrorPanel";
import { ToolPage } from "../../components/common/ToolPage";
import { FileDropzone } from "../../components/common/FileDropzone";
import { ResultPanel } from "../../components/common/ResultPanel";
import { ProgressBar } from "../../components/common/ProgressBar";
import { VideoPlayer } from "../../components/common/VideoPlayer";
import { TrimTimeline } from "../../components/common/TrimTimeline";
import { Button } from "../../components/ui";
import { useProcess } from "../../hooks/useProcess";
import { usePrefilledFile } from "../../hooks/usePrefilledFile";
import { addSuffix, formatBytes } from "../../lib/utils";

interface TrimResult {
  output_path: string;
  file_size: number;
}

const VIDEO_EXTENSIONS = ["mp4", "webm", "avi", "mov", "mkv"];

export function VideoTrim() {
  const [inputPaths, setInputPaths] = useState<string[]>([]);
  const [duration, setDuration] = useState(0);
  const [startSecs, setStartSecs] = useState(0);
  const [endSecs, setEndSecs] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const { loading, error, result, progress, run, reset, cancel } = useProcess<TrimResult>({
    tool: "Trim",
    trackProgress: true,
    cancelCommand: "cancel_video_job",
  });

  const handleFiles = (paths: string[]) => {
    setInputPaths(paths);
    setStartSecs(0);
    setEndSecs(0);
    setDuration(0);
    reset();
  };
  usePrefilledFile(handleFiles);

  const clear = () => {
    setInputPaths([]);
    setStartSecs(0);
    setEndSecs(0);
    setDuration(0);
    setCurrentTime(0);
    reset();
  };

  const handleDurationChange = useCallback((d: number) => {
    setDuration(d);
    setEndSecs(d);
  }, []);

  const handleTimelineChange = useCallback((s: number, e: number) => {
    setStartSecs(s);
    setEndSecs(e);
  }, []);

  const inputPath = inputPaths[0] ?? "";

  const handleProcess = async () => {
    if (!inputPath) return;
    const outputPath = await resolveOutputPath({
      suggested: addSuffix(inputPath, "trimmed"),
      filters: [{ name: "Video", extensions: VIDEO_EXTENSIONS }],
    });
    if (!outputPath) return;
    await run("trim_video", { inputPath, outputPath, startSecs, endSecs });
  };

  const upload = (
    <FileDropzone
      accept={VIDEO_EXTENSIONS}
      onFiles={handleFiles}
      label="Drop a video file here or click to browse"
    />
  );

  const preview = inputPath ? (
    <div className="space-y-4">
      <VideoPlayer
        path={inputPath}
        startTime={startSecs}
        endTime={endSecs}
        onDurationChange={handleDurationChange}
        onTimeUpdate={setCurrentTime}
      />
      {duration > 0 && (
        <TrimTimeline
          duration={duration}
          start={startSecs}
          end={endSecs}
          currentTime={currentTime}
          onChange={handleTimelineChange}
          onSeek={setCurrentTime}
        />
      )}
    </div>
  ) : null;

  const controls = (
    <div className="surface-elevated p-5 space-y-4 animate-fade-in-up">
      <div className="text-[12px] text-text-secondary space-y-1 tabular-nums">
        <div>Start: <span className="text-text font-semibold">{startSecs.toFixed(2)}s</span></div>
        <div>End: <span className="text-text font-semibold">{endSecs.toFixed(2)}s</span></div>
        <div>Duration: <span className="text-text font-semibold">{Math.max(0, endSecs - startSecs).toFixed(2)}s</span></div>
      </div>

      <Button
        fullWidth
        onClick={handleProcess}
        disabled={loading || endSecs <= startSecs || inputPaths.length === 0}
      >
        {loading ? "Trimming..." : "Trim video"}
      </Button>
    </div>
  );

  return (
    <ToolPage
      title="Trim Video"
      description="Cut a segment from your video by dragging the timeline handles."
      icon={<Scissors size={22} />}
      upload={upload}
      preview={preview}
      controls={controls}
      onClear={inputPaths.length > 0 ? clear : undefined}
    >
      {loading && <ProgressBar percent={progress ?? -1} label="Trimming video..." onCancel={cancel} />}

      {error && <ErrorPanel error={error} />}

      {result && (
        <ResultPanel
          outputPath={result.output_path}
          stats={[{ label: "File size", value: formatBytes(result.file_size) }]}
        />
      )}
    </ToolPage>
  );
}
