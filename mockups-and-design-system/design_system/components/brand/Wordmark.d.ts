import * as React from "react";
export interface WordmarkProps {
  /** Font size of the wordmark text in px; the mark scales with it. */
  size?: number;
  /** Show the ▚ block mark before the text. */
  mark?: boolean;
  glow?: "none" | "sm" | "md" | "lg";
  /** Wordmark text color. */
  color?: string;
  style?: React.CSSProperties;
}
/**
 * The GOD_MODE_CODE brand lockup (▚ mark + terminal wordmark). Stands in for a
 * real logo, which does not exist yet.
 * @startingPoint section="Brand" subtitle="GOD_MODE_CODE wordmark lockup" viewport="420x80"
 */
export function Wordmark(props: WordmarkProps): JSX.Element;
