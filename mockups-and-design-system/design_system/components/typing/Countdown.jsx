import React from "react";

/**
 * Countdown — the pre-run "GET READY" screen. An oversized CRT numeral with a
 * white-cored shine glow, an optional discipline badge, and a dimmed passage
 * preview. Presentational: drive `count` (3 → 2 → 1) from a timer.
 */
export function Countdown({ count = 3, label = "GET READY", tag, preview, style = {} }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, textAlign: "center", ...style }}>
      {tag && (
        <span style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-2xs)", letterSpacing: "var(--tracking-wide)", textTransform: "uppercase", color: "var(--ink-2)", border: "1px solid var(--line-bright)", padding: "4px 12px", borderRadius: "var(--radius-pill)", marginBottom: 8 }}>{tag}</span>
      )}
      <div style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-sm)", letterSpacing: "var(--tracking-wider)", textTransform: "uppercase", color: "var(--ink-2)" }}>{label}</div>
      <div style={{ fontFamily: "var(--font-crt)", fontSize: "clamp(120px, 22vw, 200px)", lineHeight: 0.8, color: "var(--rain-shine)", textShadow: "0 0 40px var(--rain-green), 0 0 12px #fff" }}>{count}</div>
      {preview && <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-sm)", color: "var(--ink-3)", opacity: 0.85, maxWidth: 440, marginTop: 6, filter: "blur(0.3px)" }}>{preview}</div>}
      <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)", color: "var(--ink-3)", marginTop: 18 }}>start typing to begin the clock</div>
    </div>
  );
}
