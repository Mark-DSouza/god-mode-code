import type { Challenge, TypingRun } from "@gmc/api-client";
import { useEffect, useRef, useState } from "react";
import { RunRefused, useSubmitTypingRun } from "../api/typing.ts";
import {
  Button,
  Card,
  Countdown,
  IconButton,
  ProgressBar,
  Stat,
  TypingField,
} from "../design-system/index.ts";
import { DISCIPLINES } from "./disciplines.ts";
import { useTypingRun } from "./use-typing-run.ts";

/** Enough of the Passage to know what is coming, without giving it away to read ahead. */
const PREVIEW_CHARACTERS = 90;

/**
 * One Run, from the countdown to the verified result.
 *
 * <h2>The hidden input</h2>
 *
 * Every keystroke arrives at a real `<input>` that covers the typing surface at
 * zero opacity, with {@link TypingField} rendering above it (ADR-0010,
 * deviation 2). It is genuinely focused rather than visually hidden and
 * pretend: `display: none` and `visibility: hidden` are both unfocusable, and a
 * focusable `<div>` does not raise the on-screen keyboard on iOS or Android at
 * all — so the mobile Run screen the mockups design for would be unplayable.
 *
 * Covering the surface rather than sitting off-screen is what makes tapping the
 * Passage put the keyboard up, which is the gesture a phone user will make.
 */
export function RunScreen({
  challenge,
  onRecorded,
  onLeave,
}: {
  challenge: Challenge;
  onRecorded: (run: TypingRun) => void;
  onLeave: () => void;
}) {
  const passage = challenge.passage;
  const submit = useSubmitTypingRun();
  const input = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);

  const run = useTypingRun({
    text: passage.text,
    onComplete: (completed) =>
      submit.mutate({ issueId: challenge.issueId, ...completed }, { onSuccess: onRecorded }),
  });

  // ADR-0003 asks the client to notice expiry *before* the player starts
  // typing: refusing a submission after four minutes of work is a bug report,
  // not a security control. The window is scaled so that it cannot run out
  // mid-Run, so in practice this fires for a tab left open on the countdown.
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    if (run.phase === "complete") return;
    const remaining = Date.parse(challenge.expiresAt) - Date.now();
    const timer = setTimeout(() => setExpired(true), Math.max(0, remaining));
    return () => clearTimeout(timer);
  }, [challenge.expiresAt, run.phase]);

  // On arrival, while the countdown is still running, and again when it ends.
  // The first of those is the one that matters on a phone: a soft keyboard is
  // raised only for focus that follows a user gesture, and the tap on "Start
  // Run" is the most recent gesture there is. Waiting for the countdown to
  // finish would put three seconds between the two and lose the keyboard.
  useEffect(() => {
    if (run.phase === "countdown" || run.phase === "idle") input.current?.focus();
  }, [run.phase]);

  if (expired) {
    return (
      <Interruption
        heading="Challenge expired"
        detail="This Passage was handed out too long ago to still be answerable."
        onLeave={onLeave}
      />
    );
  }

  if (submit.error instanceof RunRefused) {
    return (
      <Interruption
        heading="Run not recorded"
        detail={submit.error.rejection.explanation}
        onLeave={onLeave}
      />
    );
  }

  if (submit.isError) {
    return (
      <Interruption
        heading="Could not reach the backend"
        detail="The Run was finished but never got anywhere. Nothing was recorded."
        onLeave={onLeave}
      />
    );
  }

  // Named once: it decides what is on the screen in four places, and
  // `run.phase === "countdown"` repeated four times reads as four decisions.
  const counting = run.phase === "countdown";

  return (
    <section
      className="flex flex-col gap-6"
      aria-label={`${DISCIPLINES[passage.discipline].title} Run`}
    >
      {/* The countdown clears the screen, as the mockup draws it: no readouts,
          no progress track, no panel. All three are measurements of a Run that
          has not started — a speed of zero and a bar at nothing are furniture,
          and putting them up first shrinks the numeral that is the only thing
          anybody is looking at. */}
      {counting || (
        <div className="flex items-start justify-between gap-4">
          <div className="flex gap-8 sm:gap-10">
            <Stat value={Math.round(run.wpm)} unit="wpm" label="Speed" size="sm" align="left" />
            <Stat
              value={run.accuracy.toFixed(1)}
              unit="%"
              label="Accuracy"
              size="sm"
              align="left"
              accent={run.errors === 0 ? "green" : "warning"}
            />
            <Stat
              value={Math.floor(run.elapsedMillis / 1000)}
              unit="s"
              label="Time"
              size="sm"
              align="left"
              accent="white"
            />
          </div>
          <IconButton label="Abandon this Challenge" variant="outline" onClick={onLeave}>
            <span aria-hidden="true">✕</span>
          </IconButton>
        </div>
      )}

      {/* One wrapper across both phases, and the input is always its second
          child, because React reconciles by position: swapping what sits above
          it is a re-render, but moving the input into a branch would unmount and
          remount it, taking the focus with it. That focus is the whole point —
          a phone raises its keyboard only for focus that follows a gesture, and
          the tap on "Start Run" is the last one there is. Losing it three
          seconds later is exactly the failure ADR-0010's deviation prevents. */}
      <div className="relative">
        {counting ? (
          <div className="flex min-h-[58dvh] items-center justify-center">
            <Countdown
              count={run.count}
              tag={DISCIPLINES[passage.discipline].title}
              preview={preview(passage.text)}
            />
          </div>
        ) : (
          <Card scanlines className="flex min-h-[220px] items-center">
            {/* Hidden from assistive technology — it is hundreds of
                one-character elements. The Passage is offered to a screen
                reader below, as running text the input points at. */}
            <TypingField text={passage.text} typed={run.typed} className="text-lg sm:text-xl" />
          </Card>
        )}

        <input
          ref={input}
          data-testid="typing-input"
          value={run.typed}
          onChange={(event) => run.type(event.target.value)}
          // Detectable only because this is a real form control. A focusable
          // div has no paste event to prevent.
          onPaste={(event) => event.preventDefault()}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          aria-label="Type the Passage"
          aria-describedby="passage-text"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          // 16px is not a look — it is the threshold below which iOS Safari
          // zooms the page when an input takes focus, which on this screen
          // would throw the Passage off the side mid-Run. Invisible either way.
          className="absolute inset-0 size-full cursor-text resize-none border-0 bg-transparent p-5 text-[16px] text-transparent caret-transparent opacity-0 outline-none"
        />
      </div>

      {/* Outside the conditional: the input points at this, and an
          `aria-describedby` that comes and goes is a description that is
          sometimes not there. */}
      <p id="passage-text" className="sr-only">
        {passage.text}
      </p>

      {counting || (
        <>
          <ProgressBar
            value={run.progress}
            label="Progress through the Passage"
            showLabel
            // The bar changes colour the moment a mistake exists, so the state
            // of the Run is legible without reading the accuracy figure.
            tone={run.errors > 0 ? "warning" : "green"}
          />

          <p className="text-center font-code text-xs text-ink-3" role="status">
            {statusLine(run.phase, submit.isPending, focused)}
          </p>

          <p className="text-center font-code text-xs text-disabled">— {passage.attribution}</p>
        </>
      )}
    </section>
  );
}

function statusLine(
  phase: ReturnType<typeof useTypingRun>["phase"],
  verifying: boolean,
  focused: boolean,
): string {
  if (verifying) return "verifying with the server";
  if (phase === "complete") return "run complete";
  // Not a keyboard trap: focus is never taken back automatically, so anyone who
  // tabbed away on purpose is told how to come back rather than dragged back.
  if (!focused) return "click the Passage to start typing";
  if (phase === "idle") return "start typing to begin the clock";
  return "keep going — the rain is with you";
}

function preview(text: string): string {
  return text.length <= PREVIEW_CHARACTERS
    ? text
    : `${text.slice(0, PREVIEW_CHARACTERS).trimEnd()}...`;
}

/** A Run that stopped for a reason the player needs told, rather than a result. */
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
      <Button onClick={onLeave}>Choose a Discipline</Button>
    </Card>
  );
}
