import { useState } from "react";
import { Sparkles } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { resolveBatchOutputPath, resolveOutputPath } from "../../lib/output";
import { ToolPage } from "../../components/common/ToolPage";
import { FileDropzone } from "../../components/common/FileDropzone";
import { ResultPanel } from "../../components/common/ResultPanel";
import { BeforeAfter } from "../../components/common/BeforeAfter";
import { ErrorPanel } from "../../components/common/ErrorPanel";
import { ProgressBar } from "../../components/common/ProgressBar";
import { BatchProgress } from "../../components/common/BatchProgress";
import { BatchResultPanel } from "../../components/common/BatchResultPanel";
import { ImagePreview } from "../../components/common/ImagePreview";
import { Button, Slider } from "../../components/ui";
import { useProcess } from "../../hooks/useProcess";
import { useBatch } from "../../hooks/useBatch";
import { usePrefilledFile } from "../../hooks/usePrefilledFile";
import { addSuffix, formatBytes } from "../../lib/utils";
import { toAppError } from "../../lib/errors";

interface SharpenResult {
  output_path: string;
  file_size: number;
}

const IMAGE_EXTS = ["jpg", "jpeg", "png", "webp", "bmp", "tiff"];

export function ImageSharpen() {
  const [inputPaths, setInputPaths] = useState<string[]>([]);
  const [sigma, setSigma] = useState(1.5);
  const [threshold, setThreshold] = useState(0);
  const single = useProcess<SharpenResult>({ tool: "Sharpen" });
  const batch = useBatch<string, SharpenResult>();
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
        suggested: addSuffix(inputPath, "sharpened"),
        filters: [{ name: "Images", extensions: IMAGE_EXTS }],
      });
      if (!outputPath) return;
      await single.run("sharpen_image", { inputPath, outputPath, sigma, threshold });
      return;
    }

    await batch.start(inputPaths, async (inputPath) => {
      const outputPath = resolveBatchOutputPath(inputPath, { suffix: "sharpened" });
      try {
        return await invoke<SharpenResult>("sharpen_image", {
          inputPath,
          outputPath,
          sigma,
          threshold,
        });
      } catch (e) {
        throw toAppError(e);
      }
    });
  };

  const upload = (
    <FileDropzone
      accept={IMAGE_EXTS}
      multiple
      onFiles={handleFiles}
      label="Drop one or more images here or click to browse"
    />
  );

  const preview =
    inputPaths.length === 0 ? null : !isBatch ? (
      <ImagePreview path={inputPaths[0]} />
    ) : (
      <div className="surface-elevated p-5 h-full flex flex-col items-center justify-center text-center">
        <div className="text-[13px] font-semibold text-text mb-1">
          {inputPaths.length} images selected
        </div>
        <div className="text-[11px] text-text-muted">Batch mode</div>
      </div>
    );

  const controls = (
    <div className="surface-elevated p-5 space-y-5 animate-fade-in-up">
      <Slider
        label="Amount"
        displayValue={sigma.toFixed(1)}
        min={0.5}
        max={5}
        step={0.1}
        value={sigma}
        onChange={(e) => setSigma(Number(e.target.value))}
        minLabel="Subtle"
        maxLabel="Strong"
      />

      <Slider
        label="Threshold"
        displayValue={threshold}
        min={0}
        max={50}
        value={threshold}
        onChange={(e) => setThreshold(Number(e.target.value))}
        minLabel="Sharpen all"
        maxLabel="Skip smooth areas"
      />

      <Button
        fullWidth
        onClick={handleProcess}
        disabled={single.loading || batch.running || inputPaths.length === 0}
      >
        {single.loading
          ? "Sharpening..."
          : batch.running
            ? `Sharpening ${batch.completed + 1} of ${batch.total}...`
            : isBatch
              ? `Sharpen ${inputPaths.length} images`
              : "Sharpen image"}
      </Button>
    </div>
  );

  return (
    <ToolPage
      title="Sharpen Image"
      description="Enhance edge clarity with an unsharp mask. Drop multiple files to batch-sharpen."
      icon={<Sparkles size={22} />}
      upload={upload}
      preview={preview}
      controls={controls}
      onClear={inputPaths.length > 0 ? clear : undefined}
    >
      {!isBatch && single.loading && (
        <ProgressBar percent={-1} label="Sharpening image..." />
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
        <>
          <BeforeAfter
            beforePath={inputPaths[0]}
            afterPath={single.result.output_path}
            cacheBuster={single.result.file_size}
          />
          <ResultPanel
            outputPath={single.result.output_path}
            stats={[{ label: "File size", value: formatBytes(single.result.file_size) }]}
          />
        </>
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
