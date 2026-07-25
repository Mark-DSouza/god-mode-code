import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { cn } from "../cn.ts";

export interface BadgeProps extends Omit<HTMLAttributes<HTMLSpanElement>, "children"> {
  tone?: "green" | "neutral" | "error" | "warning" | "info";
  /** Filled instead of outlined. */
  solid?: boolean;
  /** Prepend a glowing status dot. */
  dot?: boolean;
  children?: ReactNode;
  style?: CSSProperties;
}

const OUTLINE = {
  green: "text-accent border-[color-mix(in_srgb,var(--rain-green)_45%,transparent)]",
  neutral: "text-muted border-line",
  error: "text-error border-[color-mix(in_srgb,var(--error)_45%,transparent)]",
  warning: "text-warning border-[color-mix(in_srgb,var(--warning)_45%,transparent)]",
  info: "text-info border-[color-mix(in_srgb,var(--info)_45%,transparent)]",
} as const;

const SOLID = {
  green: "bg-accent text-invert border-accent",
  neutral: "bg-surface-3 text-body border-line",
  error: "bg-error text-void border-error",
  warning: "bg-warning text-void border-warning",
  info: "bg-info text-void border-info",
} as const;

const DOT = {
  green: "bg-accent",
  neutral: "bg-ink-2",
  error: "bg-error",
  warning: "bg-warning",
  info: "bg-info",
} as const;

/**
 * Small status/label chip.
 *
 * Seniority bands use the same green/amber/red ramp as everything else:
 * Junior green, Senior amber, Principal red.
 */
export function Badge({
  tone = "green",
  solid = false,
  dot = false,
  className,
  children,
  ...rest
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-pill border px-3 py-1",
        "font-display text-2xs tracking-wider uppercase",
        solid ? SOLID[tone] : OUTLINE[tone],
        className,
      )}
      {...rest}
    >
      {dot && (
        <span aria-hidden="true" className={cn("size-[6px] shrink-0 rounded-pill", DOT[tone])} />
      )}
      {children}
    </span>
  );
}
