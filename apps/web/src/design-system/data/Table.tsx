import type { CSSProperties, Key, ReactNode } from "react";
import { cn } from "../cn.ts";

export interface TableColumn<Row> {
  /** Which field of a row this column reads, and the column's own identity. */
  key: string;
  label: ReactNode;
  /**
   * Column width, e.g. "48px". Omitted columns share what is left.
   *
   * The published contract calls this "a CSS grid track, e.g. `48px` or `1fr`",
   * and this is the one place the reimplementation cannot honour it exactly: a
   * fixed table layout takes a length, and `1fr` means nothing to a `<col>`.
   * Nothing is lost — `1fr` was the grid's way of saying "share what is left",
   * which is what omitting the width does here — but a caller porting a column
   * definition across verbatim gets an ignored value rather than an error, so
   * it is written down rather than left to be discovered.
   */
  width?: string;
  align?: "left" | "center" | "right";
  /** false = use the display font instead of mono. */
  mono?: boolean;
  muted?: boolean;
  /** Custom cell renderer: (value, row) => node. */
  render?: (value: unknown, row: Row) => ReactNode;
}

export interface TableProps<Row> {
  columns: TableColumn<Row>[];
  rows: Row[];
  getRowKey?: (row: Row) => Key;
  /** Return true to pin/highlight a row (e.g. "your row" on a Leaderboard). */
  getHighlight?: (row: Row) => boolean;
  /**
   * What this table is a table of, for anyone who cannot see the heading above
   * it.
   *
   * Beyond the published contract, and the reason is the same one the design
   * system README gives for reimplementing these at all: the shipped components
   * have no accessible semantics. A grid of `<div>`s announces nothing, and a
   * ranking is exactly the kind of content somebody arrives at out of context.
   */
  label?: string;
  className?: string;
  style?: CSSProperties;
}

/** Column alignment, as classes rather than an inline `textAlign` a caller cannot override. */
const ALIGN = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
} as const;

/**
 * A terminal data grid — a ranked list, with a green treatment for the row that
 * is yours.
 *
 * A real `<table>` rather than the shipped component's CSS grid of `<div>`s.
 * This is tabular data by construction: every row is the same fields about a
 * different person, which is the one case where the element and the content
 * agree. It buys row and column association for a screen reader for free, and
 * the fixed layout gives back the only thing the grid was providing — column
 * widths that do not shift between rows.
 *
 * Ellipsis rather than wrapping in every cell, which is what makes the row
 * height constant. A Handle is capped at 22 characters (V2) precisely so it
 * fits one of these at the narrowest supported viewport, and a row that grew a
 * second line would be a row that jumps as the ranking updates.
 */
export function Table<Row>({
  columns,
  rows,
  getRowKey,
  getHighlight,
  label,
  className,
  style,
}: TableProps<Row>) {
  return (
    <div
      className={cn("overflow-hidden rounded-md border border-line bg-surface-2", className)}
      style={style}
    >
      <table className="w-full table-fixed border-collapse" aria-label={label}>
        <colgroup>
          {columns.map((column) => (
            // Width is a free CSS length rather than a scale step, so it cannot
            // be a class. It is also the only inline style here.
            <col key={column.key} style={column.width ? { width: column.width } : undefined} />
          ))}
        </colgroup>

        <thead>
          <tr className="border-b border-line bg-surface-1">
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn(
                  "truncate px-[14px] py-[10px]",
                  "font-display text-2xs tracking-wide text-ink-2 uppercase",
                  ALIGN[column.align ?? "left"],
                )}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.map((row, index) => {
            const highlighted = getHighlight?.(row) ?? false;

            return (
              <tr
                key={getRowKey?.(row) ?? index}
                className={cn(
                  "border-b border-line-faint last:border-b-0",
                  // The tint and the bar together, not either alone: the bar
                  // survives a background nobody can distinguish, and the tint
                  // is what reads at a glance down a list of ten.
                  highlighted &&
                    cn(
                      "bg-[color-mix(in_srgb,var(--rain-green)_12%,transparent)]",
                      "shadow-[inset_2px_0_0_var(--rain-green)]",
                    ),
                )}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn(
                      "truncate px-[14px] py-[10px] text-sm",
                      column.mono === false ? "font-display" : "font-code",
                      ALIGN[column.align ?? "left"],
                      highlighted ? "text-rain-bright" : column.muted ? "text-ink-2" : "text-ink-1",
                    )}
                  >
                    {column.render
                      ? column.render((row as Record<string, unknown>)[column.key], row)
                      : // Rows are the caller's own shape, so a cell's value is
                        // only known to be renderable once a column has said how
                        // to render it. Without a `render` the field has to be
                        // something React can print on its own.
                        ((row as Record<string, ReactNode>)[column.key] ?? null)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
