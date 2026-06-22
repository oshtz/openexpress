import type { ComponentProps } from "react";

/** Swiss select — hairline border that inks on focus. */
export function Select({ className = "", children, ...rest }: ComponentProps<"select">) {
  return (
    <select
      className={`w-full cursor-pointer border border-border bg-bg-secondary px-3 py-2.5 text-[13px] text-text focus:border-text focus:outline-none transition-colors ${className}`}
      {...rest}
    >
      {children}
    </select>
  );
}
