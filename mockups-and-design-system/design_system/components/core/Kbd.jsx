import React from "react";

/** Kbd — a physical keycap glyph. Used throughout to show keystrokes/shortcuts. */
export function Kbd({ children, wide = false, style = {} }) {
  return (
    <kbd style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      minWidth: wide ? 56 : 26, height: 26, padding: "0 8px",
      fontFamily: "var(--font-mono)", fontSize: "var(--text-2xs)", fontWeight: "var(--weight-medium)",
      color: "var(--ink-1)", background: "var(--surface-2)",
      border: "1px solid var(--line-bright)",
      borderBottomWidth: 3, borderRadius: "var(--radius-sm)",
      boxShadow: "inset 0 1px 0 color-mix(in srgb, var(--rain-green) 8%, transparent)",
      textShadow: "var(--glow-sm)", lineHeight: 1, ...style,
    }}>{children}</kbd>
  );
}
