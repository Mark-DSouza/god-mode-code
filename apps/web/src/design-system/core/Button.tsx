import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../cn.ts";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** primary = filled phosphor; secondary = outlined; ghost = bare; danger = red pill. */
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  /** Stretch to full width of the container. */
  block?: boolean;
  disabled?: boolean;
  children?: ReactNode;
}

const SIZES = {
  sm: "h-[var(--control-sm)] px-[14px] text-xs",
  md: "h-[var(--control-md)] px-5 text-sm",
  lg: "h-[var(--control-lg)] px-[30px] text-md",
} as const;

/**
 * Hover and press are CSS pseudo-classes, not React state.
 *
 * The shipped component tracks both in `useState` and merges the result into an
 * inline `style`. That re-renders on every mouse enter and leave, and — because
 * it never handles `:focus-visible` — a keyboard user gets no press or hover
 * affordance at all. `:active` and `:focus-visible` cost nothing and cover both
 * input methods.
 */
const VARIANTS = {
  primary: cn(
    "bg-accent text-invert border-accent",
    "shadow-[0_0_14px_color-mix(in_srgb,var(--rain-green)_40%,transparent)]",
    "hover:not-disabled:bg-rain-bright hover:not-disabled:border-rain-bright",
    "hover:not-disabled:shadow-[0_0_22px_color-mix(in_srgb,var(--rain-green)_60%,transparent)]",
  ),
  secondary: cn(
    "bg-transparent text-accent border-line-bright",
    "hover:not-disabled:bg-[color-mix(in_srgb,var(--rain-green)_12%,transparent)]",
    "hover:not-disabled:border-accent hover:not-disabled:text-rain-bright",
    "hover:not-disabled:shadow-glow",
  ),
  ghost: cn(
    "bg-transparent text-muted border-transparent",
    "hover:not-disabled:bg-surface-2 hover:not-disabled:text-accent",
  ),
  danger: cn(
    "bg-transparent text-error border-[color-mix(in_srgb,var(--error)_55%,transparent)]",
    "hover:not-disabled:bg-[color-mix(in_srgb,var(--error)_14%,transparent)]",
    "hover:not-disabled:border-error",
    "hover:not-disabled:[text-shadow:var(--glow-error)]",
  ),
} as const;

/**
 * Primary action control. Uppercased terminal type with wide tracking; the
 * primary variant glows green, danger glows red.
 */
export function Button({
  variant = "primary",
  size = "md",
  block = false,
  disabled = false,
  className,
  type = "button",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={cn(
        "inline-flex cursor-pointer items-center justify-center gap-[10px]",
        "rounded-sm border font-display tracking-wider whitespace-nowrap uppercase select-none",
        "transition-[background,color,box-shadow,border-color,transform] duration-[var(--dur-fast)] ease-[var(--ease-out)]",
        // A physical keypress: settles down and in, never bounces.
        "active:not-disabled:translate-y-px active:not-disabled:scale-[0.985]",
        "disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none",
        SIZES[size],
        VARIANTS[variant],
        block && "w-full",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
