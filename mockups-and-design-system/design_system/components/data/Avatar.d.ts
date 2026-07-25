import * as React from "react";
export interface AvatarProps {
  /** Up to 2 characters; shown when no src. */
  initials?: string;
  /** Image URL; overrides initials. */
  src?: string;
  /** px number or "sm" | "md" | "lg". */
  size?: number | "sm" | "md" | "lg";
  glow?: boolean;
  style?: React.CSSProperties;
}
/** Square terminal identity tile: initials or image with a green glow. */
export function Avatar(props: AvatarProps): JSX.Element;
