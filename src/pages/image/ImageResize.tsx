import { useState } from "react";
import { Scaling } from "lucide-react";
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
import { Button, Checkbox, Field, Input, Select } from "../../components/ui";
import { useProcess } from "../../hooks/useProcess";
import { useBatch } from "../../hooks/useBatch";
import { usePrefilledFile } from "../../hooks/usePrefilledFile";
import { addSuffix, formatBytes } from "../../lib/utils";
import { toAppError } from "../../lib/errors";

interface ResizeResult {
  output_path: string;
  width: number;
  height: number;
  file_size: number;
}

const PRESETS = [
  { label: "Custom", width: 0, height: 0 },
  { label: "Instagram Post", width: 1080, height: 1080 },
  { label: "Instagram Story", width: 1080, height: 1920 },
  { label: "Facebook Post", width: 1200, height: 630 },
  { label: "YouTube Thumbnail", width: 1280, height: 720 },
  { label: "Twitter Post", width: 1600, height: 900 },
  { label: "LinkedIn Post", width: 1200, height: 627 },
];

const IMAGE_EXTS = ["jpg", "jpeg", "png", "webp", "bmp", "tiff"];

export function ImageResize() {
  const [inputPaths, setInputPaths] = useState<string[]>([]);
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const [originalDims, setOriginalDims] = useState<{ width: number; height: number } | null>(null);
  const [maintainAspect, setMaintainAspect] = useState(true);
  const [preset, setPreset] = useState("Custom");
  const single = useProcess<ResizeResult>({ tool: "Resize" });
  const batch = useBatch<string, ResizeResult>();
  const isBatch = inputPaths.length > 1;

  const handleFiles = (paths: string[]) => {
    setInputPaths(paths);
    setOriginalDims(null);
    single.reset();
    batch.reset();
  };
  usePrefilledFile(handleFiles);

  const clear = () => {
    setInputPaths([]);
    setOriginalDims(null);
    single.reset();
    batch.reset();
  };

  const handlePreset = (label: string) => {
    setPreset(label);
    const found = PRESETS.find((p) => p.label === label);
    if (found && found.width > 0) {
      setWidth(found.width);
      setHeight(found.height);
    }
  };

  const canRun = inputPaths.length > 0 && width > 0 && height > 0;

  const handleProcess = async () => {
    if (!canRun) return;

    if (!isBatch) {
      const inputPath = inputPaths[0];
      const outputPath = await resolveOutputPath({
        suggested: addSuffix(inputPath, "resized"),
        filters: [{ name: "Images", extensions: IMAGE_EXTS }],
      });
      if (!outputPath) return;
      await single.run("resize_image", { inputPath, outputPath, width, height, maintainAspect });
      return;
    }

    await batch.start(inputPaths, async (inputPath) => {
      const outputPath = resolveBatchOutputPath(inputPath, { suffix: `${width}x${height}` });
      try {
        return await invoke<ResizeResult>("resize_image", {
          inputPath,
          outputPath,
          width,
          height,
          maintainAspect,
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
      selectedPaths={inputPaths}
      onFiles={handleFiles}
      label="Drop one or more images here or click to browse"
    />
  );

  const preview =
    inputPaths.length === 0 ? null : !isBatch ? (
      <div className="relative">
        <ImagePreview path={inputPaths[0]} onLoad={(dims) => setOriginalDims(dims)} />
        {originalDims && (
          <div className="absolute bottom-3 right-3 px-2.5 py-1 bg-black/70 text-[11px] text-white tabular-nums">
            {originalDims.width} x {originalDims.height}
            {width > 0 && height > 0 && (
              <span className="text-primary ml-1.5">
                -&gt; {width} x {height}
              </span>
            )}
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
      <Field label="Preset">
        <Select value={preset} onChange={(e) => handlePreset(e.target.value)}>
          {PRESETS.map((p) => (
            <option key={p.label} value={p.label}>
              {p.label}
              {p.width > 0 ? ` (${p.width} x ${p.height})` : ""}
            </option>
          ))}
        </Select>
      </Field>

      <div className="flex gap-4">
        <Field label="Width (px)" className="flex-1">
          <Input
            type="number"
            min={1}
            value={width || ""}
            onChange={(e) => {
              setWidth(Number(e.target.value));
              setPreset("Custom");
            }}
            className="tabular-nums"
            placeholder="Width"
          />
        </Field>
        <Field label="Height (px)" className="flex-1">
          <Input
            type="number"
            min={1}
            value={height || ""}
            onChange={(e) => {
              setHeight(Number(e.target.value));
              setPreset("Custom");
            }}
            className="tabular-nums"
            placeholder="Height"
          />
        </Field>
      </div>

      <Checkbox
        label="Maintain aspect ratio"
        checked={maintainAspect}
        onChange={(e) => setMaintainAspect(e.target.checked)}
      />

      <Button
        fullWidth
        onClick={handleProcess}
        disabled={!canRun || single.loading || batch.running || inputPaths.length === 0}
      >
        {single.loading
          ? "Resizing..."
          : batch.running
            ? `Resizing ${batch.completed + 1} of ${batch.total}...`
            : isBatch
              ? `Resize ${inputPaths.length} images`
              : "Resize image"}
      </Button>
    </div>
  );

  return (
    <ToolPage
      title="Resize Image"
      description="Resize to custom dimensions or popular presets. Drop multiple files to batch-resize."
      icon={<Scaling size={22} />}
      upload={upload}
      preview={preview}
      controls={controls}
      onClear={inputPaths.length > 0 ? clear : undefined}
    >
      {!isBatch && single.loading && (
        <ProgressBar percent={-1} label="Resizing image..." />
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
              { label: "Dimensions", value: `${single.result.width} x ${single.result.height}` },
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
