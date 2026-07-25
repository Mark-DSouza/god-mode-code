import * as React from "react";
export interface RunChartProps {
  /** Series of run values (e.g. WPM per run). */
  values: number[];
  /** Uppercased caption, e.g. "Last 14 runs · WPM". */
  label?: string;
  /** Right-aligned note, e.g. "peak 148". */
  peakLabel?: string;
  height?: number;
  style?: React.CSSProperties;
}
/**
 * Phosphor bar chart of recent runs; the peak bar glows brightest.
 * @startingPoint section="Data" subtitle="Recent-runs bar chart" viewport="700x220"
 */
export function RunChart(props: RunChartProps): JSX.Element;
