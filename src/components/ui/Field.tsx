import type { ReactNode } from "react";
import { Label } from "./Label";

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
  return (
    <div className={className}>
      {value !== undefined ? (
        <div className="mb-1.5 flex items-center justify-between">
          <Label className="mb-0">{label}</Label>
          <span className="text-[13px] font-semibold tabular-nums text-text">{value}</span>
        </div>
      ) : (
        <Label className="mb-1.5">{label}</Label>
      )}
      {children}
    </div>
  );
}
