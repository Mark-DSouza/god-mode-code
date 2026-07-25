import React from "react";

/**
 * Stat — an oversized CRT numeral readout (WPM, accuracy, streak). Big VT323
 * value with a small terminal label. `accent` recolors value + glow.
 */
export function Stat({ value, unit, label, accent = "green", size = "lg", align = "center", style = {} }) {
  const colors = { green: "var(--rain-green)", white: "var(--rain-shine)", error: "var(--error)", warning: "var(--warning)", info: "var(--info)" };
  const c = colors[accent] || colors.green;
  const valSize = size === "sm" ? "var(--text-3xl)" : size === "md" ? "var(--text-4xl)" : "var(--text-5xl)";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: align === "center" ? "center" : "flex-start", ...style }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, lineHeight: 0.9 }}>
        <span style={{ fontFamily: "var(--font-crt)", fontSize: valSize, color: c, textShadow: "0 0 12px color-mix(in srgb, " + c + " 55%, transparent)" }}>{value}</span>
        {unit && <span style={{ fontFamily: "var(--font-crt)", fontSize: "var(--text-lg)", color: "var(--ink-2)" }}>{unit}</span>}
      </div>
      {label && <span style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-2xs)", letterSpacing: "var(--tracking-wider)", textTransform: "uppercase", color: "var(--ink-2)", marginTop: 6 }}>{label}</span>}
    </div>
  );
}
