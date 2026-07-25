import * as React from "react";
export interface EmptyStateProps {
  /** Large dim glyph; defaults to a caret "_". */
  glyph?: React.ReactNode;
  title: string;
  description?: string;
  /** Action(s), usually a primary Button. */
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
/**
 * Centered zero-data placeholder with a glyph, title, copy, and an action.
 * @startingPoint section="Feedback" subtitle="Empty / no-data state" viewport="700x360"
 */
export function EmptyState(props: EmptyStateProps): JSX.Element;
