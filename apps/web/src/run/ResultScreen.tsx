import type { TypingRun } from "@gmc/api-client";
import { Badge, Button, Card, ResultPanel } from "../design-system/index.ts";
import { DISCIPLINES } from "./disciplines.ts";

/**
 * What the Run was actually worth.
 *
 * Every figure here came back from the server, which recomputed it from the raw
 * data rather than believing anything the browser worked out while typing
 * (ADR-0003). The live readouts during the Run are the same arithmetic, so the
 * two agree — but this is the one that was recorded.
 */
export function ResultScreen({
  run,
  onRunAgain,
  onChangeDiscipline,
  pending,
  failed,
}: {
  run: TypingRun;
  onRunAgain: () => void;
  onChangeDiscipline: () => void;
  /** Whether the next Challenge is on its way, so "Run again" is not a dead button. */
  pending: boolean;
  failed: boolean;
}) {
  return (
    <section className="flex flex-col items-center gap-6" aria-label="Run result">
      <Badge tone="warning">Run logged</Badge>

      <ResultPanel
        className="w-full"
        wpm={Math.round(run.wpm)}
        accuracy={run.accuracy}
        // Whole seconds. A tenth of a second is below the resolution of the
        // thing being measured — a keystroke — and 31.2s reads as precision
        // that is not there.
        time={Math.round(run.elapsedMillis / 1000)}
        errors={run.errors}
      />

      <div className="flex flex-wrap justify-center gap-4">
        <Button size="lg" disabled={pending} onClick={onRunAgain}>
          {pending ? "Dealing you a Passage" : "Run again"}
        </Button>
        <Button size="lg" variant="secondary" onClick={onChangeDiscipline}>
          Change Discipline
        </Button>
      </div>

      {failed && (
        <Card role="alert" className="max-w-[48ch] text-center">
          <p className="font-body text-sm text-error">
            Could not get another Passage. The backend did not answer — try again.
          </p>
        </Card>
      )}

      <p className="font-code text-xs text-disabled">
        {DISCIPLINES[run.discipline].title} · verified by the server
      </p>
    </section>
  );
}
