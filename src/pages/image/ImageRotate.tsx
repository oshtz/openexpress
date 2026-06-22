import { useState } from "react";
import { RotateCw, FlipHorizontal, FlipVertical } from "lucide-react";
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
import { addSuffix, formatBytes } from "../../lib/utils";
import { toAppError } from "../../lib/errors";

interface RotateResult {
  output_path: string;
  width: number;
  height: number;
  file_size: number;
}

const ROTATIONS = [0, 90, 180, 270] as const;
const IMAGE_EXTS = ["jpg", "jpeg", "png", "webp", "bmp", "tiff"];

export function ImageRotate() {
  const [inputPaths, setInputPaths] = useState<string[]>([]);
  const [rotation, setRotation] = useState<number>(0);
  const [flipHorizontal, setFlipHorizontal] = useState(false);
  const [flipVertical, setFlipVertical] = useState(false);
  const single = useProcess<RotateResult>({ tool: "Rotate" });
  const batch = useBatch<string, RotateResult>();
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
        suggested: addSuffix(inputPath, "rotated"),
        filters: [{ name: "Images", extensions: IMAGE_EXTS }],
      });
      if (!outputPath) return;
      await single.run("rotate_flip_image", {
        inputPath,
        outputPath,
        rotation,
        flipHorizontal,
        flipVertical,
      });
      return;
    }

    await batch.start(inputPaths, async (inputPath) => {
      const outputPath = resolveBatchOutputPath(inputPath, { suffix: "rotated" });
      try {
        return await invoke<RotateResult>("rotate_flip_image", {
          inputPath,
          outputPath,
          rotation,
          flipHorizontal,
          flipVertical,
        });
      } catch (e) {
        throw toAppError(e);
      }
    });
  };

  const transforms = [
    rotation ? `rotate(${rotation}deg)` : "",
    flipHorizontal ? "scaleX(-1)" : "",
    flipVertical ? "scaleY(-1)" : "",
  ]
    .filter(Boolean)
    .join(" ");

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
      <ImagePreview
        path={inputPaths[0]}
        style={{ transform: transforms, transition: "transform 0.3s ease" }}
      />
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
        <label className="block text-[13px] font-medium text-text-secondary mb-2">Rotation</label>
        <div className="flex gap-2">
          {ROTATIONS.map((deg) => (
            <button
              key={deg}
              onClick={() => setRotation(deg)}
              className={`px-4 py-2 text-[13px] font-medium border transition-all duration-200 ${
                rotation === deg
                  ? "bg-primary text-primary-light border-primary"
                  : "bg-bg-secondary border-border text-text-secondary hover:border-primary/30 hover:text-text"
              }`}
            >
              {deg} deg
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-[13px] font-medium text-text-secondary mb-2">Flip</label>
        <div className="flex gap-2">
          <button
            onClick={() => setFlipHorizontal(!flipHorizontal)}
            className={`flex items-center gap-2 px-4 py-2 text-[13px] font-medium border transition-all duration-200 ${
              flipHorizontal
                ? "bg-primary text-primary-light border-primary"
                : "bg-bg-secondary border-border text-text-secondary hover:border-primary/30 hover:text-text"
            }`}
          >
            <FlipHorizontal size={15} />
            Horizontal
          </button>
          <button
            onClick={() => setFlipVertical(!flipVertical)}
            className={`flex items-center gap-2 px-4 py-2 text-[13px] font-medium border transition-all duration-200 ${
              flipVertical
                ? "bg-primary text-primary-light border-primary"
                : "bg-bg-secondary border-border text-text-secondary hover:border-primary/30 hover:text-text"
            }`}
          >
            <FlipVertical size={15} />
            Vertical
          </button>
        </div>
      </div>

      <Button
        fullWidth
        onClick={handleProcess}
        disabled={single.loading || batch.running || inputPaths.length === 0}
      >
        {single.loading
          ? "Processing..."
          : batch.running
            ? `Processing ${batch.completed + 1} of ${batch.total}...`
            : isBatch
              ? `Apply transform to ${inputPaths.length} images`
              : "Apply transform"}
      </Button>
    </div>
  );

  return (
    <ToolPage
      title="Rotate / Flip"
      description="Rotate by 90-degree increments or flip horizontally and vertically. Drop multiple files to batch-process."
      icon={<RotateCw size={22} />}
      upload={upload}
      preview={preview}
      controls={controls}
      onClear={inputPaths.length > 0 ? clear : undefined}
    >
      {!isBatch && single.loading && (
        <ProgressBar percent={-1} label="Transforming image..." />
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
