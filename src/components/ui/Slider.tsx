import type { ComponentProps, ReactNode } from "react";
import { Label } from "./Label";

interface SliderProps extends Omit<ComponentProps<"input">, "type"> {
  /** Field caption rendered above the control. */
  label: string;
  /** Right-aligned value readout (e.g. "80%"). */
  displayValue?: ReactNode;
  /** Caption under the left end of the track (e.g. "Smaller file"). */
  minLabel?: string;
  /** Caption under the right end of the track (e.g. "Higher quality"). */
  maxLabel?: string;
}

/** Labeled Swiss range slider with value readout and end captions. */
export function Slider({
  label,
  displayValue,
  minLabel,
  maxLabel,
  className = "",
  ...rest
}: SliderProps) {
  return (
    <div className={className}>
      <div className="mb-2 flex items-center justify-between">
        <Label className="mb-0">{label}</Label>
        {displayValue !== undefined && (
          <span className="text-[13px] font-semibold tabular-nums text-text">{displayValue}</span>
        )}
      </div>
      <input type="range" className="h-1.5 w-full cursor-pointer accent-primary" {...rest} />
      {(minLabel || maxLabel) && (
        <div className="mt-1.5 flex justify-between text-[11px] text-text-muted">
          <span>{minLabel}</span>
          <span>{maxLabel}</span>
        </div>
      )}
    </div>
  );
}
