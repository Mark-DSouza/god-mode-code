import type { Discipline } from "@gmc/api-client";
import { Card, Stat } from "../design-system/index.ts";
import { DISCIPLINES } from "../run/disciplines.ts";

/**
 * The announcement a result screen makes when the Run it is showing beat every
 * earlier one in its Discipline.
 *
 * Owned here rather than by either result screen because a Personal Best is one
 * concept and there are two screens that announce it — a Typing Run's and a
 * Solve Run's. The Runs stay separate aggregates (ADR-0006); the thing being
 * announced about them does not.
 *
 * `role="status"` so it is read out when it appears. It is the reward, and a
 * reward that only exists as a colour and an arrow is no reward for anybody
 * using a screen reader.
 */
export function PersonalBestCallout({
  wpm,
  previousBestWpm,
  discipline,
}: {
  wpm: number;
  /** The best this Run beat. Absent when it was the first Run in the Discipline. */
  previousBestWpm: number | null | undefined;
  discipline: Discipline;
}) {
  const previous = previousBestWpm ?? null;
  // Rounded before subtracting, so the delta is the difference between the two
  // numbers on the screen. Subtracting first and rounding after can show +4
  // between a displayed 118 and a displayed 123.
  const improvement = previous === null ? null : Math.round(wpm) - Math.round(previous);

  return (
    <Card glow role="status" className="w-full">
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-center sm:flex-nowrap sm:text-left">
        {improvement !== null && (
          <Stat
            value={`↑ ${improvement}`}
            accent="warning"
            size="md"
            // The unit says what the arrow cannot: an arrow and an amber
            // numeral are two ways of saying the same thing, and neither says
            // "words per minute".
            unit="wpm"
          />
        )}

        <div className="flex min-w-0 flex-col gap-1">
          <p className="font-display text-sm tracking-wide text-ink-max uppercase [text-shadow:var(--glow-sm)]">
            Fastest Run yet · {DISCIPLINES[discipline].title}
          </p>
          <p className="font-body text-sm text-muted">
            {previous === null
              ? "Your first Run in this Discipline. Everything after this is measured against it."
              : `Previous best ${Math.round(previous)} wpm.`}
          </p>
        </div>
      </div>
    </Card>
  );
}
