import { AlertTriangle, Info, XCircle } from "lucide-react";
import { type AppError, presentationFor } from "../../lib/errors";

interface ErrorPanelProps {
  error: AppError;
}

const ICON_BY_SEVERITY = {
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
} as const;

const COLOR_BY_SEVERITY = {
  error: "var(--color-danger)",
  warning: "var(--color-warning)",
  info: "var(--color-text-secondary)",
} as const;

const TITLE_BY_SEVERITY = {
  error: "Error",
  warning: "Warning",
  info: "Note",
} as const;

export function ErrorPanel({ error }: ErrorPanelProps) {
  const { severity, hint } = presentationFor(error);
  const accent = COLOR_BY_SEVERITY[severity];
  const Icon = ICON_BY_SEVERITY[severity];

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
      <div className="flex items-center gap-2.5 mb-2">
        <Icon size={15} strokeWidth={2} style={{ color: accent }} />
        <span
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: "var(--color-text)",
          }}
        >
          {TITLE_BY_SEVERITY[severity]}
        </span>
      </div>

      <p
        style={{
          fontSize: 13,
          lineHeight: 1.55,
          color: "var(--color-text)",
          wordBreak: "break-word",
        }}
      >
        {error.message}
      </p>
      {hint && (
        <p
          className="mt-2"
          style={{
            fontSize: 12,
            lineHeight: 1.55,
            color: "var(--color-text-secondary)",
          }}
        >
          {hint}
        </p>
      )}
    </div>
  );
}
