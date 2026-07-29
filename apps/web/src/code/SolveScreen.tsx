import type { SolveChallenge, SolveRun } from "@gmc/api-client";
import { useEffect, useState } from "react";
import { JudgeUnavailable, useSubmitSolveRun } from "../api/patterns.ts";
import { RunRefused } from "../api/typing.ts";
import { Button, Card, CodeEditor, IconButton, Stat } from "../design-system/index.ts";
import { DesktopSuitsThisBetter } from "./DesktopSuitsThisBetter.tsx";
import { PatternTags } from "./PatternTags.tsx";
import { useSolveRun } from "./use-solve-run.ts";

/**
 * One Pattern, from reading the prompt to a Verdict.
 *
 * There is no countdown. A Typing Run opens with one because the player needs
 * their hands ready; here the first thing to do is read, and three seconds of
 * numerals in front of a prompt would be three seconds of nothing.
 */
export function SolveScreen({
  challenge,
  onJudged,
  onLeave,
}: {
  challenge: SolveChallenge;
  onJudged: (run: SolveRun) => void;
  onLeave: () => void;
}) {
  const pattern = challenge.pattern;
  const submit = useSubmitSolveRun();
  const run = useSolveRun(pattern.scaffold);

  // ADR-0003 asks the client to notice expiry before the work is wasted. The
  // window is twenty minutes of thinking time, so in practice this fires for a
  // tab that was left open rather than for anybody who was solving.
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    const remaining = Date.parse(challenge.expiresAt) - Date.now();
    const timer = setTimeout(() => setExpired(true), Math.max(0, remaining));
    return () => clearTimeout(timer);
  }, [challenge.expiresAt]);

  if (expired) {
    return (
      <Interruption
        heading="Challenge expired"
        detail="This Pattern was handed out too long ago to still be answerable."
        onLeave={onLeave}
      />
    );
  }

  if (submit.error instanceof RunRefused) {
    return (
      <Interruption
        heading="Solve Run not recorded"
        detail={submit.error.rejection.explanation}
        onLeave={onLeave}
      />
    );
  }

  return (
    <section className="flex flex-col gap-5" aria-label={`${pattern.name} Solve Run`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex gap-8">
          <Stat
            value={Math.floor(run.elapsedMillis / 1000)}
            unit="s"
            label="Time"
            size="sm"
            align="left"
            accent="white"
          />
          <Stat value={run.keystrokes} label="Keystrokes" size="sm" align="left" accent="info" />
        </div>
        <IconButton label="Abandon this Challenge" variant="outline" onClick={onLeave}>
          <span aria-hidden="true">✕</span>
        </IconButton>
      </div>

      <DesktopSuitsThisBetter />

      <Card className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-display text-lg tracking-wide text-heading">{pattern.name}</h1>
          <PatternTags pattern={pattern} />
        </div>
        {/* Paragraph by paragraph, because the prompt is written as prose and a
            single block of it is a wall nobody reads before the clock starts. */}
        {pattern.prompt.split("\n\n").map((paragraph) => (
          <p key={paragraph} className="font-body text-sm leading-snug text-ink-2">
            {paragraph}
          </p>
        ))}
      </Card>

      {/* Before starting, not after failing. These are the contract the Solve
          Run is judged against, and a player who has not seen them is guessing
          at what the function is supposed to return. */}
      <Card className="flex flex-col gap-3">
        <h2 className="font-display text-2xs tracking-wider text-muted uppercase">Example Tests</h2>
        <ul className="flex flex-col gap-2">
          {pattern.exampleTests.map((test) => (
            <li key={test.name} className="flex flex-col gap-1">
              <code className="font-code text-sm text-body">
                {test.call} <span className="text-accent">→</span> {test.expected}
              </code>
              <span className="font-body text-xs text-muted">{test.name}</span>
            </li>
          ))}
        </ul>
        <p className="font-body text-xs text-disabled">
          Hidden Tests are run too. You are told how many passed, never which.
        </p>
      </Card>

      <CodeEditor
        scaffold={pattern.scaffold}
        value={run.source}
        onChange={run.write}
        disabled={submit.isPending}
      />

      <p className="text-center font-code text-xs text-ink-3" role="status">
        {statusLine(submit.isPending, submit.error)}
      </p>

      <div className="flex flex-wrap justify-center gap-4">
        <Button
          size="lg"
          disabled={submit.isPending || run.source.trim().length === 0}
          onClick={() =>
            submit.mutate(
              { issueId: challenge.issueId, ...run.completed() },
              { onSuccess: onJudged },
            )
          }
        >
          {submit.isPending ? "Judging" : "Submit"}
        </Button>
      </div>
    </section>
  );
}

/**
 * What the line under the editor says.
 *
 * A judge that could not be reached is deliberately not an interruption screen:
 * nothing is wrong with what the player wrote, the Challenge is still theirs,
 * and the lines are still on screen to submit again.
 */
function statusLine(judging: boolean, error: Error | null): string {
  if (judging) return "running your code against the tests";
  if (error instanceof JudgeUnavailable) return `${error.message} try submitting again`;
  if (error) return "could not reach the backend — nothing was recorded";
  return "tab indents · escape then tab to leave the editor";
}

/** A Solve Run that stopped for a reason the player needs told, rather than a Verdict. */
function Interruption({
  heading,
  detail,
  onLeave,
}: {
  heading: string;
  detail: string;
  onLeave: () => void;
}) {
  return (
    <Card scanlines className="flex flex-col items-center gap-4 text-center" role="alert">
      <h2 className="font-display text-lg tracking-wide text-heading uppercase">{heading}</h2>
      <p className="max-w-[48ch] font-body text-sm text-muted">{detail}</p>
      <Button onClick={onLeave}>Pick another Pattern</Button>
    </Card>
  );
}
