import React from "react";

/**
 * EmptyState — a centered zero-data placeholder: a large dim glyph, a title,
 * a line of copy, and an action (passed as children). Used for first-visit
 * profiles and empty histories.
 */
export function EmptyState({ glyph = "_", title, description, children, style = {} }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: 20, padding: "var(--space-8)", ...style }}>
      <div aria-hidden style={{ fontFamily: "var(--font-crt)", fontSize: "var(--text-5xl)", lineHeight: 0.8, color: "var(--ink-3)" }}>{glyph}</div>
      <div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-xl)", letterSpacing: "var(--tracking-wide)", textTransform: "uppercase", color: "var(--ink-max)", marginBottom: 8 }}>{title}</div>
        {description && <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-sm)", color: "var(--ink-2)", maxWidth: 360, lineHeight: "var(--leading-normal)", margin: "0 auto" }}>{description}</div>}
      </div>
      {children}
    </div>
  );
}
