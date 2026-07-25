import * as React from "react";
export interface ChallengeCardProps {
  /** Short symbol/glyph or icon node shown large. */
  glyph?: React.ReactNode;
  title: string;
  description?: string;
  /** Small corner tag, e.g. "142 passages". */
  meta?: string;
  selected?: boolean;
  /** md = full tile with description; sm = compact, description hidden. */
  size?: "sm" | "md";
  onClick?: () => void;
  style?: React.CSSProperties;
}
/**
 * A selectable challenge-category tile (Quotes / Code / Prose).
 * @startingPoint section="Typing" subtitle="Challenge category tile" viewport="360x200"
 */
export function ChallengeCard(props: ChallengeCardProps): JSX.Element;
