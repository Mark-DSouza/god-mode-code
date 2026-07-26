import type { CSSProperties, ReactNode } from "react";
import { cn } from "../cn.ts";

export interface CountdownProps {
  /** The current count, shown huge. */
  count?: ReactNode;
  /** Small caption above the numeral. */
  label?: string;
  /** Pill tag, e.g. "Quotes". */
  tag?: string;
  /** Dimmed Passage preview under the numeral. */
  preview?: string;
  className?: string;
  style?: CSSProperties;
}

/**
 * The pre-run screen: an oversized CRT numeral over a dimmed preview of what is
 * coming.
 *
 * Presentational — something else drives `count` down. The line at the bottom
 * is the honest description of what happens next: the countdown gets you ready,
 * and the clock starts on the first keystroke rather than when the numeral runs
 * out. Nobody is charged for the quarter second between the two.
 */
export function Countdown({
  count = 3,
  label = "GET READY",
  tag,
  preview,
  className,
  style,
}: CountdownProps) {
  return (
    <div
      className={cn("flex flex-col items-center justify-center gap-2 text-center", className)}
      style={style}
    >
      {tag && (
        <span className="mb-2 rounded-pill border border-line-bright px-3 py-1 font-display text-2xs tracking-wide text-ink-2 uppercase">
          {tag}
        </span>
      )}

      {/* The numeral changes once a second and is the only thing on the screen
          worth announcing. `polite` rather than `assertive`: it is a rhythm, not
          an alert, and interrupting three times in three seconds is worse than
          saying nothing. */}
      <div className="font-display text-sm tracking-wider text-ink-2 uppercase">{label}</div>
      <div
        aria-live="polite"
        data-testid="countdown"
        className="font-stat text-[clamp(120px,22vw,200px)] leading-[0.8] text-rain-shine [text-shadow:0_0_40px_var(--rain-green),0_0_12px_#fff]"
      >
        {count}
      </div>

      {preview && (
        <p className="mt-1.5 max-w-[440px] font-code text-sm text-ink-3 opacity-85 blur-[0.3px]">
          {preview}
        </p>
      )}

      <p className="mt-5 font-code text-xs text-ink-3">start typing to begin the clock</p>
    </div>
  );
}
