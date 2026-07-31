import { useState, useCallback, useEffect, useRef } from "react";
import { invoke, Channel } from "@tauri-apps/api/core";
import { useAppStore } from "../stores/appStore";
import { type AppError, presentationFor, toAppError } from "../lib/errors";
import { allowAssetPaths } from "../lib/assets";
import { toolForRoute } from "../lib/tools";

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
  const beginJob = useAppStore((s) => s.beginJob);
  const updateJob = useAppStore((s) => s.updateJob);
  const finishJob = useAppStore((s) => s.finishJob);
  const tool = options?.tool;
  const trackProgress = options?.trackProgress ?? false;
  const cancelCommand = options?.cancelCommand;

  // The current run's job ID, so cancel() can target the in-flight call.
  const jobIdRef = useRef<string | null>(null);

  const run = useCallback(
    async (command: string, args?: Record<string, unknown>): Promise<T | null> => {
      const jobId = newJobId();
      const route = window.location.pathname;
      const inputPath =
        typeof args?.inputPath === "string"
          ? args.inputPath
          : Array.isArray(args?.inputPaths) && args.inputPaths.length === 1
            ? String(args.inputPaths[0])
            : undefined;
      beginJob({
        id: jobId,
        tool: tool ?? toolForRoute(route)?.label ?? command,
        route,
        inputName: inputPath ? basename(inputPath) : undefined,
        startedAt: Date.now(),
        status: "running",
        total: 1,
        completed: 0,
        failed: 0,
        progress: trackProgress ? 0 : null,
      });
      setLoading(true);
      setError(null);
      setResult(null);
      setProgress(trackProgress ? 0 : null);

      let finalArgs = args ?? {};
      if (trackProgress) {
        const channel = new Channel<number>();
        channel.onmessage = (pct) => {
          setProgress(pct);
          updateJob(jobId, { progress: pct });
        };
        jobIdRef.current = jobId;
        finalArgs = { ...finalArgs, progress: channel, jobId };
      }

      try {
        const res = await invoke<T>(command, finalArgs);
        const output = res as { output_path?: unknown; output_paths?: unknown };
        const outputPaths = [
          ...(typeof output.output_path === "string" ? [output.output_path] : []),
          ...(Array.isArray(output.output_paths)
            ? output.output_paths.filter((path): path is string => typeof path === "string")
            : []),
        ];
        await allowAssetPaths(outputPaths).catch(() => {});
        setResult(res);
        const outputPath = outputPaths[0];
        if (tool && typeof outputPath === "string" && outputPath.length > 0) {
          addRecentFile({
            path: outputPath,
            name: basename(outputPath),
            tool,
            timestamp: Date.now(),
            route,
            sourcePath: inputPath,
          });
        }
        updateJob(jobId, { completed: 1, outputPath });
        finishJob(jobId, "succeeded");
        return res;
      } catch (rawErr) {
        const appErr = toAppError(rawErr);
        updateJob(jobId, { completed: 1, failed: 1 });
        finishJob(
          jobId,
          appErr.kind === "Cancelled" ? "cancelled" : "failed",
          appErr.message,
        );
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
    [
      pushToast,
      addRecentFile,
      beginJob,
      updateJob,
      finishJob,
      tool,
      trackProgress,
    ],
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
