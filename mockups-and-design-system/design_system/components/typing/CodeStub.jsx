import React from "react";

/**
 * CodeStub — a line-numbered editor surface for the Code discipline. Renders
 * a gutter of line numbers beside monospace lines; when `caret` is true the
 * active line shows a blinking block caret at the end of its text. Pass
 * `lines` (array of strings) for a filled stub, or leave empty for a bare start.
 */
export function CodeStub({ lines = [""], activeLine = 0, caret = true, minLines = 6, style = {} }) {
  const rows = lines.length < minLines ? [...lines, ...Array(minLines - lines.length).fill("")] : lines;
  return (
    <div style={{
      display: "flex", background: "var(--surface-1)", border: "1px solid var(--line)",
      borderRadius: "var(--radius-md)", overflow: "hidden", fontFamily: "var(--font-mono)",
      fontSize: "var(--text-sm)", lineHeight: "var(--leading-loose)", ...style,
    }}>
      <div aria-hidden style={{
        padding: "14px 12px", textAlign: "right", color: "var(--ink-3)", userSelect: "none",
        background: "color-mix(in srgb, var(--void) 40%, transparent)", borderRight: "1px solid var(--line-faint)",
        minWidth: 44,
      }}>
        {rows.map((_, i) => <div key={i}>{String(i + 1).padStart(2, "0")}</div>)}
      </div>
      <div style={{ padding: "14px 16px", flex: 1, overflow: "auto", color: "var(--ink-1)" }}>
        {rows.map((ln, i) => (
          <div key={i} style={{
            whiteSpace: "pre", minHeight: "1.9em",
            background: i === activeLine ? "color-mix(in srgb, var(--rain-green) 7%, transparent)" : "transparent",
            color: i === activeLine ? "var(--rain-bright)" : "var(--ink-1)",
          }}>
            {ln}
            {caret && i === activeLine && (
              <span aria-hidden style={{ display: "inline-block", width: 2, height: "1em", verticalAlign: "text-bottom", marginLeft: 1, background: "var(--rain-green)", boxShadow: "var(--glow-md)", animation: "gmc-caret 1s steps(1) infinite" }} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
