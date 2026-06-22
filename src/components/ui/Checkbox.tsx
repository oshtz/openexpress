import type { ComponentProps, ReactNode } from "react";

interface CheckboxProps extends Omit<ComponentProps<"input">, "type"> {
  label: ReactNode;
}

/** Labeled Swiss checkbox row. */
export function Checkbox({ label, className = "", ...rest }: CheckboxProps) {
  return (
    <label className={`group flex cursor-pointer items-center gap-2.5 text-[13px] text-text ${className}`}>
      <input
        type="checkbox"
        className="h-4 w-4 cursor-pointer border-border accent-primary"
        {...rest}
      />
      <span className="transition-colors group-hover:text-primary">{label}</span>
    </label>
  );
}
