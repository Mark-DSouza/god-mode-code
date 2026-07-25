import * as React from "react";
export interface TabItem { id: string; label: React.ReactNode; }
export interface TabsProps {
  items: TabItem[];
  value: string;
  onChange?: (id: string) => void;
  style?: React.CSSProperties;
}
/** Underlined terminal tab bar. */
export function Tabs(props: TabsProps): JSX.Element;
