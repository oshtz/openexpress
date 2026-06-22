import type { ComponentProps } from "react";

/** Swiss form label — small, medium weight, dim ink. */
export function Label({ className = "", children, ...rest }: ComponentProps<"label">) {
  return (
    <label
      className={`block text-[13px] font-medium text-text-secondary ${className}`}
      {...rest}
    >
      {children}
    </label>
  );
}
