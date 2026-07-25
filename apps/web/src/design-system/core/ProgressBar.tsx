import type { CSSProperties } from "react";
import { cn } from "../cn.ts";

export interface ProgressBarProps {
  value?: number;
  max?: number;
  tone?: "green" | "error" | "warning" | "info";
  /** Show a numeric percent readout on the right. */
  showLabel?: boolean;
  /** Accessible name. Progress needs one; a bare bar tells a screen reader nothing. */
  label?: string;
  className?: string;
  style?: CSSProperties;
}

const TONES = {
  green: "bg-accent shadow-[0_0_10px_color-mix(in_srgb,var(--rain-green)_60%,transparent)]",
  error: "bg-error shadow-[0_0_10px_color-mix(in_srgb,var(--error)_60%,transparent)]",
  warning: "bg-warning",
  info: "bg-info",
} as const;

/** Segmented phosphor progress track. */
export function ProgressBar({
  value = 0,
  max = 100,
  tone = "green",
  showLabel = false,
  label = "Progress",
  className,
  style,
}: ProgressBarProps) {
  const safeMax = max > 0 ? max : 100;
  const percent = Math.min(100, Math.max(0, (value / safeMax) * 100));

  return (
    <div className={cn("flex items-center gap-3", className)} style={style}>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuenow={Math.round(value)}
        aria-valuemin={0}
        aria-valuemax={safeMax}
        className="h-[6px] flex-1 overflow-hidden rounded-xs border border-line-faint bg-surface-1"
      >
        <div
          className={cn(
            "h-full transition-[width] duration-[var(--dur-med)] ease-[var(--ease-out)]",
            TONES[tone],
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
      {showLabel && (
        <span className="font-display text-2xs tracking-wide tabular-nums text-muted">
          {Math.round(percent)}%
        </span>
      )}
    </div>
  );
}
