import { useState } from "react";
import { Shapes } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { resolveBatchOutputPath, resolveOutputPath } from "../../lib/output";
import { ToolPage } from "../../components/common/ToolPage";
import { FileDropzone } from "../../components/common/FileDropzone";
import { ResultPanel } from "../../components/common/ResultPanel";
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

interface VectorTraceResult {
  output_path: string;
  file_size: number;
}

const IMAGE_EXTS = ["jpg", "jpeg", "png", "webp", "bmp", "tiff"];
type ColorMode = "color" | "binary";

export function ImageVectorTrace() {
  const [inputPaths, setInputPaths] = useState<string[]>([]);
  const [colorMode, setColorMode] = useState<ColorMode>("color");
  const [detail, setDetail] = useState(4);
  const single = useProcess<VectorTraceResult>({ tool: "Vector Trace" });
  const batch = useBatch<string, VectorTraceResult>();
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
        suggested: addSuffix(inputPath, "traced").replace(/\.[^.]+$/, ".svg"),
        filters: [{ name: "SVG", extensions: ["svg"] }],
      });
      if (!outputPath) return;
      await single.run("vector_trace_image", {
        inputPath,
        outputPath,
        colorMode,
        detail,
      });
      return;
    }

    await batch.start(inputPaths, async (inputPath) => {
      const outputPath = resolveBatchOutputPath(inputPath, {
        suffix: "traced",
        targetExtension: "svg",
      });
      try {
        return await invoke<VectorTraceResult>("vector_trace_image", {
          inputPath,
          outputPath,
          colorMode,
          detail,
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
      <div>
        <label className="text-[13px] font-medium text-text-secondary block mb-2">
          Color mode
        </label>
        <div className="grid grid-cols-2 gap-2">
          {(["color", "binary"] as ColorMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setColorMode(mode)}
              className={`py-2 text-[13px] font-medium transition-all ${
                colorMode === mode
                  ? "bg-primary text-primary-light"
                  : "bg-bg-tertiary text-text-secondary hover:text-text"
              }`}
            >
              {mode === "color" ? "Full color" : "Black & white"}
            </button>
          ))}
        </div>
      </div>

      <Slider
        label="Detail"
        displayValue={detail}
        min={1}
        max={10}
        value={detail}
        onChange={(e) => setDetail(Number(e.target.value))}
        minLabel="More detail"
        maxLabel="Cleaner shapes"
      />

      <Button
        fullWidth
        onClick={handleProcess}
        disabled={single.loading || batch.running || inputPaths.length === 0}
      >
        {single.loading
          ? "Tracing..."
          : batch.running
            ? `Tracing ${batch.completed + 1} of ${batch.total}...`
            : isBatch
              ? `Trace ${inputPaths.length} images`
              : "Trace to SVG"}
      </Button>
    </div>
  );

  return (
    <ToolPage
      title="Trace to SVG"
      description="Convert raster images into vector graphics. Drop multiple files to batch-trace."
      icon={<Shapes size={22} />}
      upload={upload}
      preview={preview}
      controls={controls}
      onClear={inputPaths.length > 0 ? clear : undefined}
    >
      {!isBatch && single.loading && (
        <ProgressBar percent={-1} label="Tracing image to SVG..." />
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
