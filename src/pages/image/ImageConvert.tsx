import { useState } from "react";
import { RefreshCw } from "lucide-react";
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
import { Button } from "../../components/ui";
import { useProcess } from "../../hooks/useProcess";
import { useBatch } from "../../hooks/useBatch";
import { usePrefilledFile } from "../../hooks/usePrefilledFile";
import { replaceExtension, formatBytes, getFileExtension } from "../../lib/utils";
import { toAppError } from "../../lib/errors";

interface ConvertResult {
  output_path: string;
  format: string;
  file_size: number;
}

const TARGET_FORMATS = ["jpg", "png", "webp", "bmp", "tiff", "ico"];
const ACCEPTED = ["jpg", "jpeg", "png", "webp", "bmp", "tiff", "ico"];

export function ImageConvert() {
  const [inputPaths, setInputPaths] = useState<string[]>([]);
  const [targetFormat, setTargetFormat] = useState("png");
  const single = useProcess<ConvertResult>({ tool: "Convert" });
  const batch = useBatch<string, ConvertResult>();
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
        suggested: replaceExtension(inputPath, targetFormat),
        filters: [{ name: "Images", extensions: [targetFormat] }],
      });
      if (!outputPath) return;
      await single.run("convert_image", { inputPath, outputPath });
      return;
    }

    await batch.start(inputPaths, async (inputPath) => {
      const outputPath = resolveBatchOutputPath(inputPath, {
        suffix: "converted",
        targetExtension: targetFormat,
      });
      try {
        return await invoke<ConvertResult>("convert_image", { inputPath, outputPath });
      } catch (e) {
        throw toAppError(e);
      }
    });
  };

  const sourceExt = !isBatch && inputPaths[0] ? getFileExtension(inputPaths[0]).toUpperCase() : "";

  const upload = (
    <FileDropzone
      accept={ACCEPTED}
      multiple
      selectedPaths={inputPaths}
      onFiles={handleFiles}
      label="Drop one or more images here or click to browse"
    />
  );

  const preview =
    inputPaths.length === 0 ? null : !isBatch ? (
      <div className="relative">
        <ImagePreview path={inputPaths[0]} />
        {sourceExt && (
          <div className="absolute bottom-3 left-3 flex items-center gap-2 text-[11px] tabular-nums">
            <span className="px-2 py-0.5 bg-black/70 text-white font-medium">
              {sourceExt}
            </span>
            <span className="text-white/80">-&gt;</span>
            <span className="px-2 py-0.5 bg-primary/90 text-primary-light font-medium">
              {targetFormat.toUpperCase()}
            </span>
          </div>
        )}
      </div>
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
      <div>
        <label className="block text-[13px] font-medium text-text-secondary mb-1.5">
          Target format
        </label>
        <div className="flex flex-wrap gap-2">
          {TARGET_FORMATS.map((fmt) => (
            <button
              key={fmt}
              onClick={() => setTargetFormat(fmt)}
              className={`px-3.5 py-2 text-[13px] font-medium border transition-all duration-200 ${
                targetFormat === fmt
                  ? "bg-primary text-primary-light border-primary"
                  : "bg-bg-secondary border-border text-text-secondary hover:border-primary/30 hover:text-text"
              }`}
            >
              {fmt.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <Button
        fullWidth
        onClick={handleProcess}
        disabled={single.loading || batch.running || inputPaths.length === 0}
      >
        {single.loading
          ? "Converting..."
          : batch.running
            ? `Converting ${batch.completed + 1} of ${batch.total}...`
            : isBatch
              ? `Convert ${inputPaths.length} images`
              : "Convert image"}
      </Button>
    </div>
  );

  return (
    <ToolPage
      title="Convert Image Format"
      description="Convert images between popular formats. Drop multiple files to batch-convert them."
      icon={<RefreshCw size={22} />}
      upload={upload}
      preview={preview}
      controls={controls}
      onClear={inputPaths.length > 0 ? clear : undefined}
    >
      {!isBatch && single.loading && (
        <ProgressBar percent={-1} label="Converting image..." />
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
            stats={[
              { label: "Format", value: single.result.format.toUpperCase() },
              { label: "File size", value: formatBytes(single.result.file_size) },
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
    </ToolPage>
  );
}
