import { useState } from "react";
import { TrendingUp } from "lucide-react";
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

export function AudioFadeIn() {
  const [inputPaths, setInputPaths] = useState<string[]>([]);
  const [duration, setDuration] = useState(2);
  const single = useProcess<AudioResult>({
    tool: "Fade In",
    trackProgress: true,
    cancelCommand: "cancel_video_job",
  });

  const handleFiles = (paths: string[]) => {
    setInputPaths(paths);
    single.reset();
  };
  usePrefilledFile(handleFiles);

  const clear = () => {
    setInputPaths([]);
    single.reset();
  };

  const handleProcess = async () => {
    if (inputPaths.length === 0) return;
    const inputPath = inputPaths[0];
    const outputPath = await resolveOutputPath({
      suggested: addSuffix(inputPath, "fade-in"),
      filters: [{ name: "Audio", extensions: AUDIO_EXTS }],
    });
    if (!outputPath) return;
    await single.run("fade_in_audio", { inputPath, outputPath, durationSecs: duration });
  };

  const upload = (
    <FileDropzone
      accept={AUDIO_EXTS}
      onFiles={handleFiles}
      label="Drop an audio file here or click to browse"
    />
  );

  const preview = inputPaths.length === 0 ? null : <AudioPlayer path={inputPaths[0]} />;

  const controls = (
    <div className="surface-elevated p-5 space-y-5 animate-fade-in-up">
      <Slider
        label="Fade duration"
        displayValue={`${duration.toFixed(1)}s`}
        min={0.1}
        max={30}
        step={0.1}
        value={duration}
        onChange={(e) => setDuration(Number(e.target.value))}
      />

      <Button fullWidth onClick={handleProcess} disabled={single.loading || inputPaths.length === 0}>
        {single.loading ? "Applying fade..." : "Apply fade in"}
      </Button>
    </div>
  );

  return (
    <ToolPage
      title="Fade In Audio"
      description="Apply a linear fade-in over the first N seconds."
      icon={<TrendingUp size={22} />}
      upload={upload}
      preview={preview}
      controls={controls}
      onClear={inputPaths.length > 0 ? clear : undefined}
    >
      {single.loading && (
        <ProgressBar
          percent={single.progress ?? -1}
          label="Applying fade in..."
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
