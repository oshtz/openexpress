import { useCallback, useState } from "react";
import { Scissors } from "lucide-react";
import { resolveOutputPath } from "../../lib/output";
import { ToolPage } from "../../components/common/ToolPage";
import { FileDropzone } from "../../components/common/FileDropzone";
import { ResultPanel } from "../../components/common/ResultPanel";
import { BeforeAfter } from "../../components/common/BeforeAfter";
import { ErrorPanel } from "../../components/common/ErrorPanel";
import { ProgressBar } from "../../components/common/ProgressBar";
import { ImagePreview } from "../../components/common/ImagePreview";
import {
  ModelDownloadCard,
  ModelInstalledPill,
} from "../../components/common/ModelDownloadCard";
import { Button } from "../../components/ui";
import { useProcess } from "../../hooks/useProcess";
import { usePrefilledFile } from "../../hooks/usePrefilledFile";
import { addSuffix, formatBytes } from "../../lib/utils";

interface RemoveBgResult {
  output_path: string;
  file_size: number;
}

const IMAGE_EXTS = ["jpg", "jpeg", "png", "webp", "bmp"];
const MODEL_ID = "u2netp";

export function ImageRemoveBg() {
  const [inputPaths, setInputPaths] = useState<string[]>([]);
  const [modelReady, setModelReady] = useState(false);
  const { loading, error, result, run, reset } = useProcess<RemoveBgResult>({ tool: "Remove BG" });

  const handleFiles = (paths: string[]) => {
    setInputPaths(paths);
    reset();
  };
  usePrefilledFile(handleFiles);

  const clear = () => {
    setInputPaths([]);
    reset();
  };

  const onModelInstalled = useCallback(() => setModelReady(true), []);

  const inputPath = inputPaths[0] ?? "";

  const handleProcess = async () => {
    if (!inputPath) return;
    const outputPath = await resolveOutputPath({
      suggested: addSuffix(inputPath, "nobg").replace(/\.[^.]+$/, ".png"),
      filters: [{ name: "PNG", extensions: ["png"] }],
    });
    if (!outputPath) return;
    await run("remove_background", { inputPath, outputPath });
  };

  const upload = (
    <FileDropzone
      accept={IMAGE_EXTS}
      onFiles={handleFiles}
      label="Drop an image here or click to browse"
    />
  );

  const preview = inputPath ? <ImagePreview path={inputPath} /> : null;

  const controls = (
    <div className="space-y-4 animate-fade-in-up">
      <ModelDownloadCard modelId={MODEL_ID} onInstalled={onModelInstalled} />

      <div className="surface-elevated p-5 space-y-3">
        <Button
          fullWidth
          onClick={handleProcess}
          disabled={loading || inputPaths.length === 0 || !modelReady}
        >
          {loading
            ? "Running inference..."
            : !modelReady
              ? "Model required"
              : "Remove background"}
        </Button>
        <ModelInstalledPill modelId={MODEL_ID} />
      </div>
    </div>
  );

  return (
    <ToolPage
      title="Remove Background"
      description="AI-powered foreground isolation. Runs locally - no cloud round-trip."
      icon={<Scissors size={22} />}
      upload={upload}
      preview={preview}
      controls={controls}
      onClear={inputPaths.length > 0 ? clear : undefined}
    >
      {loading && <ProgressBar percent={-1} label="Running inference..." />}

      {error && <ErrorPanel error={error} />}

      {result && (
        <>
          <BeforeAfter
            beforePath={inputPath}
            afterPath={result.output_path}
            cacheBuster={result.file_size}
          />
          <ResultPanel
            outputPath={result.output_path}
            stats={[{ label: "File size", value: formatBytes(result.file_size) }]}
          />
        </>
      )}
    </ToolPage>
  );
}
