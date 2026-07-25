import * as React from "react";
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Leading glyph, e.g. ">" for a prompt. */
  prefix?: React.ReactNode;
  invalid?: boolean;
  disabled?: boolean;
  /** Style for the wrapper box. */
  wrapStyle?: React.CSSProperties;
}
/** Terminal text field with an optional prompt prefix and green focus glow. */
export function Input(props: InputProps): JSX.Element;
