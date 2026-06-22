import type { ComponentProps } from "react";

/** Swiss text/number input — hairline border that inks on focus. */
export function Input({ className = "", ...rest }: ComponentProps<"input">) {
  return (
    <input
      className={`w-full border border-border bg-bg-secondary px-3 py-2.5 text-[13px] text-text placeholder:text-text-muted focus:border-text focus:outline-none transition-colors ${className}`}
      {...rest}
    />
  );
}
