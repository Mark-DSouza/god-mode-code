import * as React from "react";
export interface TypingFieldProps {
  /** The target passage to be typed. */
  text: string;
  /** What the user has entered so far (compared char-by-char against text). */
  typed?: string;
  size?: "sm" | "md" | "lg";
  style?: React.CSSProperties;
}
/**
 * The core typing surface: correct glyphs glow green, mistakes flash red, a
 * blinking block caret marks the active glyph.
 * @startingPoint section="Typing" subtitle="Live typing surface with caret" viewport="820x260"
 */
export function TypingField(props: TypingFieldProps): JSX.Element;
