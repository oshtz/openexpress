import { useCallback, useEffect, useState } from "react";
import { Channel, invoke } from "@tauri-apps/api/core";
import { AlertTriangle, CheckCircle2, Download, Loader2, RefreshCw, RotateCcw } from "lucide-react";
import { useAppStore } from "../../stores/appStore";
import { toAppError, type AppError } from "../../lib/errors";
import { formatBytes } from "../../lib/utils";
import { ErrorPanel } from "./ErrorPanel";
import { Button } from "../ui";

type UpdateAssetKind = "windowsExe" | "macosApp";

interface UpdateAssetInfo {
  platform: string;
  url: string;
  sha256: string;
  size: number | null;
  kind: UpdateAssetKind;
}

interface UpdateCheckResponse {
  currentVersion: string;
  latestVersion: string | null;
  available: boolean;
  blocked: boolean;
  reason: string | null;
  message: string | null;
  notes: string | null;
  pubDate: string | null;
  asset: UpdateAssetInfo | null;
}

interface PreparedUpdate {
  version: string;
  path: string;
  kind: UpdateAssetKind;
  size: number | null;
  sha256: string;
}

interface UpdateDownloadProgress {
  downloaded: number;
  total: number;
  percent: number;
}

type BusyState = "checking" | "downloading" | "installing" | null;

export function UpdatePanel() {
  const [status, setStatus] = useState<UpdateCheckResponse | null>(null);
  const [prepared, setPrepared] = useState<PreparedUpdate | null>(null);
  const [progress, setProgress] = useState<UpdateDownloadProgress | null>(null);
  const [busy, setBusy] = useState<BusyState>(null);
  const [error, setError] = useState<AppError | null>(null);
  const pushToast = useAppStore((s) => s.pushToast);

  const refresh = useCallback(async () => {
    setBusy("checking");
    setError(null);
    try {
      const next = await invoke<UpdateCheckResponse>("check_update");
      setStatus(next);
      setPrepared(null);
      setProgress(null);
    } catch (e) {
      setError(toAppError(e));
    } finally {
      setBusy(null);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Sync initial state from the Tauri runtime.
    void refresh();
  }, [refresh]);

  const handleDownload = useCallback(async () => {
    setBusy("downloading");
    setError(null);
    setPrepared(null);
    setProgress(null);
    try {
      const ch = new Channel<UpdateDownloadProgress>();
      ch.onmessage = (event) => setProgress(event);
      const next = await invoke<PreparedUpdate>("download_update", { progress: ch });
      setPrepared(next);
      pushToast("success", `OpenExpress ${next.version} is ready to install`);
    } catch (e) {
      setError(toAppError(e));
    } finally {
      setBusy(null);
    }
  }, [pushToast]);

  const handleInstall = useCallback(async () => {
    if (!prepared) return;
    setBusy("installing");
    setError(null);
    try {
      await invoke("install_update", {
        preparedPath: prepared.path,
        version: prepared.version,
      });
    } catch (e) {
      setBusy(null);
      setError(toAppError(e));
    }
  }, [prepared]);

  const isChecking = busy === "checking";
  const isDownloading = busy === "downloading";
  const isInstalling = busy === "installing";
  const canDownload = Boolean(status?.available && !prepared && !busy);
  const canInstall = Boolean(prepared && !busy);

  return (
    <div className="surface-elevated p-6">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 bg-bg-secondary flex items-center justify-center shrink-0 mt-0.5">
          {status?.blocked ? (
            <AlertTriangle size={15} className="text-warning" />
          ) : status?.available ? (
            <Download size={15} className="text-primary" />
          ) : (
            <RefreshCw size={15} className="text-text-muted" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-[14px] font-semibold text-text">Updates</h3>
            {status && !status.available && !status.blocked && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-success-ink">
                <CheckCircle2 size={11} />
                Current
              </span>
            )}
          </div>

          <p className="text-[13px] text-text-secondary leading-relaxed">
            {status?.message ?? "Check GitHub Releases for an OpenExpress update."}
          </p>

          <dl className="mt-3 space-y-1.5 text-[12px]">
            <Row label="Installed" value={status ? `v${status.currentVersion}` : "checking..."} mono />
            {status?.latestVersion && <Row label="Latest" value={`v${status.latestVersion}`} mono />}
            {status?.asset && <Row label="Target" value={status.asset.platform} mono />}
            {prepared && <Row label="Downloaded" value={prepared.size ? formatBytes(prepared.size) : "ready"} />}
          </dl>

          {status?.blocked && (
            <p className="mt-3 text-[12px] text-warning leading-snug">
              {status.message}
            </p>
          )}

          {status?.notes && status.available && (
            <div className="mt-3 border border-border bg-bg-secondary p-3 text-[12px] text-text-secondary leading-relaxed whitespace-pre-wrap max-h-32 overflow-auto">
              {status.notes}
            </div>
          )}

          {isDownloading && (
            <div className="mt-4 space-y-2">
              <div className="flex items-baseline justify-between text-[12px]">
                <span className="text-text-secondary">Downloading update...</span>
                <span className="font-mono text-text tabular-nums">
                  {progress
                    ? progress.total > 0
                      ? `${formatBytes(progress.downloaded)} / ${formatBytes(progress.total)} (${progress.percent.toFixed(0)}%)`
                      : formatBytes(progress.downloaded)
                    : "starting..."}
                </span>
              </div>
              <div className="h-1.5 bg-bg-tertiary overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${progress?.percent && progress.percent > 0 ? progress.percent : 3}%` }}
                />
              </div>
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={refresh}
              disabled={Boolean(busy)}
              className="inline-flex items-center gap-2"
            >
              {isChecking ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              {isChecking ? "Checking..." : "Check for updates"}
            </Button>

            {status?.available && (
              <Button
                variant="primary"
                onClick={handleDownload}
                disabled={!canDownload}
                className="inline-flex items-center gap-2"
              >
                {isDownloading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                {isDownloading ? "Downloading..." : "Download update"}
              </Button>
            )}

            {prepared && (
              <button
                onClick={handleInstall}
                disabled={!canInstall}
                className="inline-flex items-center gap-2 px-4 py-2 text-[13px] font-medium bg-success text-primary-light hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200"
              >
                {isInstalling ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
                {isInstalling ? "Restarting..." : "Install and restart"}
              </button>
            )}
          </div>

          {error && (
            <div className="mt-4">
              <ErrorPanel error={error} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline gap-3">
      <dt className="text-text-muted shrink-0 w-24">{label}</dt>
      <dd className={`text-text break-all flex-1 ${mono ? "font-mono text-[11px]" : ""}`}>
        {value}
      </dd>
    </div>
  );
}
