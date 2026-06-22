import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { resolveOutputPath } from "../../lib/output";
import { ToolPage } from "../../components/common/ToolPage";
import { FileDropzone } from "../../components/common/FileDropzone";
import { ResultPanel } from "../../components/common/ResultPanel";
import { ErrorPanel } from "../../components/common/ErrorPanel";
import { ProgressBar } from "../../components/common/ProgressBar";
import { AudioPlayer } from "../../components/common/AudioPlayer";
import { Button, Field } from "../../components/ui";
import { useProcess } from "../../hooks/useProcess";
import { usePrefilledFile } from "../../hooks/usePrefilledFile";
import { replaceExtension, formatBytes } from "../../lib/utils";

interface AudioResult {
  output_path: string;
  file_size: number;
}

const AUDIO_EXTS = ["mp3", "wav", "m4a", "flac", "ogg", "aac", "opus"];
const FORMATS = ["mp3", "wav", "m4a", "flac", "ogg"] as const;

export function AudioConvert() {
  const [inputPaths, setInputPaths] = useState<string[]>([]);
  const [format, setFormat] = useState<string>("mp3");
  const single = useProcess<AudioResult>({
    tool: "Convert Audio",
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
      suggested: replaceExtension(inputPath, format),
      filters: [{ name: "Audio", extensions: [format] }],
    });
    if (!outputPath) return;
    await single.run("convert_audio", { inputPath, outputPath });
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
    <div className="surface-elevated p-5 space-y-4 animate-fade-in-up">
      <Field label="Format">
        <div className="flex gap-2 flex-wrap">
          {FORMATS.map((f) => (
            <button
              key={f}
              onClick={() => setFormat(f)}
              className={`px-3.5 py-2 text-[13px] font-medium border transition-all duration-200 ${
                format === f
                  ? "bg-primary text-primary-light border-primary"
                  : "bg-bg-secondary border-border text-text-secondary hover:border-primary/30 hover:text-text"
              }`}
            >
              {f.toUpperCase()}
            </button>
          ))}
        </div>
      </Field>

      <Button fullWidth onClick={handleProcess} disabled={single.loading || inputPaths.length === 0}>
        {single.loading ? "Converting..." : `Convert to ${format.toUpperCase()}`}
      </Button>
    </div>
  );

  return (
    <ToolPage
      title="Convert Audio"
      description="Transcode between MP3, WAV, M4A, FLAC, and OGG."
      icon={<RefreshCw size={22} />}
      upload={upload}
      preview={preview}
      controls={controls}
      onClear={inputPaths.length > 0 ? clear : undefined}
    >
      {single.loading && (
        <ProgressBar
          percent={single.progress ?? -1}
          label="Converting audio..."
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
