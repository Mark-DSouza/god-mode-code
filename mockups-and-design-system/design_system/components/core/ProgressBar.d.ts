import * as React from "react";
export interface ProgressBarProps {
  value?: number;
  max?: number;
  tone?: "green" | "error" | "warning" | "info";
  /** Show a numeric percent readout on the right. */
  showLabel?: boolean;
  style?: React.CSSProperties;
}
/** Segmented phosphor progress track. */
export function ProgressBar(props: ProgressBarProps): JSX.Element;
