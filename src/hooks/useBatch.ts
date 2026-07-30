import { useCallback, useRef, useState } from "react";
import { type AppError, toAppError } from "../lib/errors";
import { useAppStore } from "../stores/appStore";
import { toolForRoute } from "../lib/tools";
import { getFileName } from "../lib/utils";

export interface BatchItemResult<I, R> {
  item: I;
  /** Set when the per-item task resolved. */
  result: R | null;
  /** Set when the per-item task threw. */
  error: AppError | null;
}

export interface BatchState<I, R> {
  /** True from `start()` until the queue finishes or is cancelled. */
  running: boolean;
  /** Total items in the queue (`0` before `start()` is called). */
  total: number;
  /** Number of items that have finished (success or error). */
  completed: number;
  /** Item currently being processed (null between items / when idle). */
  current: I | null;
  /** Per-item outcomes, in queue order. */
  results: BatchItemResult<I, R>[];
  /** True once the user has requested cancellation; queue stops between items. */
  cancelled: boolean;
}

export interface BatchHandle<I, R> extends BatchState<I, R> {
  start: (items: I[], run: (item: I) => Promise<R>) => Promise<void>;
  cancel: () => void;
  reset: () => void;
  /** Convenience: counts of succeeded / failed items. */
  succeededCount: number;
  failedCount: number;
}

/**
 * Sequential queue orchestrator with per-item error isolation.
 *
 * The queue runs items one at a time; a per-item failure is recorded but
 * does not abort the run. Cancellation takes effect at the next item
 * boundary — already-running work completes cleanly, and remaining items
 * are skipped.
 */
export function useBatch<I, R>(): BatchHandle<I, R> {
  const [state, setState] = useState<BatchState<I, R>>({
    running: false,
    total: 0,
    completed: 0,
    current: null,
    results: [],
    cancelled: false,
  });
  // Cancellation flag is held in a ref so the async loop can read the
  // freshest value without needing the closure to refresh on each render.
  const cancelledRef = useRef(false);
  const beginJob = useAppStore((s) => s.beginJob);
  const updateJob = useAppStore((s) => s.updateJob);
  const finishJob = useAppStore((s) => s.finishJob);

  const start = useCallback(
    async (items: I[], run: (item: I) => Promise<R>): Promise<void> => {
      const route = window.location.pathname;
      const jobId = newBatchJobId();
      const first = items[0];
      let failures = 0;
      let completedItems = 0;
      beginJob({
        id: jobId,
        tool: `${toolForRoute(route)?.label ?? "Batch"} batch`,
        route,
        inputName: typeof first === "string" ? getFileName(first) : undefined,
        startedAt: Date.now(),
        status: "running",
        total: items.length,
        completed: 0,
        failed: 0,
        progress: 0,
      });
      cancelledRef.current = false;
      setState({
        running: true,
        total: items.length,
        completed: 0,
        current: null,
        results: [],
        cancelled: false,
      });

      for (const item of items) {
        if (cancelledRef.current) break;
        setState((s) => ({ ...s, current: item }));

        let outcome: BatchItemResult<I, R>;
        try {
          const result = await run(item);
          outcome = { item, result, error: null };
        } catch (e) {
          outcome = { item, result: null, error: toAppError(e) };
          failures += 1;
        }

        const completed = completedItems + 1;
        updateJob(jobId, {
          completed,
          failed: failures,
          progress: items.length > 0 ? (completed / items.length) * 100 : 100,
        });
        completedItems = completed;
        setState((s) => ({
          ...s,
          completed: s.completed + 1,
          current: null,
          results: [...s.results, outcome],
        }));
      }

      setState((s) => ({ ...s, running: false, current: null }));
      finishJob(
        jobId,
        cancelledRef.current ? "cancelled" : failures > 0 ? "failed" : "succeeded",
        failures > 0 ? `${failures} item${failures === 1 ? "" : "s"} failed` : undefined,
      );
    },
    [beginJob, finishJob, updateJob],
  );

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    setState((s) => ({ ...s, cancelled: true }));
  }, []);

  const reset = useCallback(() => {
    cancelledRef.current = false;
    setState({
      running: false,
      total: 0,
      completed: 0,
      current: null,
      results: [],
      cancelled: false,
    });
  }, []);

  const succeededCount = state.results.filter((r) => r.error === null).length;
  const failedCount = state.results.length - succeededCount;

  return {
    ...state,
    start,
    cancel,
    reset,
    succeededCount,
    failedCount,
  };
}

function newBatchJobId(): string {
  return `batch-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
