import * as React from "react";
export interface StatProps {
  value: React.ReactNode;
  /** Trailing unit, e.g. "wpm" or "%". */
  unit?: string;
  /** Small uppercased caption below. */
  label?: string;
  accent?: "green" | "white" | "error" | "warning" | "info";
  size?: "sm" | "md" | "lg";
  align?: "center" | "left";
  style?: React.CSSProperties;
}
/**
 * Oversized CRT numeral readout for WPM / accuracy / streaks.
 * @startingPoint section="Core" subtitle="CRT numeral stat readout" viewport="700x200"
 */
export function Stat(props: StatProps): JSX.Element;
