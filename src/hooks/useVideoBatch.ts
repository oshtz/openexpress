import { useCallback, useRef } from "react";
import { Channel, invoke } from "@tauri-apps/api/core";
import { useBatch, type BatchItemResult } from "./useBatch";
import { toAppError } from "../lib/errors";

interface VideoBatchOptions {
  /** Tauri command name (e.g. `"trim_video"`). */
  command: string;
  /** Per-item arg builder. The wrapper adds `jobId` and `progress` automatically. */
  args: (inputPath: string) => Record<string, unknown>;
}

/**
 * Batch wrapper specialised for video commands. Each item gets a freshly
 * generated `jobId` and a no-op progress `Channel` (the per-item bar isn't
 * shown in batch mode — the aggregate counter is enough). Cancellation
 * kills the in-flight ffmpeg via `cancel_video_job` *and* stops the queue
 * from advancing.
 */
export interface VideoBatchHandle<R> {
  running: boolean;
  total: number;
  completed: number;
  current: string | null;
  results: BatchItemResult<string, R>[];
  cancelled: boolean;
  succeededCount: number;
  failedCount: number;
  start: (inputPaths: string[], opts: VideoBatchOptions) => Promise<void>;
  cancel: () => void;
  reset: () => void;
}

export function useVideoBatch<R>(): VideoBatchHandle<R> {
  const batch = useBatch<string, R>();
  const currentJobIdRef = useRef<string | null>(null);
  const innerCancel = batch.cancel;
  const innerStart = batch.start;

  const start = useCallback(
    (inputPaths: string[], opts: VideoBatchOptions) => {
      return innerStart(inputPaths, async (inputPath) => {
        const jobId = newJobId();
        currentJobIdRef.current = jobId;
        // Channel is required by the Rust signature; we don't display per-item
        // progress in batch mode, so this drains messages into the void.
        const channel = new Channel<number>();
        try {
          return await invoke<R>(opts.command, {
            jobId,
            progress: channel,
            ...opts.args(inputPath),
          });
        } catch (e) {
          throw toAppError(e);
        } finally {
          currentJobIdRef.current = null;
        }
      });
    },
    [innerStart],
  );

  const cancel = useCallback(() => {
    const jobId = currentJobIdRef.current;
    if (jobId) {
      // Best-effort: kill the running ffmpeg first so its kill propagates
      // through the iter loop before the queue advances.
      void invoke("cancel_video_job", { jobId }).catch(() => {
        // ignored — registry says the job is already done, or never started
      });
    }
    innerCancel();
  }, [innerCancel]);

  return {
    running: batch.running,
    total: batch.total,
    completed: batch.completed,
    current: batch.current,
    results: batch.results,
    cancelled: batch.cancelled,
    succeededCount: batch.succeededCount,
    failedCount: batch.failedCount,
    reset: batch.reset,
    start,
    cancel,
  };
}

function newJobId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
