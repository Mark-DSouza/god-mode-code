import React from "react";
import { Card } from "../core/Card.jsx";
import { Stat } from "../core/Stat.jsx";

/**
 * ResultPanel — the end-of-run summary. A grid of Stat readouts (WPM,
 * accuracy, time, errors) under a headline verdict.
 */
export function ResultPanel({ wpm, accuracy, time, errors, verdict = "RUN COMPLETE", isBest = false, style = {} }) {
  return (
    <Card glow scanlines padding="var(--space-6)" style={{ ...style }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: "var(--space-5)" }}>
        <span style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-xl)", letterSpacing: "var(--tracking-wide)", color: "var(--ink-max)", textTransform: "uppercase", textShadow: "var(--glow-sm)" }}>{verdict}</span>
        {isBest && <span style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-2xs)", letterSpacing: "var(--tracking-wider)", color: "var(--warning)", textTransform: "uppercase", border: "1px solid color-mix(in srgb, var(--warning) 45%, transparent)", padding: "3px 8px", borderRadius: "var(--radius-pill)" }}>New Best</span>}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "var(--space-4)" }}>
        <Stat value={wpm} unit="wpm" label="Speed" size="md" />
        <Stat value={accuracy} unit="%" label="Accuracy" size="md" accent={accuracy >= 97 ? "green" : accuracy >= 90 ? "warning" : "error"} />
        <Stat value={time} unit="s" label="Time" size="md" accent="white" />
        <Stat value={errors} label="Errors" size="md" accent={errors === 0 ? "green" : "error"} />
      </div>
    </Card>
  );
}
