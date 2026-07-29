import type { CSSProperties } from "react";
import { cn } from "../cn.ts";

export interface RunChartProps {
  /** Series of Run values, oldest first — WPM per Run. */
  values: number[];
  /** Uppercased caption, e.g. "Last 14 Runs · WPM". */
  label?: string;
  /** Right-aligned note, e.g. "peak 148". */
  peakLabel?: string;
  height?: number;
  /**
   * What the chart says to somebody who cannot see it. Required, because a bar
   * chart with no text alternative is a decorative rectangle to a screen reader
   * and this one is the whole point of the screen.
   */
  "aria-label": string;
  className?: string;
  style?: CSSProperties;
}

/**
 * A phosphor bar chart of recent Runs. The strongest bar glows; the rest sit
 * dimmed.
 *
 * <h2>One image, not fourteen numbers</h2>
 *
 * `role="img"` with a summary rather than a list of bars. Read out one at a
 * time, fourteen unlabelled figures are noise — the shape is the information,
 * and the shape is what the summary states. Every figure the chart draws is
 * also on the screen around it: the peak is the all-time best, the mean is the
 * recent average.
 *
 * <h2>Ties glow together</h2>
 *
 * Emphasis is "equal to the peak", not "the first one that reaches it". Two
 * Runs at the same best are both the best, and picking one of them to light up
 * would be inventing a ranking between them.
 */
export function RunChart({
  values,
  label,
  peakLabel,
  height = 120,
  "aria-label": ariaLabel,
  className,
  style,
}: RunChartProps) {
  // Never zero: it is a divisor, and an empty series must not render bars of
  // infinite height on the way to the empty state that should have been shown
  // instead.
  const peak = Math.max(1, ...values);

  return (
    <div
      className={cn("rounded-md border border-line bg-surface-1 p-5", className)}
      style={style}
      role="img"
      aria-label={ariaLabel}
    >
      {(label || peakLabel) && (
        <div className="mb-4 flex items-baseline justify-between gap-3">
          {label && (
            <span className="font-display text-2xs tracking-wide text-muted uppercase">
              {label}
            </span>
          )}
          {peakLabel && <span className="font-code text-xs text-disabled">{peakLabel}</span>}
        </div>
      )}

      <div className="flex items-end gap-2" style={{ height }} aria-hidden="true">
        {values.map((value, index) => {
          const isPeak = value === peak;
          return (
            <div
              // The series is a list of readings with no identity of their own —
              // two Runs at 118 WPM are not the same Run, and nothing here is
              // reordered or removed, so the position is the identity.
              key={index}
              title={String(value)}
              className={cn(
                "flex-1 rounded-t-[2px] transition-[height] duration-[var(--dur-med)] ease-[var(--ease-out)]",
                isPeak
                  ? "bg-rain-green shadow-[var(--glow-sm)]"
                  : "bg-[color-mix(in_srgb,var(--rain-green)_42%,var(--surface-3))]",
              )}
              style={{ height: `${Math.round((value / peak) * 100)}%` }}
            />
          );
        })}
      </div>
    </div>
  );
}
