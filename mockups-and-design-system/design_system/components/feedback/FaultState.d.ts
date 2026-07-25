import * as React from "react";
export interface FaultStateProps {
  /** Large pulsing glyph; defaults to "!". */
  glyph?: React.ReactNode;
  title?: string;
  description?: string;
  /** Fault color. error = the classic red-owns-the-void fault. */
  tone?: "error" | "warning" | "info";
  /** Recovery action(s), e.g. Reconnect / Work Offline buttons. */
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
/**
 * Full-screen system fault: a giant pulsing glyph, title, copy, and recovery
 * actions. The one screen where --error red takes the whole void.
 * @startingPoint section="Feedback" subtitle="Full-screen fault / error state" viewport="900x520"
 */
export function FaultState(props: FaultStateProps): JSX.Element;
