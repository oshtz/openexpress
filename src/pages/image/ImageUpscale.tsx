import { useCallback, useState } from "react";
import { Wand2 } from "lucide-react";
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

interface UpscaleResult {
  output_path: string;
  width: number;
  height: number;
  file_size: number;
  original_width: number;
  original_height: number;
  model_input_width: number;
  model_input_height: number;
  auto_fit: boolean;
}

const IMAGE_EXTS = ["jpg", "jpeg", "png", "webp", "bmp"];
const MODEL_ID = "realesrgan_x4plus";
const MAX_NON_TILED_DIMENSION = 1024;

function fitToMaxAxis(width: number, height: number, maxAxis: number) {
  if (width <= 0 || height <= 0 || maxAxis <= 0) {
    return { width, height, autoFit: false };
  }
  const largest = Math.max(width, height);
  if (largest <= maxAxis) {
    return { width, height, autoFit: false };
  }
  const ratio = maxAxis / largest;
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
    autoFit: true,
  };
}

export function ImageUpscale() {
  const [inputPaths, setInputPaths] = useState<string[]>([]);
  const [inputDims, setInputDims] = useState<{ width: number; height: number } | null>(null);
  const [modelReady, setModelReady] = useState(false);
  const { loading, error, result, run, reset } = useProcess<UpscaleResult>({
    tool: "AI Upscale",
  });

  const handleFiles = (paths: string[]) => {
    setInputPaths(paths);
    setInputDims(null);
    reset();
  };
  usePrefilledFile(handleFiles);

  const clear = () => {
    setInputPaths([]);
    setInputDims(null);
    reset();
  };

  const onModelInstalled = useCallback(() => setModelReady(true), []);

  const inputPath = inputPaths[0] ?? "";
  const fittedDims = inputDims
    ? fitToMaxAxis(inputDims.width, inputDims.height, MAX_NON_TILED_DIMENSION)
    : null;
  const autoFitMessage =
    inputDims && fittedDims?.autoFit
      ? `Input is ${inputDims.width} x ${inputDims.height}. It will be fitted to ${fittedDims.width} x ${fittedDims.height} before 4x upscale.`
      : null;

  const handleProcess = async () => {
    if (!inputPath) return;
    const outputPath = await resolveOutputPath({
      suggested: addSuffix(inputPath, "upscaled-4x"),
      filters: [{ name: "Images", extensions: IMAGE_EXTS }],
    });
    if (!outputPath) return;
    await run("upscale_image", { inputPath, outputPath, scale: 4 });
  };

  const upload = (
    <FileDropzone
      accept={IMAGE_EXTS}
      onFiles={handleFiles}
      label="Drop an image here or click to browse"
    />
  );

  const preview = inputPath ? (
    <ImagePreview path={inputPath} onLoad={setInputDims} />
  ) : null;

  const controls = (
    <div className="space-y-4 animate-fade-in-up">
      <ModelDownloadCard modelId={MODEL_ID} onInstalled={onModelInstalled} />

      <div className="surface-elevated p-5 space-y-3">
        <p className="text-[11px] text-text-muted">
          Real-ESRGAN x4plus performs a 4x super-resolution pass with built-in denoising.
          Inputs larger than 1024 on either axis are fitted down before inference,
          then processed locally in fixed-size model tiles.
        </p>
        {autoFitMessage && (
          <p className="text-[12px] text-warning leading-relaxed">
            {autoFitMessage}
          </p>
        )}

        <Button
          fullWidth
          onClick={handleProcess}
          disabled={loading || inputPaths.length === 0 || !modelReady}
        >
          {loading
            ? "Running inference..."
            : !modelReady
              ? "Model required"
              : "Upscale 4x"}
        </Button>
        <ModelInstalledPill modelId={MODEL_ID} />
      </div>
    </div>
  );

  return (
    <ToolPage
      title="AI Upscale"
      description="Super-resolution via Real-ESRGAN. Denoises and sharpens while enlarging. Runs locally - no cloud round-trip."
      icon={<Wand2 size={22} />}
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
            stats={[
              { label: "Output size", value: `${result.width} x ${result.height}` },
              ...(result.auto_fit
                ? [
                    {
                      label: "Model input",
                      value: `${result.model_input_width} x ${result.model_input_height} (auto-fit)`,
                    },
                  ]
                : []),
              { label: "File size", value: formatBytes(result.file_size) },
            ]}
          />
        </>
      )}
    </ToolPage>
  );
}
