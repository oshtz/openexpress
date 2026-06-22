import { useEffect, useState } from "react";
import { Download, Sparkles, CheckCircle2 } from "lucide-react";
import { invoke, Channel } from "@tauri-apps/api/core";
import { toAppError, type AppError } from "../../lib/errors";
import { formatBytes } from "../../lib/utils";
import { ErrorPanel } from "./ErrorPanel";

interface ModelInfo {
  id: string;
  filename: string;
  approx_bytes: number;
  description: string;
  installed: boolean;
  path: string;
}

interface DownloadProgress {
  downloaded: number;
  total: number;
  percent: number;
}

interface ModelDownloadCardProps {
  modelId: string;
  /** Called once the model is confirmed present (either already installed
   *  or just downloaded successfully). Drives the parent's UI swap. */
  onInstalled?: () => void;
}

/**
 * First-run gate for ML features. Queries `model_info`; if the model is
 * missing, shows a download button + streaming progress. If present (or
 * once downloaded), renders nothing and signals via `onInstalled`.
 */
export function ModelDownloadCard({ modelId, onInstalled }: ModelDownloadCardProps) {
  const [info, setInfo] = useState<ModelInfo | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [error, setError] = useState<AppError | null>(null);

  useEffect(() => {
    let cancelled = false;
    invoke<ModelInfo>("model_info", { id: modelId })
      .then((m) => {
        if (cancelled) return;
        setInfo(m);
        if (m.installed) onInstalled?.();
      })
      .catch((e) => !cancelled && setError(toAppError(e)));
    return () => {
      cancelled = true;
    };
  }, [modelId, onInstalled]);

  const handleDownload = async () => {
    setDownloading(true);
    setError(null);
    setProgress(null);
    try {
      const ch = new Channel<DownloadProgress>();
      ch.onmessage = (p) => setProgress(p);
      await invoke("download_model", { id: modelId, progress: ch });
      setDownloading(false);
      const refreshed = await invoke<ModelInfo>("model_info", { id: modelId });
      setInfo(refreshed);
      onInstalled?.();
    } catch (e) {
      setDownloading(false);
      setError(toAppError(e));
    }
  };

  if (!info) {
    return error ? <ErrorPanel error={error} /> : null;
  }
  if (info.installed) return null;

  return (
    <div className="space-y-3 animate-fade-in-up">
      <div className="border border-border bg-warning-light p-4 flex items-start gap-3">
        <Sparkles size={16} className="text-warning shrink-0 mt-0.5" />
        <div className="text-[12px] text-text-secondary leading-relaxed flex-1">
          <div className="text-text font-semibold mb-1">First-run download required</div>
          <p>{info.description}</p>
          <p className="mt-1 text-text-muted">
            <span className="font-mono text-[11px]">{info.filename}</span> &middot;{" "}
            {formatBytes(info.approx_bytes)} &middot; stored under app data dir
          </p>
        </div>
      </div>

      {!downloading && (
        <button
          onClick={handleDownload}
          className="w-full flex items-center justify-center gap-2 py-2.5 text-[13px] font-semibold transition-all duration-200 bg-primary text-primary-light hover:bg-primary-hover"
        >
          <Download size={14} />
          Download model ({formatBytes(info.approx_bytes)})
        </button>
      )}

      {downloading && (
        <div className="surface-elevated p-4 space-y-2">
          <div className="flex items-baseline justify-between text-[12px]">
            <span className="text-text-secondary">Downloading...</span>
            <span className="font-mono text-text tabular-nums">
              {progress
                ? `${formatBytes(progress.downloaded)} / ${formatBytes(progress.total)} (${progress.percent.toFixed(0)}%)`
                : "starting..."}
            </span>
          </div>
          <div className="h-1.5 bg-bg-tertiary overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: progress ? `${Math.max(progress.percent, 2)}%` : "2%" }}
            />
          </div>
        </div>
      )}

      {error && <ErrorPanel error={error} />}
    </div>
  );
}

/**
 * Lighter variant: shows a confirmation pill once the model is present.
 * Use when you want to surface "model is ready" persistently.
 */
export function ModelInstalledPill({ modelId }: { modelId: string }) {
  const [info, setInfo] = useState<ModelInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    invoke<ModelInfo>("model_info", { id: modelId })
      .then((m) => !cancelled && setInfo(m))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [modelId]);

  if (!info?.installed) return null;
  return (
    <div className="flex items-center gap-2 text-[11px] text-text-muted">
      <CheckCircle2 size={12} className="text-success-ink" />
      <span>
        Model <span className="font-mono">{info.filename}</span> ready
      </span>
    </div>
  );
}
