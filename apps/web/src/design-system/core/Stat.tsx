import type { CSSProperties, ReactNode } from "react";
import { cn } from "../cn.ts";

export interface StatProps {
  value: ReactNode;
  /** Trailing unit, e.g. "wpm" or "%". */
  unit?: string;
  /** Small uppercased caption below. */
  label?: string;
  accent?: "green" | "white" | "error" | "warning" | "info";
  size?: "sm" | "md" | "lg";
  align?: "center" | "left";
  className?: string;
  style?: CSSProperties;
}

const ACCENTS = {
  green: "text-accent [text-shadow:var(--glow-md)]",
  white: "text-ink-max [text-shadow:var(--glow-shine)]",
  error: "text-error [text-shadow:var(--glow-error)]",
  warning: "text-warning",
  info: "text-info",
} as const;

const SIZES = {
  sm: "text-2xl",
  md: "text-3xl",
  lg: "text-5xl",
} as const;

/**
 * Oversized CRT numeral readout for WPM / accuracy / streaks.
 *
 * The numerals are the reward, so they are the largest thing on the screen.
 */
export function Stat({
  value,
  unit,
  label,
  accent = "green",
  size = "md",
  align = "center",
  className,
  style,
}: StatProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1",
        align === "center" ? "items-center" : "items-start",
        className,
      )}
      style={style}
    >
      <div
        className={cn(
          "flex items-baseline gap-2 font-stat leading-tight",
          SIZES[size],
          ACCENTS[accent],
        )}
      >
        <span>{value}</span>
        {unit && <span className="font-display text-sm tracking-wide opacity-70">{unit}</span>}
      </div>
      {label && (
        <span className="font-display text-2xs tracking-wider text-muted uppercase">{label}</span>
      )}
    </div>
  );
}
