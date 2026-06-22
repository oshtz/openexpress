import { useState } from "react";
import { Crop } from "lucide-react";
import { resolveOutputPath } from "../../lib/output";
import { ToolPage } from "../../components/common/ToolPage";
import { FileDropzone } from "../../components/common/FileDropzone";
import { ResultPanel } from "../../components/common/ResultPanel";
import { BeforeAfter } from "../../components/common/BeforeAfter";
import { ErrorPanel } from "../../components/common/ErrorPanel";
import { ProgressBar } from "../../components/common/ProgressBar";
import { CropCanvas } from "../../components/common/CropCanvas";
import { Button } from "../../components/ui";
import { useProcess } from "../../hooks/useProcess";
import { usePrefilledFile } from "../../hooks/usePrefilledFile";
import { addSuffix, formatBytes } from "../../lib/utils";

interface CropResult {
  output_path: string;
  width: number;
  height: number;
  file_size: number;
}

const ASPECT_PRESETS = [
  { label: "Free", ratio: null },
  { label: "1:1", ratio: 1 },
  { label: "4:3", ratio: 4 / 3 },
  { label: "16:9", ratio: 16 / 9 },
  { label: "3:2", ratio: 3 / 2 },
];

const IMAGE_EXTS = ["jpg", "jpeg", "png", "webp", "bmp", "tiff"];

export function ImageCrop() {
  const [inputPaths, setInputPaths] = useState<string[]>([]);
  const [x, setX] = useState(0);
  const [y, setY] = useState(0);
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const [aspectPreset, setAspectPreset] = useState("Free");
  const { loading, error, result, run, reset } = useProcess<CropResult>({ tool: "Crop" });

  const handleFiles = (paths: string[]) => {
    setInputPaths(paths);
    reset();
  };
  usePrefilledFile(handleFiles);

  const clear = () => {
    setInputPaths([]);
    setX(0);
    setY(0);
    setWidth(0);
    setHeight(0);
    reset();
  };

  const handleCropChange = (crop: { x: number; y: number; width: number; height: number }) => {
    setX(crop.x);
    setY(crop.y);
    setWidth(crop.width);
    setHeight(crop.height);
  };

  const selectedRatio = ASPECT_PRESETS.find((p) => p.label === aspectPreset)?.ratio ?? null;

  const inputPath = inputPaths[0] ?? "";

  const handleProcess = async () => {
    if (!inputPath || width <= 0 || height <= 0) return;
    const outputPath = await resolveOutputPath({
      suggested: addSuffix(inputPath, "cropped"),
      filters: [{ name: "Images", extensions: ["jpg", "png", "webp"] }],
    });
    if (!outputPath) return;
    await run("crop_image", { inputPath, outputPath, x, y, width, height });
  };

  const upload = (
    <FileDropzone
      accept={IMAGE_EXTS}
      onFiles={handleFiles}
      label="Drop an image here or click to browse"
    />
  );

  const preview = inputPath ? (
    <CropCanvas path={inputPath} aspectRatio={selectedRatio} onChange={handleCropChange} />
  ) : null;

  const controls = (
    <div className="surface-elevated p-5 space-y-4 animate-fade-in-up">
      <div>
        <label className="block text-[13px] font-medium text-text-secondary mb-2">
          Aspect ratio
        </label>
        <div className="flex flex-wrap gap-2">
          {ASPECT_PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => setAspectPreset(p.label)}
              className={`px-3.5 py-2 text-[13px] font-medium border transition-all duration-200 ${
                aspectPreset === p.label
                  ? "bg-primary text-primary-light border-primary"
                  : "bg-bg-secondary border-border text-text-secondary hover:border-primary/30 hover:text-text"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3 text-[12px] text-text-secondary">
        <span>
          Position:{" "}
          <span className="font-semibold text-text tabular-nums">
            {x}, {y}
          </span>
        </span>
        <span className="text-border">|</span>
        <span>
          Size:{" "}
          <span className="font-semibold text-text tabular-nums">
            {width} x {height}
          </span>
        </span>
      </div>

      <Button
        fullWidth
        onClick={handleProcess}
        disabled={loading || width <= 0 || height <= 0 || inputPaths.length === 0}
      >
        {loading ? "Cropping..." : "Crop image"}
      </Button>
    </div>
  );

  return (
    <ToolPage
      title="Crop Image"
      description="Crop images with custom dimensions and aspect ratio presets."
      icon={<Crop size={22} />}
      upload={upload}
      preview={preview}
      controls={controls}
      onClear={inputPaths.length > 0 ? clear : undefined}
    >
      {loading && <ProgressBar percent={-1} label="Cropping image..." />}

      {error && <ErrorPanel error={error} />}

      {result && (
        <>
          <BeforeAfter
            beforePath={inputPath}
            afterPath={result.output_path}
            cacheBuster={result.file_size}
          />
          <ResultPanel
            outputPath={result.output_path}
            stats={[
              { label: "Dimensions", value: `${result.width} x ${result.height}` },
              { label: "File size", value: formatBytes(result.file_size) },
            ]}
          />
        </>
      )}
    </ToolPage>
  );
}
