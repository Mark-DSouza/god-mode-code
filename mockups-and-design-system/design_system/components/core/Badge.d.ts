import * as React from "react";
export interface BadgeProps {
  tone?: "green" | "neutral" | "error" | "warning" | "info";
  /** Filled instead of outlined. */
  solid?: boolean;
  /** Prepend a glowing status dot. */
  dot?: boolean;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
/** Small status/label chip. */
export function Badge(props: BadgeProps): JSX.Element;
