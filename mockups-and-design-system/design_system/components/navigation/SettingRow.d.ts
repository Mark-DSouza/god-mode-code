import * as React from "react";
export interface SettingRowProps {
  label: React.ReactNode;
  description?: React.ReactNode;
  /** The trailing control (Switch, Select, Button…). */
  children?: React.ReactNode;
  /** Bottom hairline divider. */
  divider?: boolean;
  style?: React.CSSProperties;
}
/** Labeled setting row with description + a trailing control. */
export function SettingRow(props: SettingRowProps): JSX.Element;
