import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { FileDown } from "lucide-react";
import { ToolPage } from "../../components/common/ToolPage";
import { FileDropzone } from "../../components/common/FileDropzone";
import { ResultPanel } from "../../components/common/ResultPanel";
import { ErrorPanel } from "../../components/common/ErrorPanel";
import { ProgressBar } from "../../components/common/ProgressBar";
import { Button, Field } from "../../components/ui";
import { useProcess } from "../../hooks/useProcess";
import { usePrefilledFile } from "../../hooks/usePrefilledFile";
import { getFileName, getDirName } from "../../lib/utils";

interface PdfToImageResult {
  output_paths: string[];
  page_count: number;
}

export function PdfToImage() {
  const [inputPaths, setInputPaths] = useState<string[]>([]);
  const [format, setFormat] = useState<"png" | "jpg">("png");
  const { loading, error, result, run, reset } = useProcess<PdfToImageResult>({
    tool: "PDF to Image",
  });

  const handleFiles = (paths: string[]) => {
    if (paths.length > 0) {
      setInputPaths(paths);
      reset();
    }
  };
  usePrefilledFile(handleFiles);

  const clear = () => {
    setInputPaths([]);
    reset();
  };

  const inputPath = inputPaths[0] ?? "";

  const handleProcess = async () => {
    if (!inputPath) return;
    const outputDir = await open({ directory: true, title: "Select output folder" });
    if (!outputDir) return;
    await run("pdf_to_images", { inputPath, outputDir, format });
  };

  const upload = (
    <FileDropzone
      accept={["pdf"]}
      onFiles={handleFiles}
      label="Drop a PDF file here or click to browse"
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
      <Field label="Output format">
        <div className="flex gap-2">
          {(["png", "jpg"] as const).map((fmt) => (
            <button
              key={fmt}
              onClick={() => setFormat(fmt)}
              className={`px-4 py-2 text-[13px] font-medium border transition-all duration-200 ${
                format === fmt
                  ? "bg-primary text-primary-light border-primary"
                  : "bg-bg-secondary border-border text-text-secondary hover:border-primary/30 hover:text-text"
              }`}
            >
              {fmt.toUpperCase()}
            </button>
          ))}
        </div>
      </Field>

      <Button
        fullWidth
        onClick={handleProcess}
        disabled={!inputPath || loading || inputPaths.length === 0}
      >
        {loading ? "Extracting..." : "Extract images"}
      </Button>
    </div>
  );

  return (
    <ToolPage
      title="PDF to Images"
      description="Extract each page of a PDF as an image."
      icon={<FileDown size={22} />}
      upload={upload}
      preview={preview}
      controls={controls}
      onClear={inputPaths.length > 0 ? clear : undefined}
    >
      {loading && <ProgressBar percent={-1} label="Extracting images..." />}

      {error && <ErrorPanel error={error} />}

      {result && result.output_paths.length > 0 && (
        <ResultPanel
          outputPath={result.output_paths[0]}
          stats={[
            { label: "Pages extracted", value: String(result.page_count) },
            { label: "Format", value: format.toUpperCase() },
          ]}
          onOpenFolder={async () => {
            const { open } = await import("@tauri-apps/plugin-shell");
            const dir = getDirName(result.output_paths[0] ?? "");
            open(dir);
          }}
        />
      )}
    </ToolPage>
  );
}
