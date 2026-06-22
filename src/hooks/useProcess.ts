import { useState, useCallback, useEffect, useRef } from "react";
import { invoke, Channel } from "@tauri-apps/api/core";
import { useAppStore } from "../stores/appStore";
import { type AppError, presentationFor, toAppError } from "../lib/errors";

interface ProcessState<T> {
  loading: boolean;
  error: AppError | null;
  result: T | null;
  /** 0–100 percent for tracked commands, `null` otherwise. */
  progress: number | null;
  run: (command: string, args?: Record<string, unknown>) => Promise<T | null>;
  reset: () => void;
  /**
   * Cancels the most-recent in-flight run, if any. Returns true when the
   * cancel command was successfully invoked, false otherwise (e.g. no
   * cancelCommand configured, or no active job).
   */
  cancel: () => Promise<boolean>;
}

interface ProcessOptions {
  /** Display name for the tool; used when recording recent files. */
  tool?: string;
  /**
   * When true, attaches a Tauri progress Channel under `args.progress` and
   * a generated `jobId` under `args.jobId`, so the Rust command can stream
   * progress and the cancel command can target the right job.
   */
  trackProgress?: boolean;
  /**
   * Tauri command name to invoke when cancel is requested. The command
   * receives the same `jobId` that was passed to `run`. Requires
   * `trackProgress: true` to make sense (the job ID needs to exist).
   */
  cancelCommand?: string;
}

function basename(path: string): string {
  const i = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return i >= 0 ? path.slice(i + 1) : path;
}

function newJobId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function useProcess<T>(options?: ProcessOptions): ProcessState<T> {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<AppError | null>(null);
  const [result, setResult] = useState<T | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const pushToast = useAppStore((s) => s.pushToast);
  const addRecentFile = useAppStore((s) => s.addRecentFile);
  const tool = options?.tool;
  const trackProgress = options?.trackProgress ?? false;
  const cancelCommand = options?.cancelCommand;

  // The current run's job ID, so cancel() can target the in-flight call.
  const jobIdRef = useRef<string | null>(null);

  const run = useCallback(
    async (command: string, args?: Record<string, unknown>): Promise<T | null> => {
      setLoading(true);
      setError(null);
      setResult(null);
      setProgress(trackProgress ? 0 : null);

      let finalArgs = args ?? {};
      if (trackProgress) {
        const channel = new Channel<number>();
        channel.onmessage = (pct) => setProgress(pct);
        const jobId = newJobId();
        jobIdRef.current = jobId;
        finalArgs = { ...finalArgs, progress: channel, jobId };
      }

      try {
        const res = await invoke<T>(command, finalArgs);
        setResult(res);
        const outputPath = (res as { output_path?: unknown })?.output_path;
        if (tool && typeof outputPath === "string" && outputPath.length > 0) {
          addRecentFile({
            path: outputPath,
            name: basename(outputPath),
            tool,
            timestamp: Date.now(),
          });
        }
        return res;
      } catch (rawErr) {
        const appErr = toAppError(rawErr);
        setError(appErr);
        const presentation = presentationFor(appErr);
        if (!presentation.silent) {
          pushToast(
            presentation.severity === "error" ? "error" : "info",
            appErr.message,
          );
        }
        return null;
      } finally {
        setLoading(false);
        jobIdRef.current = null;
      }
    },
    [pushToast, addRecentFile, tool, trackProgress],
  );

  const reset = useCallback(() => {
    setLoading(false);
    setError(null);
    setResult(null);
    setProgress(null);
  }, []);

  const cancel = useCallback(async (): Promise<boolean> => {
    const jobId = jobIdRef.current;
    if (!cancelCommand || !jobId) return false;
    try {
      await invoke(cancelCommand, { jobId });
      return true;
    } catch {
      return false;
    }
  }, [cancelCommand]);

  // Esc resets the tool's last result; ignored when focus is inside text input.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const target = e.target as HTMLElement | null;
      if (target?.matches?.("input, textarea, [contenteditable=true]")) return;
      reset();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [reset]);

  return { loading, error, result, progress, run, reset, cancel };
}
