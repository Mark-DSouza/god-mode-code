import React from "react";

/** ProgressBar — a segmented phosphor progress track. `tone` recolors the fill. */
export function ProgressBar({ value = 0, max = 100, tone = "green", showLabel = false, style = {} }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const colors = { green: "var(--rain-green)", error: "var(--error)", warning: "var(--warning)", info: "var(--info)" };
  const c = colors[tone] || colors.green;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, ...style }}>
      <div style={{ position: "relative", flex: 1, height: 8, background: "var(--surface-3)", border: "1px solid var(--line)", borderRadius: "var(--radius-xs)", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, width: pct + "%", background: c, boxShadow: "0 0 10px color-mix(in srgb, " + c + " 70%, transparent)", transition: "width var(--dur-med) var(--ease-out)" }} />
        <div aria-hidden style={{ position: "absolute", inset: 0, backgroundImage: "repeating-linear-gradient(to right, transparent 0 6px, #0006 6px 7px)", pointerEvents: "none" }} />
      </div>
      {showLabel && <span style={{ fontFamily: "var(--font-crt)", fontSize: "var(--text-lg)", color: c, minWidth: 44, textAlign: "right" }}>{Math.round(pct)}%</span>}
    </div>
  );
}
