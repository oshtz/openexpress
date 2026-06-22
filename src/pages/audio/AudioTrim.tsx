import { useState } from "react";
import { Scissors } from "lucide-react";
import { resolveOutputPath } from "../../lib/output";
import { ToolPage } from "../../components/common/ToolPage";
import { FileDropzone } from "../../components/common/FileDropzone";
import { ResultPanel } from "../../components/common/ResultPanel";
import { ErrorPanel } from "../../components/common/ErrorPanel";
import { ProgressBar } from "../../components/common/ProgressBar";
import { AudioPlayer } from "../../components/common/AudioPlayer";
import { Button, Slider } from "../../components/ui";
import { useProcess } from "../../hooks/useProcess";
import { usePrefilledFile } from "../../hooks/usePrefilledFile";
import { addSuffix, formatBytes } from "../../lib/utils";

interface AudioResult {
  output_path: string;
  file_size: number;
}

const AUDIO_EXTS = ["mp3", "wav", "m4a", "flac", "ogg", "aac", "opus"];

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const r = (s - m * 60).toFixed(2);
  return `${m}:${r.padStart(5, "0")}`;
}

export function AudioTrim() {
  const [inputPaths, setInputPaths] = useState<string[]>([]);
  const [duration, setDuration] = useState(0);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const single = useProcess<AudioResult>({
    tool: "Trim Audio",
    trackProgress: true,
    cancelCommand: "cancel_video_job",
  });

  const handleFiles = (paths: string[]) => {
    setInputPaths(paths);
    setDuration(0);
    setStart(0);
    setEnd(0);
    single.reset();
  };
  usePrefilledFile(handleFiles);

  const clear = () => {
    setInputPaths([]);
    setDuration(0);
    setStart(0);
    setEnd(0);
    single.reset();
  };

  const handleProcess = async () => {
    if (inputPaths.length === 0 || end <= start) return;
    const inputPath = inputPaths[0];
    const outputPath = await resolveOutputPath({
      suggested: addSuffix(inputPath, "trimmed"),
      filters: [{ name: "Audio", extensions: AUDIO_EXTS }],
    });
    if (!outputPath) return;
    await single.run("trim_audio", {
      inputPath,
      outputPath,
      startSecs: start,
      endSecs: end,
    });
  };

  const upload = (
    <FileDropzone
      accept={AUDIO_EXTS}
      onFiles={handleFiles}
      label="Drop an audio file here or click to browse"
    />
  );

  const preview =
    inputPaths.length === 0 ? null : (
      <AudioPlayer
        path={inputPaths[0]}
        onLoadedMetadata={(d) => {
          setDuration(d);
          setEnd(d);
        }}
      />
    );

  const controls = (
    <div className="surface-elevated p-5 space-y-5 animate-fade-in-up">
      <Slider
        label="Start"
        displayValue={formatTime(start)}
        min={0}
        max={duration || 1}
        step={0.01}
        value={start}
        onChange={(e) => setStart(Math.min(Number(e.target.value), end - 0.01))}
        disabled={duration === 0}
      />

      <Slider
        label="End"
        displayValue={formatTime(end)}
        min={0}
        max={duration || 1}
        step={0.01}
        value={end}
        onChange={(e) => setEnd(Math.max(Number(e.target.value), start + 0.01))}
        disabled={duration === 0}
      />

      {duration > 0 && (
        <div className="text-[12px] text-text-muted tabular-nums">
          Output duration: {formatTime(end - start)} (source: {formatTime(duration)})
        </div>
      )}

      <Button
        fullWidth
        onClick={handleProcess}
        disabled={single.loading || inputPaths.length === 0 || end <= start || duration === 0}
      >
        {single.loading ? "Trimming..." : "Trim audio"}
      </Button>
    </div>
  );

  return (
    <ToolPage
      title="Trim Audio"
      description="Cut a segment out of an audio file."
      icon={<Scissors size={22} />}
      upload={upload}
      preview={preview}
      controls={controls}
      onClear={inputPaths.length > 0 ? clear : undefined}
    >
      {single.loading && (
        <ProgressBar
          percent={single.progress ?? -1}
          label="Trimming audio..."
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
