import * as React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** primary = filled phosphor; secondary = outlined; ghost = bare; danger = red pill. */
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  /** Stretch to full width of the container. */
  block?: boolean;
  disabled?: boolean;
  children?: React.ReactNode;
}

/**
 * Primary action control. Uppercased terminal type with wide tracking; the
 * primary variant glows green, danger glows red.
 *
 * @startingPoint section="Core" subtitle="Terminal action buttons" viewport="700x160"
 */
export function Button(props: ButtonProps): JSX.Element;
