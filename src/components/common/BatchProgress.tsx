import { getFileName } from "../../lib/utils";

interface BatchProgressProps {
  total: number;
  completed: number;
  failed: number;
  current: string | null;
  onCancel?: () => void;
  cancelling?: boolean;
}

/**
 * Aggregate progress UI for a sequential batch. Shows "X of N" with a
 * proportional bar, the currently-processing filename, and a soft red
 * count of any failures so far.
 */
export function BatchProgress({
  total,
  completed,
  failed,
  current,
  onCancel,
  cancelling = false,
}: BatchProgressProps) {
  const percent = total > 0 ? (completed / total) * 100 : 0;

  return (
    <div
      className="w-full animate-fade-in-up"
      style={{
        border: "1px solid var(--color-border)",
        padding: "16px 20px",
        background: "var(--color-bg-secondary)",
      }}
    >
      <div className="flex justify-between items-baseline mb-3">
        <div className="flex items-center gap-2">
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--color-text)",
            }}
          >
            {cancelling
              ? "Cancelling…"
              : completed === total
                ? "Done"
                : current
                  ? `Processing ${getFileName(current)}`
                  : "Preparing…"}
          </span>
          {failed > 0 && (
            <span
              className="swiss-label px-1.5 py-0.5 bg-danger-light"
              style={{ color: "var(--color-danger)" }}
            >
              {failed} failed
            </span>
          )}
        </div>
        <span
          className="tabular-nums"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            color: "var(--color-text)",
          }}
        >
          {completed} / {total}
        </span>
      </div>

      <div
        className="w-full"
        style={{ height: 2, background: "var(--color-border)" }}
      >
        <div
          style={{
            height: "100%",
            background: "var(--color-text)",
            width: `${percent}%`,
            transition: "width 0.2s linear",
          }}
        />
      </div>

      {onCancel && completed < total && !cancelling && (
        <div className="flex justify-end mt-3">
          <button
            onClick={onCancel}
            className="swiss-link"
            style={{ color: "var(--color-danger)", borderBottomColor: "var(--color-danger)" }}
          >
            Cancel remaining
          </button>
        </div>
      )}
    </div>
  );
}
