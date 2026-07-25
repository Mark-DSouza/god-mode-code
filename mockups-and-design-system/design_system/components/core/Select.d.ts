import * as React from "react";
export interface SelectOption { value: string; label: string; }
export interface SelectProps {
  options: SelectOption[];
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  style?: React.CSSProperties;
}
/** Native-backed terminal dropdown with a green chevron. */
export function Select(props: SelectProps): JSX.Element;
