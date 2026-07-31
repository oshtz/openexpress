import { useState } from "react";
import { Minimize2 } from "lucide-react";
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

interface CompressResult {
  output_path: string;
  original_size: number;
  compressed_size: number;
  savings_percent: number;
}

const IMAGE_EXTS = ["jpg", "jpeg", "png", "webp", "bmp", "tiff"];

export function ImageCompress() {
  const [inputPaths, setInputPaths] = useState<string[]>([]);
  const [quality, setQuality] = useState(80);
  const single = useProcess<CompressResult>({ tool: "Compress" });
  const batch = useBatch<string, CompressResult>();
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
        suggested: addSuffix(inputPath, "compressed"),
        filters: [{ name: "Images", extensions: IMAGE_EXTS }],
      });
      if (!outputPath) return;
      await single.run("compress_image", { inputPath, outputPath, quality });
      return;
    }

    await batch.start(inputPaths, async (inputPath) => {
      const outputPath = resolveBatchOutputPath(inputPath, { suffix: "compressed" });
      try {
        return await invoke<CompressResult>("compress_image", {
          inputPath,
          outputPath,
          quality,
        });
      } catch (e) {
        throw toAppError(e);
      }
    });
  };

  const totalSavings = isBatch
    ? batch.results
        .filter((r) => r.result)
        .reduce(
          (acc, r) => ({
            original: acc.original + (r.result?.original_size ?? 0),
            compressed: acc.compressed + (r.result?.compressed_size ?? 0),
          }),
          { original: 0, compressed: 0 },
        )
    : null;

  const upload = (
    <FileDropzone
      accept={IMAGE_EXTS}
      multiple
      selectedPaths={inputPaths}
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
    <div className="surface-elevated p-5 space-y-4 animate-fade-in-up">
      <Slider
        label="Quality"
        displayValue={`${quality}%`}
        min={1}
        max={100}
        value={quality}
        onChange={(e) => setQuality(Number(e.target.value))}
        minLabel="Smaller file"
        maxLabel="Higher quality"
      />

      <Button
        fullWidth
        onClick={handleProcess}
        disabled={single.loading || batch.running || inputPaths.length === 0}
      >
        {single.loading
          ? "Compressing..."
          : batch.running
            ? `Compressing ${batch.completed + 1} of ${batch.total}...`
            : isBatch
              ? `Compress ${inputPaths.length} images`
              : "Compress image"}
      </Button>
    </div>
  );

  return (
    <ToolPage
      title="Compress Image"
      description="Reduce image file size with adjustable quality. Drop multiple files to batch-compress them."
      icon={<Minimize2 size={22} />}
      upload={upload}
      preview={preview}
      controls={controls}
      onClear={inputPaths.length > 0 ? clear : undefined}
    >
      {!isBatch && single.loading && (
        <ProgressBar percent={-1} label="Compressing image..." />
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
            cacheBuster={single.result.compressed_size}
          />
          <ResultPanel
            outputPath={single.result.output_path}
            stats={[
              { label: "Original", value: formatBytes(single.result.original_size) },
              { label: "Compressed", value: formatBytes(single.result.compressed_size) },
              { label: "Savings", value: `${single.result.savings_percent.toFixed(1)}%` },
            ]}
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

      {isBatch && !batch.running && totalSavings && totalSavings.original > 0 && (
        <div className="surface-elevated p-4 animate-fade-in-up">
          <div className="grid grid-cols-3 gap-4 text-[12px]">
            <Stat label="Total original" value={formatBytes(totalSavings.original)} />
            <Stat label="Total compressed" value={formatBytes(totalSavings.compressed)} />
            <Stat
              label="Total savings"
              value={`${(((totalSavings.original - totalSavings.compressed) / totalSavings.original) * 100).toFixed(1)}%`}
            />
          </div>
        </div>
      )}
    </ToolPage>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-text-muted uppercase font-medium text-[10px]">
        {label}
      </div>
      <div className="text-text font-semibold text-[14px] tabular-nums">{value}</div>
    </div>
  );
}
