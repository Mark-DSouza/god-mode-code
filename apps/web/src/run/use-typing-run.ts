import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Where a Run is up to.
 *
 * `idle` comes *after* the countdown, not before it: the numeral gets you
 * ready, and then the surface sits live and waiting. The clock has not started
 * and will not until a key is pressed.
 */
export type RunPhase = "countdown" | "idle" | "running" | "complete";

/** The raw data a finished Run is submitted with. Nothing here is a metric. */
export interface CompletedRun {
  typedText: string;
  keystrokes: number;
  startedAt: string;
  completedAt: string;
}

export interface TypingRunEngine {
  phase: RunPhase;
  /** The countdown numeral, while there is one. */
  count: number;
  typed: string;
  keystrokes: number;
  elapsedMillis: number;
  /** Correct characters over five, per minute — the same arithmetic the server will do. */
  wpm: number;
  accuracy: number;
  errors: number;
  /** How far through the Passage, as a percentage. */
  progress: number;
  /** Called with the input's whole value, not with a key. */
  type: (value: string) => void;
}

/** A word is five characters, here and on the server. */
const CHARACTERS_PER_WORD = 5;

/**
 * How often the elapsed time is refreshed while typing.
 *
 * Ten times a second: fast enough that the seconds readout never looks stuck,
 * slow enough that it is not competing with keystrokes for the same frames.
 * The final figure does not come from this timer — it is measured exactly when
 * the last character lands.
 */
const TICK_MILLIS = 100;

/**
 * The Run itself: the phases, the clock, and the live metrics.
 *
 * Deliberately plain component state rather than the query cache. Everything
 * here is synchronous and per-keystroke, and putting a cache and a scheduler
 * between a key press and the glyph lighting up is exactly the latency this
 * screen cannot afford.
 *
 * The metrics computed here are for the player to watch. They are not sent
 * anywhere and would not be believed if they were: the server recomputes both
 * from the raw data in {@link CompletedRun} and discards anything the client
 * says about itself (ADR-0003). They match the server's arithmetic so that the
 * number on the result screen is not a surprise.
 */
export function useTypingRun({
  text,
  countdownFrom = 3,
  onComplete,
}: {
  text: string;
  countdownFrom?: number;
  onComplete: (run: CompletedRun) => void;
}): TypingRunEngine {
  const [phase, setPhase] = useState<RunPhase>("countdown");
  const [count, setCount] = useState(countdownFrom);
  const [typed, setTyped] = useState("");
  const [keystrokes, setKeystrokes] = useState(0);
  const [elapsedMillis, setElapsedMillis] = useState(0);

  // A ref, not state: the moment the clock started is read inside the keystroke
  // handler that may have just set it, and a state update would not be visible
  // there. It is also not something any render needs to see.
  const startedAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (phase !== "countdown") return;
    if (count <= 0) {
      setPhase("idle");
      return;
    }
    const timer = setTimeout(() => setCount((remaining) => remaining - 1), 1000);
    return () => clearTimeout(timer);
  }, [phase, count]);

  useEffect(() => {
    if (phase !== "running") return;
    const ticker = setInterval(() => {
      const startedAt = startedAtRef.current;
      if (startedAt !== null) setElapsedMillis(Date.now() - startedAt);
    }, TICK_MILLIS);
    return () => clearInterval(ticker);
  }, [phase]);

  const correctCharacters = useMemo(() => countCorrect(text, typed), [text, typed]);

  /**
   * Takes the input's whole value rather than a key.
   *
   * The keystrokes arrive at a real `<input>` (ADR-0010), and what a real input
   * reports is its value. Reading that instead of intercepting `keydown` is what
   * makes an IME, a dead key, a compose sequence and an Android soft keyboard
   * all behave — every one of those produces a value change and some of them
   * produce no useful key event at all.
   */
  function type(value: string) {
    if (phase !== "idle" && phase !== "running") return;

    // Anything past the end of the Passage is not part of it. The Run ends on
    // the final character, so there is nothing for a further keystroke to mean.
    const next = value.slice(0, text.length);
    const added = next.length - typed.length;
    const keystrokesNow = added > 0 ? keystrokes + added : keystrokes;

    if (added > 0) setKeystrokes(keystrokesNow);
    setTyped(next);

    if (added <= 0) return;

    // The clock starts here — on the first keystroke, not when the countdown
    // ended. Nobody is charged for the quarter second they spent finding the
    // home row.
    let startedAt = startedAtRef.current;
    if (startedAt === null) {
      startedAt = Date.now();
      startedAtRef.current = startedAt;
      setPhase("running");
    }

    if (next.length < text.length) return;

    // The final character ends the Run. There is no button to press and no
    // decision to make: the Passage is transcribed, and the elapsed time is
    // measured here rather than taken from the ticker, which is up to a tenth
    // of a second stale.
    const completedAt = Date.now();
    setElapsedMillis(completedAt - startedAt);
    setPhase("complete");
    onComplete({
      typedText: next,
      keystrokes: keystrokesNow,
      startedAt: new Date(startedAt).toISOString(),
      completedAt: new Date(completedAt).toISOString(),
    });
  }

  return {
    phase,
    count,
    typed,
    keystrokes,
    elapsedMillis,
    wpm: elapsedMillis > 0 ? correctCharacters / CHARACTERS_PER_WORD / (elapsedMillis / 60_000) : 0,
    // Nothing typed is nothing wrong. Opening a Run on 0% would read as a fault.
    accuracy: keystrokes > 0 ? (correctCharacters / keystrokes) * 100 : 100,
    errors: Math.max(0, keystrokes - correctCharacters),
    progress: text.length > 0 ? (typed.length / text.length) * 100 : 0,
    type,
  };
}

/**
 * How many characters of the Passage the typed text currently has right.
 *
 * Recomputed over the whole string on every keystroke, which is a few hundred
 * comparisons and costs nothing next to a paint. The incremental version would
 * have to unwind correctly on backspace, and being wrong about the number on
 * screen is worse than being slower than necessary at it.
 */
function countCorrect(text: string, typed: string): number {
  let correct = 0;
  for (let index = 0; index < typed.length; index++) {
    if (typed[index] === text[index]) correct++;
  }
  return correct;
}
