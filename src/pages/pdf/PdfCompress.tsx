import { useState } from "react";
import { FileArchive } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { resolveBatchOutputPath, resolveOutputPath } from "../../lib/output";
import { ErrorPanel } from "../../components/common/ErrorPanel";
import { ToolPage } from "../../components/common/ToolPage";
import { FileDropzone } from "../../components/common/FileDropzone";
import { ResultPanel } from "../../components/common/ResultPanel";
import { ProgressBar } from "../../components/common/ProgressBar";
import { BatchProgress } from "../../components/common/BatchProgress";
import { BatchResultPanel } from "../../components/common/BatchResultPanel";
import { Button } from "../../components/ui";
import { useProcess } from "../../hooks/useProcess";
import { useBatch } from "../../hooks/useBatch";
import { usePrefilledFile } from "../../hooks/usePrefilledFile";
import { formatBytes, addSuffix, getDirName, getFileName } from "../../lib/utils";
import { toAppError } from "../../lib/errors";

interface CompressResult {
  output_path: string;
  original_size: number;
  compressed_size: number;
  savings_percent: number;
}

export function PdfCompress() {
  const [inputPaths, setInputPaths] = useState<string[]>([]);
  const single = useProcess<CompressResult>({ tool: "Compress PDF" });
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
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      });
      if (!outputPath) return;
      await single.run("compress_pdf", { inputPath, outputPath });
      return;
    }

    await batch.start(inputPaths, async (inputPath) => {
      const outputPath = resolveBatchOutputPath(inputPath, { suffix: "compressed" });
      try {
        return await invoke<CompressResult>("compress_pdf", { inputPath, outputPath });
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
      accept={["pdf"]}
      multiple
      selectedPaths={inputPaths}
      onFiles={handleFiles}
      label="Drop one or more PDFs here or click to browse"
    />
  );

  const preview =
    inputPaths.length === 0 ? null : !isBatch ? (
      <div className="surface-elevated p-5 h-full flex flex-col items-center justify-center text-center">
        <div className="text-[13px] font-semibold text-text mb-1 break-all">
          {getFileName(inputPaths[0])}
        </div>
        <div className="text-[11px] text-text-muted">PDF selected</div>
      </div>
    ) : (
      <div className="surface-elevated p-5 h-full flex flex-col items-center justify-center text-center">
        <div className="text-[13px] font-semibold text-text mb-1">
          {inputPaths.length} PDFs selected
        </div>
        <div className="text-[11px] text-text-muted">Batch mode</div>
      </div>
    );

  const controls = (
    <div className="surface-elevated p-5 animate-fade-in-up">
      <Button
        fullWidth
        onClick={handleProcess}
        disabled={inputPaths.length === 0 || single.loading || batch.running}
      >
        {single.loading
          ? "Compressing..."
          : batch.running
            ? `Compressing ${batch.completed + 1} of ${batch.total}...`
            : isBatch
              ? `Compress ${inputPaths.length} PDFs`
              : "Compress PDF"}
      </Button>
    </div>
  );

  return (
    <ToolPage
      title="Compress PDF"
      description="Reduce PDF file size while preserving quality. Drop multiple files to batch-compress."
      icon={<FileArchive size={22} />}
      upload={upload}
      preview={preview}
      controls={controls}
      onClear={inputPaths.length > 0 ? clear : undefined}
    >
      {!isBatch && single.loading && <ProgressBar percent={-1} label="Compressing PDF..." />}
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
          stats={[
            { label: "Original", value: formatBytes(single.result.original_size) },
            { label: "Compressed", value: formatBytes(single.result.compressed_size) },
            { label: "Savings", value: `${single.result.savings_percent.toFixed(1)}%` },
          ]}
          onOpenFolder={async () => {
            const { open } = await import("@tauri-apps/plugin-shell");
            open(getDirName(single.result!.output_path));
          }}
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
      <div className="text-text-muted uppercase tracking-wide font-medium text-[10px]">
        {label}
      </div>
      <div className="text-text font-semibold text-[14px] tabular-nums">{value}</div>
    </div>
  );
}
