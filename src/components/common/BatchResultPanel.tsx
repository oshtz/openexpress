import { useState } from "react";
import { CheckCircle, XCircle, ChevronDown, ChevronRight } from "lucide-react";
import { type AppError } from "../../lib/errors";
import { getFileName } from "../../lib/utils";

interface FailedItem {
  input: string;
  error: AppError;
}

interface BatchResultPanelProps {
  succeededCount: number;
  failedCount: number;
  failed: FailedItem[];
  cancelled: boolean;
}

/**
 * End-of-run summary for a batch. Always shows the success/failure tallies;
 * the failed-items list is collapsed by default and expandable inline so a
 * single bad file doesn't drown out a mostly-successful run.
 */
export function BatchResultPanel({
  succeededCount,
  failedCount,
  failed,
  cancelled,
}: BatchResultPanelProps) {
  const [expanded, setExpanded] = useState(failedCount > 0 && failedCount <= 3);

  const allSucceeded = failedCount === 0 && !cancelled;
  const accent = allSucceeded
    ? "var(--color-accent-gold)"
    : failedCount > 0
      ? "var(--color-danger)"
      : "var(--color-border)";

  return (
    <div
      className="animate-fade-in-up"
      style={{
        border: "1px solid var(--color-border)",
        borderLeft: `4px solid ${accent}`,
        background: "var(--color-bg-secondary)",
        padding: "20px 24px",
      }}
    >
      <div className="flex items-center gap-2.5 mb-1">
        {allSucceeded ? (
          <CheckCircle size={16} className="text-success-ink shrink-0" />
        ) : failedCount > 0 ? (
          <XCircle size={16} className="text-danger shrink-0" />
        ) : (
          <CheckCircle size={16} className="text-text-muted shrink-0" />
        )}
        <span className="font-semibold text-[14px] text-text">
          {cancelled
            ? `Cancelled · ${succeededCount} done, ${failedCount} failed`
            : allSucceeded
              ? `${succeededCount} file${succeededCount === 1 ? "" : "s"} processed`
              : `${succeededCount} succeeded, ${failedCount} failed`}
        </span>
      </div>

      {failed.length > 0 && (
        <div className="mt-3">
          <button
            onClick={() => setExpanded((e) => !e)}
            className="flex items-center gap-1 text-[12px] font-medium text-text-secondary hover:text-text transition-colors"
          >
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            {expanded ? "Hide failures" : `Show ${failed.length} failed`}
          </button>

          {expanded && (
            <ul className="mt-2 space-y-1.5 max-h-60 overflow-y-auto pr-2">
              {failed.map((f, i) => (
                <li key={i} className="text-[12px] leading-snug">
                  <span className="text-text font-medium break-all">
                    {getFileName(f.input)}
                  </span>
                  <span className="text-text-muted"> — {f.error.message}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
