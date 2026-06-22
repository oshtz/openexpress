import { useState } from "react";
import { Scissors } from "lucide-react";
import { resolveOutputPath } from "../../lib/output";
import { ToolPage } from "../../components/common/ToolPage";
import { FileDropzone } from "../../components/common/FileDropzone";
import { ResultPanel } from "../../components/common/ResultPanel";
import { ErrorPanel } from "../../components/common/ErrorPanel";
import { ProgressBar } from "../../components/common/ProgressBar";
import { Button, Field, Input } from "../../components/ui";
import { useProcess } from "../../hooks/useProcess";
import { usePrefilledFile } from "../../hooks/usePrefilledFile";
import { addSuffix, formatBytes, getFileName } from "../../lib/utils";

interface SplitResult {
  output_path: string;
  page_count: number;
  file_size: number;
}

export function PdfSplit() {
  const [inputPaths, setInputPaths] = useState<string[]>([]);
  const [startPage, setStartPage] = useState(1);
  const [endPage, setEndPage] = useState(1);
  const single = useProcess<SplitResult>({ tool: "Split PDF" });

  const handleFiles = (paths: string[]) => {
    setInputPaths(paths);
    setStartPage(1);
    setEndPage(1);
    single.reset();
  };
  usePrefilledFile(handleFiles);

  const clear = () => {
    setInputPaths([]);
    setStartPage(1);
    setEndPage(1);
    single.reset();
  };

  const inputPath = inputPaths[0] ?? "";

  const handleProcess = async () => {
    if (inputPaths.length === 0) return;
    if (endPage < startPage) return;
    const outputPath = await resolveOutputPath({
      suggested: addSuffix(inputPath, `pages-${startPage}-${endPage}`),
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    });
    if (!outputPath) return;
    await single.run("split_pdf", {
      inputPath,
      outputPath,
      startPage,
      endPage,
    });
  };

  const upload = (
    <FileDropzone
      accept={["pdf"]}
      onFiles={handleFiles}
      label="Drop a PDF here or click to browse"
    />
  );

  const preview = inputPath ? (
    <div className="surface-elevated p-5 h-full flex flex-col items-center justify-center text-center">
      <div className="text-[13px] font-semibold text-text mb-1 break-all">
        {getFileName(inputPath)}
      </div>
      <div className="text-[11px] text-text-muted">PDF selected</div>
    </div>
  ) : null;

  const controls = (
    <div className="surface-elevated p-5 space-y-4 animate-fade-in-up">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Start page">
          <Input
            type="number"
            min={1}
            value={startPage}
            onChange={(e) => setStartPage(Math.max(1, Number(e.target.value) || 1))}
          />
        </Field>
        <Field label="End page">
          <Input
            type="number"
            min={1}
            value={endPage}
            onChange={(e) => setEndPage(Math.max(1, Number(e.target.value) || 1))}
          />
        </Field>
      </div>

      <Button
        fullWidth
        onClick={handleProcess}
        disabled={single.loading || endPage < startPage || inputPaths.length === 0}
      >
        {single.loading
          ? "Splitting..."
          : `Extract pages ${startPage}-${endPage}`}
      </Button>
    </div>
  );

  return (
    <ToolPage
      title="Split PDF"
      description="Extract a contiguous range of pages into a new PDF."
      icon={<Scissors size={22} />}
      upload={upload}
      preview={preview}
      controls={controls}
      onClear={inputPaths.length > 0 ? clear : undefined}
    >
      {single.loading && <ProgressBar percent={-1} label="Splitting PDF..." />}

      {single.error && <ErrorPanel error={single.error} />}

      {single.result && (
        <ResultPanel
          outputPath={single.result.output_path}
          stats={[
            { label: "Pages", value: String(single.result.page_count) },
            { label: "File size", value: formatBytes(single.result.file_size) },
          ]}
        />
      )}
    </ToolPage>
  );
}
