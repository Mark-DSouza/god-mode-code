import * as React from "react";
export interface CodeStubProps {
  /** Lines of code (strings). Empty array / [""] = a bare starting stub. */
  lines?: string[];
  /** Index of the line carrying the caret + active highlight. */
  activeLine?: number;
  /** Show the blinking block caret on the active line. */
  caret?: boolean;
  /** Pad to at least this many rows so the surface has body. */
  minLines?: number;
  style?: React.CSSProperties;
}
/**
 * Line-numbered editor surface for the Code discipline, with a live caret.
 * @startingPoint section="Typing" subtitle="Line-numbered code editor stub" viewport="700x260"
 */
export function CodeStub(props: CodeStubProps): JSX.Element;
