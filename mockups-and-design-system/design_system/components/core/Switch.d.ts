import * as React from "react";
export interface SwitchProps {
  checked?: boolean;
  onChange?: (next: boolean) => void;
  disabled?: boolean;
  label?: React.ReactNode;
  style?: React.CSSProperties;
}
/** Hard-edged terminal toggle switch. */
export function Switch(props: SwitchProps): JSX.Element;
