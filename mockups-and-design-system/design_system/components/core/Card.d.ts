import * as React from "react";
export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Green edge bloom. */
  glow?: boolean;
  /** Faint CRT scanline overlay. */
  scanlines?: boolean;
  /** Lift + glow on hover. */
  interactive?: boolean;
  padding?: string;
  children?: React.ReactNode;
}
/**
 * A raised terminal panel — the default container for grouped content.
 * @startingPoint section="Core" subtitle="Terminal surface panel" viewport="700x220"
 */
export function Card(props: CardProps): JSX.Element;
