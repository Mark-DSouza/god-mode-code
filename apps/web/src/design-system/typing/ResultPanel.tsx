import type { CSSProperties, ReactNode } from "react";
import { Card } from "../core/Card.tsx";
import { Stat } from "../core/Stat.tsx";
import { cn } from "../cn.ts";

export interface ResultPanelProps {
  wpm: ReactNode;
  accuracy: number;
  time: ReactNode;
  errors: number;
  /** Headline, e.g. "RUN COMPLETE". */
  verdict?: string;
  isBest?: boolean;
  className?: string;
  style?: CSSProperties;
}

/**
 * The end-of-run summary: four CRT readouts under a headline.
 *
 * The numerals are the reward, so they are the largest thing on the screen and
 * they are the server's numbers — every figure here was recomputed from raw
 * data rather than reported by the browser that produced it (ADR-0003).
 *
 * Accuracy and errors change colour with how they went. The colour is a second
 * reading of a number that is already there in words, so nothing is carried by
 * hue alone.
 */
export function ResultPanel({
  wpm,
  accuracy,
  time,
  errors,
  verdict = "RUN COMPLETE",
  isBest = false,
  className,
  style,
}: ResultPanelProps) {
  return (
    <Card glow scanlines padding="var(--space-6)" className={className} style={style}>
      <div className="mb-5 flex items-center gap-3">
        <h2 className="font-display text-xl tracking-wide text-ink-max uppercase [text-shadow:var(--glow-sm)]">
          {verdict}
        </h2>
        {isBest && (
          <span
            className={cn(
              "rounded-pill border px-2 py-[3px] font-display text-2xs tracking-wider uppercase",
              "border-[color-mix(in_srgb,var(--warning)_45%,transparent)] text-warning",
            )}
          >
            New Best
          </span>
        )}
      </div>

      {/* Two up on a phone, four across from `sm`. The mockup's four-column grid
          puts a three-digit CRT numeral in 80px at 320px wide, where it wraps
          mid-figure. */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat value={wpm} unit="wpm" label="Speed" size="md" />
        <Stat
          value={accuracy}
          unit="%"
          label="Accuracy"
          size="md"
          accent={accuracy >= 97 ? "green" : accuracy >= 90 ? "warning" : "error"}
        />
        <Stat value={time} unit="s" label="Time" size="md" accent="white" />
        <Stat value={errors} label="Errors" size="md" accent={errors === 0 ? "green" : "error"} />
      </div>
    </Card>
  );
}
