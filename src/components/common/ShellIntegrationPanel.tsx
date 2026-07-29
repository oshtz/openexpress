import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Link2, CheckCircle2, Loader2 } from "lucide-react";
import { useAppStore } from "../../stores/appStore";
import { toAppError } from "../../lib/errors";
import { Button } from "../ui";

interface ShellIntegrationStatus {
  installed: boolean;
  manual_only: boolean;
  note: string | null;
}

/**
 * Settings panel: enable/disable OS file-manager right-click integration.
 *
 * Runtime register/unregister on Windows + Linux. macOS ships file
 * associations with the bundle (no toggle), so the panel just confirms
 * the always-on status and points to the right place in Finder.
 */
export function ShellIntegrationPanel() {
  const [status, setStatus] = useState<ShellIntegrationStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const pushToast = useAppStore((s) => s.pushToast);

  const refresh = useCallback(async () => {
    try {
      const s = await invoke<ShellIntegrationStatus>("shell_integration_status");
      setStatus(s);
    } catch (e) {
      pushToast("error", toAppError(e).message);
    }
  }, [pushToast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Sync initial state from the Tauri runtime.
    void refresh();
  }, [refresh]);

  const toggle = useCallback(async () => {
    if (!status || status.manual_only) return;
    setBusy(true);
    const cmd = status.installed
      ? "unregister_shell_integration"
      : "register_shell_integration";
    try {
      await invoke(cmd);
      pushToast(
        "success",
        status.installed ? "Shell integration removed" : "Shell integration installed",
      );
      await refresh();
    } catch (e) {
      pushToast("error", toAppError(e).message);
    } finally {
      setBusy(false);
    }
  }, [status, pushToast, refresh]);

  if (!status) {
    return (
      <div className="surface-elevated p-6">
        <div className="flex items-center gap-3">
          <Loader2 size={15} className="text-text-muted animate-spin" />
          <span className="text-[13px] text-text-muted">Loading shell integration...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="surface-elevated p-6">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 bg-bg-secondary flex items-center justify-center shrink-0 mt-0.5">
          <Link2 size={15} className="text-text-muted" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-[14px] font-semibold text-text">Shell integration</h3>
            {status.installed && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-success-ink">
                <CheckCircle2 size={11} />
                Active
              </span>
            )}
          </div>
          <p className="text-[13px] text-text-secondary leading-relaxed">
            {status.manual_only
              ? "OpenExpress quick-actions are bundled with the app."
              : status.installed
                ? "Right-click any supported image, video, audio, or PDF in your file manager to access OpenExpress tools. On Windows 11, check Show more options if it is not in the compact menu."
                : "Add an OpenExpress submenu to your file manager's right-click menu for quick access to every tool."}
          </p>
          {status.note && (
            <p className="text-[12px] text-text-muted mt-1.5 leading-snug">
              {status.note}
            </p>
          )}

          {!status.manual_only && (
            <Button
              variant={status.installed ? "secondary" : "primary"}
              onClick={toggle}
              disabled={busy}
              className="mt-4 inline-flex items-center gap-2"
            >
              {busy && <Loader2 size={13} className="animate-spin" />}
              {busy
                ? status.installed
                  ? "Removing..."
                  : "Installing..."
                : status.installed
                  ? "Remove from right-click menu"
                  : "Add to right-click menu"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
