import * as React from "react";

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: "sm" | "md" | "lg";
  variant?: "ghost" | "outline";
  /** Accessible label (also the tooltip title). */
  label: string;
  disabled?: boolean;
  /** The icon node. */
  children?: React.ReactNode;
}

/** Square bare-icon control for toolbars and window chrome. */
export function IconButton(props: IconButtonProps): JSX.Element;
