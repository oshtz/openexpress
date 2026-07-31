import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { Activity, Copy, Check } from "lucide-react";
import { useAppStore } from "../../stores/appStore";

interface Diagnostics {
  app_version: string;
  os: string;
  arch: string;
  ffmpeg_available: boolean;
  ffmpeg_version: string | null;
  app_data_dir: string | null;
  log_dir: string | null;
  features: {
    bg_removal: boolean;
  };
}

function formatDiagnostics(d: Diagnostics): string {
  return [
    `OpenExpress v${d.app_version}`,
    `Platform: ${d.os} (${d.arch})`,
    `FFmpeg: ${d.ffmpeg_available ? d.ffmpeg_version ?? "unknown version" : "not available"}`,
    `App data: ${d.app_data_dir ?? "—"}`,
    `Logs: ${d.log_dir ?? "—"}`,
    `Features: bg-removal=${d.features.bg_removal ? "on" : "off"}`,
  ].join("\n");
}

export function DiagnosticsPanel() {
  const isTauri = "__TAURI_INTERNALS__" in window;
  const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(() =>
    isTauri
      ? null
      : {
          app_version: "web preview",
          os: navigator.platform || "browser",
          arch: "browser",
          ffmpeg_available: false,
          ffmpeg_version: null,
          app_data_dir: null,
          log_dir: null,
          features: { bg_removal: false },
        },
  );
  const [copied, setCopied] = useState(false);
  const pushToast = useAppStore((s) => s.pushToast);

  useEffect(() => {
    if (!isTauri) return;
    invoke<Diagnostics>("get_diagnostics")
      .then(setDiagnostics)
      .catch(() => {
        // Surface as a toast; the rest of Settings stays usable.
        pushToast("error", "Failed to load diagnostics");
      });
  }, [isTauri, pushToast]);

  const handleCopy = useCallback(async () => {
    if (!diagnostics) return;
    try {
      await writeText(formatDiagnostics(diagnostics));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      pushToast("error", "Couldn't copy to clipboard");
    }
  }, [diagnostics, pushToast]);

  if (!diagnostics) {
    return (
      <div className="surface-elevated p-6">
        <div className="flex items-center gap-3">
          <Activity size={15} className="text-text-muted" />
          <span className="text-[13px] text-text-muted">Loading diagnostics…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="surface-elevated p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-bg-secondary flex items-center justify-center shrink-0">
            <Activity size={15} className="text-text-muted" />
          </div>
          <h3 className="text-[14px] font-semibold text-text">Diagnostics</h3>
        </div>
        <button onClick={handleCopy} className="swiss-link">
          {copied ? (
            <>
              <Check size={13} className="text-success-ink" />
              Copied
            </>
          ) : (
            <>
              <Copy size={13} />
              Copy
            </>
          )}
        </button>
      </div>

      <dl className="space-y-2.5 text-[12px]">
        <Row label="Version" value={`v${diagnostics.app_version}`} mono />
        <Row label="Platform" value={`${diagnostics.os} · ${diagnostics.arch}`} />
        <Row
          label="FFmpeg"
          value={
            diagnostics.ffmpeg_available
              ? diagnostics.ffmpeg_version ?? "available (version unknown)"
              : "unavailable"
          }
          mono
        />
        <Row label="App data" value={diagnostics.app_data_dir ?? "—"} mono />
        <Row label="Logs" value={diagnostics.log_dir ?? "—"} mono />
        <Row
          label="bg-removal"
          value={diagnostics.features.bg_removal ? "enabled" : "disabled"}
        />
      </dl>
    </div>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline gap-3">
      <dt className="text-text-muted shrink-0 w-24">{label}</dt>
      <dd
        className={`text-text break-all flex-1 ${mono ? "font-mono text-[11px]" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}
