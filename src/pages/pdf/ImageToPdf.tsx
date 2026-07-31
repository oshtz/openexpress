import { useState } from "react";
import { resolveOutputPath } from "../../lib/output";
import { ErrorPanel } from "../../components/common/ErrorPanel";
import { FileImage, X } from "lucide-react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { ToolPage } from "../../components/common/ToolPage";
import { FileDropzone } from "../../components/common/FileDropzone";
import { ResultPanel } from "../../components/common/ResultPanel";
import { ProgressBar } from "../../components/common/ProgressBar";
import { Button } from "../../components/ui";
import { useProcess } from "../../hooks/useProcess";
import { usePrefilledFile } from "../../hooks/usePrefilledFile";
import { getDirName, getFileName } from "../../lib/utils";

interface ImageToPdfResult {
  output_paths: string[];
  page_count: number;
}

const IMAGE_EXTS = ["jpg", "jpeg", "png", "webp", "bmp"];

export function ImageToPdf() {
  const [inputPaths, setInputPaths] = useState<string[]>([]);
  const { loading, error, result, run, reset } = useProcess<ImageToPdfResult>({
    tool: "Image to PDF",
  });

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

  const handleProcess = async () => {
    const outputPath = await resolveOutputPath({
      suggested: "output.pdf",
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    });
    if (!outputPath) return;
    await run("images_to_pdf", { inputPaths, outputPath });
  };

  const upload = (
    <FileDropzone
      multiple
      selectedPaths={inputPaths}
      accept={IMAGE_EXTS}
      onFiles={handleFiles}
      label="Drop images here or click to browse"
    />
  );

  const preview = inputPaths.length > 0 ? (
    <div className="surface-elevated p-5 animate-fade-in-up">
      <h3 className="text-[13px] font-semibold text-text mb-3">
        Images to convert
        <span className="ml-1.5 text-text-muted font-normal">({inputPaths.length})</span>
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {inputPaths.map((path, i) => (
          <div
            key={`${path}-${i}`}
            className="relative group overflow-hidden border border-border-subtle bg-bg-secondary"
          >
            <img
              src={convertFileSrc(path)}
              alt={getFileName(path)}
              className="w-full h-28 object-cover"
              draggable={false}
            />
            <div className="absolute bottom-0 left-0 right-0 p-2 bg-black/60 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-200">
              <p className="text-[11px] text-white truncate font-medium">
                {getFileName(path)}
              </p>
            </div>
            <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-black/50 text-[10px] text-white font-medium tabular-nums">
              {i + 1}
            </span>
            <button
              onClick={() => removeFile(i)}
              aria-label={`Remove ${getFileName(path)}`}
              className="absolute top-1.5 right-1.5 p-1 bg-black/50 text-white/70 hover:text-white hover:bg-danger opacity-0 group-hover:opacity-100 focus-visible:opacity-100 group-focus-within:opacity-100 transition-all duration-150"
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  ) : null;

  const controls = (
    <div className="surface-elevated p-5 animate-fade-in-up">
      <Button fullWidth onClick={handleProcess} disabled={inputPaths.length === 0 || loading}>
        {loading ? "Converting..." : "Convert to PDF"}
      </Button>
    </div>
  );

  return (
    <ToolPage
      title="Images to PDF"
      description="Convert images into a single PDF document."
      icon={<FileImage size={22} />}
      upload={upload}
      preview={preview}
      controls={controls}
      onClear={inputPaths.length > 0 ? clear : undefined}
    >
      {loading && <ProgressBar percent={-1} label="Converting to PDF..." />}

      {error && <ErrorPanel error={error} />}

      {result && (
        <ResultPanel
          outputPath={result.output_paths[0] ?? ""}
          stats={[
            { label: "Pages", value: String(result.page_count) },
            { label: "Images converted", value: String(result.output_paths.length) },
          ]}
          onOpenFolder={async () => {
            const { open } = await import("@tauri-apps/plugin-shell");
            open(getDirName(result.output_paths[0] ?? ""));
          }}
        />
      )}
    </ToolPage>
  );
}
