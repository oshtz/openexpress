import { useState } from "react";
import { resolveOutputPath } from "../../lib/output";
import { ErrorPanel } from "../../components/common/ErrorPanel";
import { Merge, X, ArrowUp, ArrowDown } from "lucide-react";
import { ToolPage } from "../../components/common/ToolPage";
import { FileDropzone } from "../../components/common/FileDropzone";
import { ResultPanel } from "../../components/common/ResultPanel";
import { ProgressBar } from "../../components/common/ProgressBar";
import { Button } from "../../components/ui";
import { useProcess } from "../../hooks/useProcess";
import { usePrefilledFile } from "../../hooks/usePrefilledFile";
import { formatBytes, getDirName, getFileName } from "../../lib/utils";

interface MergeResult {
  output_path: string;
  page_count: number;
  file_size: number;
}

export function PdfMerge() {
  const [inputPaths, setInputPaths] = useState<string[]>([]);
  const { loading, error, result, run, reset } = useProcess<MergeResult>({ tool: "Merge PDF" });

  const handleFiles = (paths: string[]) => {
    setInputPaths((prev) => [...prev, ...paths]);
    reset();
  };
  usePrefilledFile(handleFiles);

  const clear = () => {
    setInputPaths([]);
    reset();
  };

  const removeFile = (index: number) => {
    setInputPaths((prev) => prev.filter((_, i) => i !== index));
  };

  const moveFile = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= inputPaths.length) return;
    setInputPaths((prev) => {
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const handleProcess = async () => {
    const outputPath = await resolveOutputPath({
      suggested: "merged.pdf",
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    });
    if (!outputPath) return;
    await run("merge_pdfs", { inputPaths, outputPath });
  };

  const upload = (
    <FileDropzone
      multiple
      accept={["pdf"]}
      onFiles={handleFiles}
      label="Drop PDF files here or click to browse"
    />
  );

  const preview = inputPaths.length > 0 ? (
    <div className="surface-elevated p-5 animate-fade-in-up">
      <h3 className="text-[13px] font-semibold text-text mb-3">
        Files to merge
        <span className="ml-1.5 text-text-muted font-normal">({inputPaths.length})</span>
      </h3>
      <div className="bg-bg-secondary p-1.5 space-y-1">
        {inputPaths.map((path, i) => (
          <div
            key={`${path}-${i}`}
            className="flex items-center gap-2 px-3 py-2 hover:bg-surface-hover transition-colors duration-150 group"
          >
            <span className="text-[12px] text-text-muted tabular-nums min-w-[1.5rem] text-center font-medium">
              {i + 1}
            </span>
            <span className="text-[13px] text-text flex-1 truncate">{getFileName(path)}</span>
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150">
              <button
                onClick={() => moveFile(i, -1)}
                disabled={i === 0}
                className="p-1 text-text-muted hover:text-text hover:bg-bg-secondary disabled:opacity-30 transition-colors duration-150"
              >
                <ArrowUp size={13} />
              </button>
              <button
                onClick={() => moveFile(i, 1)}
                disabled={i === inputPaths.length - 1}
                className="p-1 text-text-muted hover:text-text hover:bg-bg-secondary disabled:opacity-30 transition-colors duration-150"
              >
                <ArrowDown size={13} />
              </button>
              <button
                onClick={() => removeFile(i)}
                className="p-1 text-text-muted hover:text-danger hover:bg-danger-light transition-colors duration-150"
              >
                <X size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  ) : null;

  const controls = (
    <div className="surface-elevated p-5 animate-fade-in-up">
      <Button fullWidth onClick={handleProcess} disabled={inputPaths.length < 2 || loading}>
        {loading ? "Merging..." : "Merge PDFs"}
      </Button>
      {inputPaths.length === 1 && (
        <p className="text-[11px] text-text-muted mt-2">Add at least one more PDF to merge.</p>
      )}
    </div>
  );

  return (
    <ToolPage
      title="Merge PDFs"
      description="Combine multiple PDF files into a single document."
      icon={<Merge size={22} />}
      upload={upload}
      preview={preview}
      controls={controls}
      onClear={inputPaths.length > 0 ? clear : undefined}
    >
      {loading && <ProgressBar percent={-1} label="Merging PDFs..." />}

      {error && <ErrorPanel error={error} />}

      {result && (
        <ResultPanel
          outputPath={result.output_path}
          stats={[
            { label: "Pages", value: String(result.page_count) },
            { label: "File size", value: formatBytes(result.file_size) },
          ]}
          onOpenFolder={async () => {
            const { open } = await import("@tauri-apps/plugin-shell");
            open(getDirName(result.output_path));
          }}
        />
      )}
    </ToolPage>
  );
}
