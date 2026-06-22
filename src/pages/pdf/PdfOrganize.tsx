import { useState } from "react";
import { LayoutGrid, X, ArrowUp, ArrowDown, RotateCw } from "lucide-react";
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

interface PageOp {
  source_page: number;
  rotation: number;
}

interface OrganizeResult {
  output_path: string;
  page_count: number;
  file_size: number;
}

export function PdfOrganize() {
  const [inputPaths, setInputPaths] = useState<string[]>([]);
  const [totalPages, setTotalPages] = useState(10);
  const [ops, setOps] = useState<PageOp[]>([]);
  const single = useProcess<OrganizeResult>({ tool: "Organize PDF" });

  const handleFiles = (paths: string[]) => {
    setInputPaths(paths);
    single.reset();
    // Default: identity (all source pages, no rotation). User can then
    // delete / reorder / rotate from the list.
    const next = Array.from({ length: totalPages }, (_, i) => ({
      source_page: i + 1,
      rotation: 0,
    }));
    setOps(next);
  };
  usePrefilledFile(handleFiles);

  const clear = () => {
    setInputPaths([]);
    setOps([]);
    single.reset();
  };

  const remove = (i: number) => setOps((prev) => prev.filter((_, j) => j !== i));
  const move = (i: number, dir: -1 | 1) => {
    const t = i + dir;
    if (t < 0 || t >= ops.length) return;
    setOps((prev) => {
      const next = [...prev];
      [next[i], next[t]] = [next[t], next[i]];
      return next;
    });
  };
  const rotate = (i: number) =>
    setOps((prev) =>
      prev.map((op, j) =>
        j === i ? { ...op, rotation: (op.rotation + 90) % 360 } : op,
      ),
    );

  const inputPath = inputPaths[0] ?? "";

  const handleProcess = async () => {
    if (inputPaths.length === 0 || ops.length === 0) return;
    const outputPath = await resolveOutputPath({
      suggested: addSuffix(inputPath, "organized"),
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    });
    if (!outputPath) return;
    await single.run("organize_pdf", { inputPath, outputPath, ops });
  };

  const upload = (
    <FileDropzone
      accept={["pdf"]}
      onFiles={handleFiles}
      label="Drop a PDF here or click to browse"
    />
  );

  const preview = inputPath ? (
    <div className="surface-elevated p-5 animate-fade-in-up">
      <div className="text-[13px] font-semibold text-text mb-1 break-all">
        {getFileName(inputPath)}
      </div>
      <div className="text-[11px] text-text-muted mb-3">PDF selected</div>
      <div>
        <h3 className="text-[13px] font-semibold text-text mb-2">
          Output pages
          <span className="ml-1.5 text-text-muted font-normal">({ops.length})</span>
        </h3>
        <div className="bg-bg-secondary p-1.5 space-y-1 max-h-[400px] overflow-y-auto">
          {ops.map((op, i) => (
            <div
              key={`${op.source_page}-${i}`}
              className="flex items-center gap-2 px-3 py-2 hover:bg-surface-hover transition-colors duration-150 group"
            >
              <span className="text-[12px] text-text-muted tabular-nums min-w-[1.5rem] text-center font-medium">
                {i + 1}
              </span>
              <span className="text-[13px] text-text flex-1">
                Source page {op.source_page}
                {op.rotation > 0 && (
                  <span className="ml-2 text-text-muted">[rotated {op.rotation} deg]</span>
                )}
              </span>
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150">
                <button
                  onClick={() => rotate(i)}
                  title="Rotate 90 deg"
                  className="p-1 text-text-muted hover:text-text hover:bg-bg-secondary transition-colors duration-150"
                >
                  <RotateCw size={13} />
                </button>
                <button
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  className="p-1 text-text-muted hover:text-text hover:bg-bg-secondary disabled:opacity-30 transition-colors duration-150"
                >
                  <ArrowUp size={13} />
                </button>
                <button
                  onClick={() => move(i, 1)}
                  disabled={i === ops.length - 1}
                  className="p-1 text-text-muted hover:text-text hover:bg-bg-secondary disabled:opacity-30 transition-colors duration-150"
                >
                  <ArrowDown size={13} />
                </button>
                <button
                  onClick={() => remove(i)}
                  className="p-1 text-text-muted hover:text-danger hover:bg-danger-light transition-colors duration-150"
                >
                  <X size={13} />
                </button>
              </div>
            </div>
          ))}
          {ops.length === 0 && (
            <p className="text-[12px] text-text-muted text-center py-6">
              All pages removed. Increase the source page count to start over.
            </p>
          )}
        </div>
      </div>
    </div>
  ) : null;

  const controls = (
    <div className="surface-elevated p-5 space-y-4 animate-fade-in-up">
      <Field label="Source page count">
        <div className="w-32">
          <Input
            type="number"
            min={1}
            value={totalPages}
            onChange={(e) => {
              const n = Math.max(1, Number(e.target.value) || 1);
              setTotalPages(n);
              setOps(Array.from({ length: n }, (_, i) => ({ source_page: i + 1, rotation: 0 })));
            }}
          />
        </div>
        <p className="text-[11px] text-text-muted mt-1">
          Adjust until the list matches your PDF, then arrange.
        </p>
      </Field>

      <Button
        fullWidth
        onClick={handleProcess}
        disabled={single.loading || ops.length === 0 || inputPaths.length === 0}
      >
        {single.loading ? "Organizing..." : `Save ${ops.length}-page PDF`}
      </Button>
    </div>
  );

  return (
    <ToolPage
      title="Organize Pages"
      description="Reorder, delete, and rotate pages of a PDF. Set the total page count, then arrange the output sequence."
      icon={<LayoutGrid size={22} />}
      upload={upload}
      preview={preview}
      controls={controls}
      onClear={inputPaths.length > 0 ? clear : undefined}
    >
      {single.loading && <ProgressBar percent={-1} label="Writing organized PDF..." />}

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
