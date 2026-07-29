import { useEffect, useRef, useState } from "react";

/** The raw data a finished Solve Run is submitted with. Nothing here is a result. */
export interface CompletedSolveRun {
  source: string;
  keystrokes: number;
  startedAt: string;
  completedAt: string;
}

export interface SolveRunEngine {
  source: string;
  write: (value: string) => void;
  countKeystroke: () => void;
  keystrokes: number;
  elapsedMillis: number;
  /** The raw data as it stands now, for handing to the server. */
  completed: () => CompletedSolveRun;
}

/** How often the elapsed readout is refreshed. Once a second is all it shows. */
const TICK_MILLIS = 1000;

/**
 * One Solve Run's clock and counters.
 *
 * <h2>The clock starts when the Pattern appears</h2>
 *
 * Not on the first keystroke, which is where a Typing Run starts its clock. The
 * difference is the whole point of the Discipline: a Solve Run is measured by
 * Verdict and duration, and the expensive part is working out what to write. A
 * clock that started at the first keystroke would rank whoever thought longest
 * and then typed fastest, which is the opposite of what is being measured.
 *
 * The metrics a Typing Run shows while typing are absent here for the same
 * reason there is no Accuracy: there is nothing to be right or wrong about until
 * the judge has run the tests. What is on screen is the clock and the keystroke
 * count, and both are facts rather than scores.
 */
export function useSolveRun(scaffold: string): SolveRunEngine {
  const [source, setSource] = useState("");
  const [keystrokes, setKeystrokes] = useState(0);
  const [elapsedMillis, setElapsedMillis] = useState(0);

  // A ref, not state: it is read inside the handler that produces the
  // submission, and no render needs to see it.
  const startedAt = useRef(Date.now());

  // Reset when the Pattern changes. The scaffold is the identity of what is
  // being solved as far as this hook is concerned — a different Pattern is a
  // different Run, with its own clock.
  useEffect(() => {
    startedAt.current = Date.now();
    setSource("");
    setKeystrokes(0);
    setElapsedMillis(0);
  }, [scaffold]);

  useEffect(() => {
    const ticker = setInterval(() => setElapsedMillis(Date.now() - startedAt.current), TICK_MILLIS);
    return () => clearInterval(ticker);
  }, []);

  return {
    source,
    write: setSource,
    countKeystroke: () => setKeystrokes((count) => count + 1),
    keystrokes,
    elapsedMillis,
    completed: () => ({
      source,
      // Never fewer than the characters that exist: the server refuses a
      // submission claiming fewer keystrokes than it wrote characters, and a
      // browser that missed a key event — an IME commit, a paste, a soft
      // keyboard that reports nothing — would otherwise turn an honest Solve
      // Run into a refusal. Under-reporting is corrected upwards rather than
      // guessed at, and detecting the paste it papers over is its own defence.
      keystrokes: Math.max(keystrokes, source.length),
      startedAt: new Date(startedAt.current).toISOString(),
      completedAt: new Date().toISOString(),
    }),
  };
}
