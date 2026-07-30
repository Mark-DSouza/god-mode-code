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
   * Which value to light up. Defaults to the tallest bar, which is what the
   * shipped component does.
   *
   * Passed when the tallest bar is not the strongest Run: a Solve Run that
   * typed quickly and failed is a real reading and belongs in the shape, but
   * only Passed Solve Runs are ranked (CONTEXT.md), and emphasising one would
   * disagree with the Personal Best printed beside it. `null` lights nothing,
   * which is the honest answer when none of these Runs is one that counts.
   */
  emphasis?: number | null;
  /**
   * What the chart says to somebody who cannot see it.
   *
   * Optional, so the published prop contract still type-checks, but a caller
   * with anything to say should say it: the fallback can only repeat the
   * caption, and a caption is not a description of a shape.
   */
  "aria-label"?: string;
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
 * Emphasis is "equal to the emphasised value", not "the first bar that reaches
 * it". Two Runs at the same best are both the best, and picking one of them to
 * light up would be inventing a ranking between them.
 */
export function RunChart({
  values,
  label,
  peakLabel,
  height = 120,
  emphasis,
  "aria-label": ariaLabel,
  className,
  style,
}: RunChartProps) {
  // Never zero: it is a divisor, and an empty series must not render bars of
  // infinite height on the way to the empty state that should have been shown
  // instead.
  const tallest = Math.max(1, ...values);
  // Scaling and emphasis are two different questions. The tallest bar always
  // sets the scale — clipping a Run because it does not count would draw a
  // shape that did not happen — and this is only which bar is lit.
  const lit = emphasis === undefined ? tallest : emphasis;

  return (
    <div
      className={cn("rounded-md border border-line bg-surface-1 p-5", className)}
      style={style}
      role="img"
      aria-label={ariaLabel ?? [label, peakLabel].filter(Boolean).join(" · ")}
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
          const isPeak = value === lit;
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
              style={{ height: `${Math.round((value / tallest) * 100)}%` }}
            />
          );
        })}
      </div>
    </div>
  );
}
