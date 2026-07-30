import { cloneElement, isValidElement, useId, type ReactNode } from "react";

interface FieldProps {
  /** Field caption rendered above the control. */
  label: string;
  /** Optional right-aligned value readout (e.g. "80%"). */
  value?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Label + control wrapper — the standard tool-settings form row. */
export function Field({ label, value, children, className = "" }: FieldProps) {
  const labelId = useId();
  const control = isValidElement<{ "aria-labelledby"?: string }>(children)
    ? cloneElement(children, {
        "aria-labelledby": children.props["aria-labelledby"] ?? labelId,
      })
    : children;

  return (
    <div className={className} role="group" aria-labelledby={labelId}>
      {value !== undefined ? (
        <div className="mb-1.5 flex items-center justify-between">
          <span id={labelId} className="text-[13px] font-medium text-text-secondary">
            {label}
          </span>
          <span className="text-[13px] font-semibold tabular-nums text-text">{value}</span>
        </div>
      ) : (
        <span
          id={labelId}
          className="mb-1.5 block text-[13px] font-medium text-text-secondary"
        >
          {label}
        </span>
      )}
      {control}
    </div>
  );
}
