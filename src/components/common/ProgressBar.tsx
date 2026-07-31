interface ProgressBarProps {
  percent: number;
  label?: string;
  onCancel?: () => void;
}

export function ProgressBar({ percent, label, onCancel }: ProgressBarProps) {
  const isIndeterminate = percent < 0;
  const clamped = Math.min(100, Math.max(0, percent));

  return (
    <div
      className="w-full animate-fade-in-up"
      style={{
        border: "1px solid var(--color-border)",
        padding: "16px 20px",
        background: "var(--color-bg-secondary)",
      }}
    >
      <div className="swiss-label mb-2">
        <span className="mr-2 font-mono">03</span>
        Processing
      </div>
      <div className="flex justify-between items-baseline mb-3">
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--color-text)",
          }}
        >
          {label ?? "Processing..."}
        </span>
        <span
          className="tabular-nums"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            color: "var(--color-text)",
          }}
        >
          {isIndeterminate ? "—" : `${Math.round(clamped)}%`}
        </span>
      </div>

      <div
        className="w-full relative"
        style={{ height: 2, background: "var(--color-border)" }}
      >
        {isIndeterminate ? (
          <div
            style={{
              position: "absolute",
              height: "100%",
              width: "30%",
              background: "var(--color-text)",
              animation: "shimmer 1.6s linear infinite",
            }}
          />
        ) : (
          <div
            style={{
              height: "100%",
              background: "var(--color-text)",
              width: `${clamped}%`,
              transition: "width 0.2s linear",
            }}
          />
        )}
      </div>

      {onCancel && (
        <div className="flex justify-end mt-3">
          <button
            onClick={onCancel}
            className="swiss-link"
            style={{ color: "var(--color-danger)", borderBottomColor: "var(--color-danger)" }}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
