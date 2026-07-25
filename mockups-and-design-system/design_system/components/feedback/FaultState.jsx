import React from "react";

/**
 * FaultState — a full-screen system fault. A giant pulsing glyph in the fault
 * color (error red by default — the one moment red owns the void), a title,
 * a line of copy, and recovery actions (children). Use over dimmed rain.
 */
export function FaultState({ glyph = "!", title = "SIGNAL LOST", description, tone = "error", children, style = {} }) {
  const c = tone === "warning" ? "var(--warning)" : tone === "info" ? "var(--info)" : "var(--error)";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: 22, padding: "var(--space-8)", ...style }}>
      <div aria-hidden style={{ fontFamily: "var(--font-crt)", fontSize: "clamp(90px, 16vw, 130px)", lineHeight: 0.8, color: c, textShadow: `0 0 24px color-mix(in srgb, ${c} 70%, transparent)`, animation: "gmc-pulse-glow 1.4s steps(2) infinite" }}>{glyph}</div>
      <div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-2xl)", letterSpacing: "var(--tracking-wide)", color: c, marginBottom: 8 }}>{title}</div>
        {description && <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-sm)", color: "var(--ink-2)", maxWidth: 360, lineHeight: "var(--leading-normal)", margin: "0 auto" }}>{description}</div>}
      </div>
      {children && <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>{children}</div>}
    </div>
  );
}
