import * as React from "react";
export interface ResultPanelProps {
  wpm: React.ReactNode;
  accuracy: number;
  time: React.ReactNode;
  errors: number;
  /** Headline, e.g. "RUN COMPLETE". */
  verdict?: string;
  isBest?: boolean;
  style?: React.CSSProperties;
}
/**
 * End-of-run summary: a four-up grid of CRT Stat readouts with a headline verdict.
 * @startingPoint section="Typing" subtitle="End-of-run results summary" viewport="760x260"
 */
export function ResultPanel(props: ResultPanelProps): JSX.Element;
