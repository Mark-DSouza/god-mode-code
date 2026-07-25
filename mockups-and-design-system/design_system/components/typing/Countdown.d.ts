import * as React from "react";
export interface CountdownProps {
  /** The current count value shown huge (3 → 2 → 1). */
  count?: React.ReactNode;
  /** Small caption above the numeral. */
  label?: string;
  /** Pill tag, e.g. "Code · Principal". */
  tag?: string;
  /** Dimmed passage preview under the numeral. */
  preview?: string;
  style?: React.CSSProperties;
}
/**
 * Pre-run countdown: an oversized shine-glow CRT numeral over a dimmed preview.
 * @startingPoint section="Typing" subtitle="Pre-run countdown" viewport="820x420"
 */
export function Countdown(props: CountdownProps): JSX.Element;
