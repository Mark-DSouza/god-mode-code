import React from "react";

/**
 * RunChart — a phosphor bar chart of recent runs (profile history). The single
 * peak bar glows brightest; the rest sit dimmed. `values` is an array of
 * numbers; `label` + `peakLabel` caption the chart.
 */
export function RunChart({ values = [], label, peakLabel, height = 120, style = {} }) {
  const peak = Math.max(1, ...values);
  return (
    <div style={{ border: "1px solid var(--line)", borderRadius: "var(--radius-md)", background: "var(--surface-1)", padding: "var(--space-5)", ...style }}>
      {(label || peakLabel) && (
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 16 }}>
          {label && <div style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-2xs)", letterSpacing: "var(--tracking-wide)", textTransform: "uppercase", color: "var(--ink-2)" }}>{label}</div>}
          {peakLabel && <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)", color: "var(--ink-3)" }}>{peakLabel}</div>}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height }}>
        {values.map((v, i) => {
          const isPeak = v === peak;
          return (
            <div key={i} title={String(v)} style={{
              flex: 1, height: Math.round((v / peak) * 100) + "%", borderRadius: "2px 2px 0 0",
              background: isPeak ? "var(--rain-green)" : "color-mix(in srgb, var(--rain-green) 42%, var(--surface-3))",
              boxShadow: isPeak ? "var(--glow-sm)" : "none",
              transition: "height var(--dur-med) var(--ease-out)",
            }} />
          );
        })}
      </div>
    </div>
  );
}
