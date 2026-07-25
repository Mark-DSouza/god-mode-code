import * as React from "react";
export interface TableColumn {
  key: string;
  label: React.ReactNode;
  /** CSS grid track, e.g. "48px" or "1fr". */
  width?: string;
  align?: "left" | "center" | "right";
  /** false = use the display font instead of mono. */
  mono?: boolean;
  muted?: boolean;
  /** Custom cell renderer: (value, row) => node. */
  render?: (value: any, row: any) => React.ReactNode;
}
export interface TableProps {
  columns: TableColumn[];
  rows: any[];
  getRowKey?: (row: any) => React.Key;
  /** Return true to pin/highlight a row (e.g. "your row" on a leaderboard). */
  getHighlight?: (row: any) => boolean;
  style?: React.CSSProperties;
}
/**
 * Terminal data grid / ranked list with a green "your row" highlight variant.
 * @startingPoint section="Data" subtitle="Ranked list / leaderboard table" viewport="700x300"
 */
export function Table(props: TableProps): JSX.Element;
