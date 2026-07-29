import type { CSSProperties } from "react";
import { Card } from "../core/Card.tsx";
import { Stat } from "../core/Stat.tsx";
import { cn } from "../cn.ts";

export type SolveVerdict = "passed" | "failed" | "timeout" | "error";

export interface SolveResultPanelProps {
  verdict: SolveVerdict;
  testsPassed: number;
  testsTotal: number;
  /** Whole seconds. */
  time: number;
  wpm: number;
  className?: string;
  style?: CSSProperties;
}

/**
 * The end of a Solve Run: the Verdict, then three readouts under it.
 *
 * A distinct variant rather than a configuration of the Typing Run's panel, and
 * the difference is not cosmetic. That panel shows four figures, two of which
 * are Accuracy and errors — and a Solve Run has neither, because there is no
 * target text to be accurate against (ADR-0006). Rendering them as empty cells
 * would be inventing a measurement; hiding them inside a `variant` prop would
 * put both shapes in one component and let a future edit reintroduce them.
 *
 * The Verdict is the hero because it is the result. WPM is here and it is small,
 * which is the honest weight: a Solve Run that types fast and fails is a Solve
 * Run that failed.
 */
export function SolveResultPanel({
  verdict,
  testsPassed,
  testsTotal,
  time,
  wpm,
  className,
  style,
}: SolveResultPanelProps) {
  const headline = HEADLINES[verdict];

  return (
    <Card glow scanlines padding="var(--space-6)" className={className} style={style}>
      <div className="mb-6 flex flex-col items-center gap-2 text-center">
        <h2
          className={cn(
            "font-display text-4xl tracking-wide uppercase sm:text-5xl",
            headline.className,
          )}
        >
          {headline.text}
        </h2>
        {/* The sentence carries what the colour carries, so nothing is said by
            hue alone. */}
        <p className="font-body text-sm text-muted">{headline.detail}</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Stat
          value={`${testsPassed}/${testsTotal}`}
          label="Tests"
          size="md"
          accent={testsPassed === testsTotal ? "green" : "error"}
        />
        <Stat value={time} unit="s" label="Time" size="md" accent="white" />
        {/* Secondary, and shown as such: a Solve Run is ranked by Verdict and
            duration, and this is a reading rather than the score. */}
        <Stat value={Math.round(wpm)} unit="wpm" label="Speed" size="md" accent="info" />
      </div>
    </Card>
  );
}

/**
 * Four Verdicts, four things that actually happened.
 *
 * Timeout and Error are kept apart because they tell a player different things
 * to do: one means the code ran and was too slow, the other means it never
 * really ran at all.
 */
const HEADLINES: Record<SolveVerdict, { text: string; detail: string; className: string }> = {
  passed: {
    text: "Passed",
    detail: "Every test satisfied.",
    className: "text-accent [text-shadow:var(--glow-md)]",
  },
  failed: {
    text: "Failed",
    detail: "It ran, and not every test was satisfied.",
    className: "text-error [text-shadow:var(--glow-error)]",
  },
  timeout: {
    text: "Timeout",
    detail: "It was still running when the judge stopped it.",
    className: "text-warning",
  },
  error: {
    text: "Error",
    detail: "It never got as far as being wrong.",
    className: "text-warning",
  },
};
