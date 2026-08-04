import type { SolveRun } from "@gmc/api-client";
import { SignInPrompt } from "../auth/SignInPrompt.tsx";
import { Badge, Button, Card, SolveResultPanel } from "../design-system/index.ts";
import { PersonalBestCallout } from "../profile/PersonalBestCallout.tsx";

/**
 * What the Solve Run was worth.
 *
 * A different screen from the Typing Run's result, not a variant of it. The
 * Verdict is the hero because the Verdict is the result; tests, duration and
 * WPM sit beneath it as a three-up. Accuracy and errors are not here and are not
 * blank either — a Solve Run has no target text to be accurate against, and
 * rendering an empty cell where a Typing Run has a number would be inventing a
 * measurement (ADR-0006).
 */
export function SolveResultScreen({
  run,
  onSolveAgain,
  onPickAnother,
  onSignIn,
  pending,
  failed,
}: {
  run: SolveRun;
  onSolveAgain: () => void;
  onPickAnother: () => void;
  onSignIn: () => void;
  /** Whether the next Challenge is on its way, so "Try again" is not a dead button. */
  pending: boolean;
  failed: boolean;
}) {
  return (
    <section className="flex flex-col items-center gap-6" aria-label="Solve Run result">
      <Badge tone="warning" dot={run.personalBest}>
        {run.personalBest ? "New Personal Best" : "Solve Run logged"}
      </Badge>

      <SolveResultPanel
        className="w-full"
        verdict={run.verdict}
        testsPassed={run.testsPassed}
        testsTotal={run.testsTotal}
        // Whole seconds. A tenth of a second is below the resolution of what is
        // being measured, which is somebody thinking.
        time={Math.round(run.elapsedMillis / 1000)}
        wpm={Number(run.wpm)}
      />

      {/* Only a Passed Solve Run ever gets here: a program that does not work is
          not a best at anything, and the server is the one that decides it. */}
      {run.personalBest && (
        <PersonalBestCallout
          wpm={run.wpm}
          previousBestWpm={run.previousBestWpm}
          discipline="CODE"
        />
      )}

      <div className="flex flex-wrap justify-center gap-4">
        <Button size="lg" disabled={pending} onClick={onSolveAgain}>
          {pending ? "Dealing you a Pattern" : "Try this Pattern again"}
        </Button>
        <Button size="lg" variant="secondary" onClick={onPickAnother}>
          Pick another Pattern
        </Button>
      </div>

      {failed && (
        <Card role="alert" className="max-w-[48ch] text-center">
          <p className="font-body text-sm text-error">
            Could not get that Pattern again. The backend did not answer — try again.
          </p>
        </Card>
      )}

      <p className="font-code text-xs text-disabled">
        Code · judged by executing your code against the tests
      </p>

      {/* Last, not first: the invitation to sign in follows a Run worth
          keeping rather than fighting the result for attention (ADR-0011). */}
      <SignInPrompt onSignIn={onSignIn} />
    </section>
  );
}
