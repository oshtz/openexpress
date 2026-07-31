import type { ComponentProps } from "react";

type Variant = "primary" | "secondary" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-primary text-primary-light hover:bg-primary-hover",
  secondary: "bg-bg-secondary text-text border border-border hover:border-text",
  danger: "bg-danger text-white hover:bg-danger/90",
};

const DISABLED = "bg-bg-tertiary text-text-muted cursor-not-allowed";

interface ButtonProps extends ComponentProps<"button"> {
  variant?: Variant;
  fullWidth?: boolean;
}

/** Swiss action button — ink fill, flat, zero radius, typographic uppercase.
 *  Primary actions carry the genome's rotated-arrow mark (hidden while
 *  disabled, so loading labels read clean). */
export function Button({
  variant = "primary",
  fullWidth = false,
  disabled,
  className = "",
  type = "button",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={`${fullWidth ? "w-full " : ""}press-feedback inline-flex items-center justify-center gap-2 px-4 py-2.5 text-[12px] font-bold uppercase ${
        disabled ? DISABLED : VARIANTS[variant]
      } ${className}`}
      {...rest}
    >
      {children}
      {variant === "primary" && !disabled && (
        <span aria-hidden className="inline-block -rotate-45 text-[14px] leading-none">
          →
        </span>
      )}
    </button>
  );
}
