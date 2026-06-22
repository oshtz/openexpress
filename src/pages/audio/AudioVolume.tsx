import { useState } from "react";
import { Volume2 } from "lucide-react";
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

export function AudioVolume() {
  const [inputPaths, setInputPaths] = useState<string[]>([]);
  const [gain, setGain] = useState(1);
  const single = useProcess<AudioResult>({
    tool: "Adjust Volume",
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
      suggested: addSuffix(inputPath, "volume"),
      filters: [{ name: "Audio", extensions: AUDIO_EXTS }],
    });
    if (!outputPath) return;
    await single.run("adjust_audio_volume", { inputPath, outputPath, gain });
  };

  const upload = (
    <FileDropzone
      accept={AUDIO_EXTS}
      onFiles={handleFiles}
      label="Drop an audio file here or click to browse"
    />
  );

  const preview = inputPaths.length === 0 ? null : <AudioPlayer path={inputPaths[0]} />;

  // Linear gain → approximate dB for display (20 * log10(gain))
  const db = gain > 0 ? 20 * Math.log10(gain) : -Infinity;

  const controls = (
    <div className="surface-elevated p-5 space-y-5 animate-fade-in-up">
      <div>
        <Slider
          label="Gain"
          displayValue={`${gain.toFixed(2)}x (${Number.isFinite(db) ? `${db >= 0 ? "+" : ""}${db.toFixed(1)} dB` : "muted"})`}
          min={0}
          max={4}
          step={0.05}
          value={gain}
          onChange={(e) => setGain(Number(e.target.value))}
        />
        <div className="flex justify-between text-[11px] text-text-muted mt-1.5">
          <span>Mute</span>
          <span>1.0x</span>
          <span>4.0x</span>
        </div>
      </div>

      <Button fullWidth onClick={handleProcess} disabled={single.loading || inputPaths.length === 0}>
        {single.loading ? "Adjusting..." : "Adjust volume"}
      </Button>
    </div>
  );

  return (
    <ToolPage
      title="Adjust Volume"
      description="Multiply audio loudness by a gain factor (0 = mute, 1 = unchanged, >1 = amplify)."
      icon={<Volume2 size={22} />}
      upload={upload}
      preview={preview}
      controls={controls}
      onClear={inputPaths.length > 0 ? clear : undefined}
    >
      {single.loading && (
        <ProgressBar
          percent={single.progress ?? -1}
          label="Adjusting volume..."
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
