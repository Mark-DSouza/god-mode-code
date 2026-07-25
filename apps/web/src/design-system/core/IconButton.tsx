import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../cn.ts";

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: "sm" | "md" | "lg";
  variant?: "ghost" | "outline";
  /** Accessible label (also the tooltip title). Required — the icon is not text. */
  label: string;
  disabled?: boolean;
  /** The icon node. */
  children?: ReactNode;
}

const SIZES = {
  sm: "size-[var(--control-sm)]",
  md: "size-[var(--control-md)]",
  lg: "size-[var(--control-lg)]",
} as const;

const VARIANTS = {
  ghost:
    "border-transparent bg-transparent text-muted hover:not-disabled:bg-surface-2 hover:not-disabled:text-accent",
  outline: cn(
    "border-line bg-transparent text-body",
    "hover:not-disabled:border-accent hover:not-disabled:text-accent hover:not-disabled:shadow-glow",
  ),
} as const;

/** Square bare-icon control for toolbars and window chrome. */
export function IconButton({
  size = "md",
  variant = "ghost",
  label,
  disabled = false,
  className,
  type = "button",
  children,
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex cursor-pointer items-center justify-center rounded-sm border",
        "transition-[background,color,border-color,box-shadow,transform] duration-[var(--dur-fast)] ease-[var(--ease-out)]",
        "active:not-disabled:translate-y-px active:not-disabled:scale-[0.985]",
        "disabled:cursor-not-allowed disabled:opacity-40",
        SIZES[size],
        VARIANTS[variant],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
