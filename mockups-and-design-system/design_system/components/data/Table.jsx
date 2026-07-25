import React from "react";

/**
 * Table — a terminal data grid / ranked list. `columns` describe cells;
 * rows whose `highlight` is true get a pinned green-tinted "your row" treatment.
 * columns: [{ key, label, width?, align?, mono?, render? }]
 */
export function Table({ columns = [], rows = [], getRowKey, getHighlight, style = {} }) {
  const gridCols = columns.map((c) => c.width || "1fr").join(" ");
  const cellBase = { padding: "10px 14px", fontFamily: "var(--font-mono)", fontSize: "var(--text-sm)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
  return (
    <div style={{ border: "1px solid var(--line)", borderRadius: "var(--radius-md)", overflow: "hidden", background: "var(--bg-card)", ...style }}>
      <div style={{ display: "grid", gridTemplateColumns: gridCols, borderBottom: "1px solid var(--line)", background: "var(--surface-1)" }}>
        {columns.map((c) => (
          <div key={c.key} style={{ ...cellBase, fontFamily: "var(--font-display)", fontSize: "var(--text-2xs)", letterSpacing: "var(--tracking-wide)", textTransform: "uppercase", color: "var(--ink-2)", textAlign: c.align || "left" }}>{c.label}</div>
        ))}
      </div>
      {rows.map((row, i) => {
        const hl = getHighlight ? getHighlight(row) : row.highlight;
        return (
          <div key={getRowKey ? getRowKey(row) : i} style={{
            display: "grid", gridTemplateColumns: gridCols, alignItems: "center",
            borderBottom: i < rows.length - 1 ? "1px solid var(--line-faint)" : "none",
            background: hl ? "color-mix(in srgb, var(--rain-green) 12%, transparent)" : "transparent",
            boxShadow: hl ? "inset 2px 0 0 var(--rain-green)" : "none",
          }}>
            {columns.map((c) => (
              <div key={c.key} style={{
                ...cellBase, textAlign: c.align || "left",
                fontFamily: c.mono === false ? "var(--font-display)" : "var(--font-mono)",
                color: hl ? "var(--rain-bright)" : (c.muted ? "var(--ink-2)" : "var(--ink-1)"),
              }}>{c.render ? c.render(row[c.key], row) : row[c.key]}</div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
