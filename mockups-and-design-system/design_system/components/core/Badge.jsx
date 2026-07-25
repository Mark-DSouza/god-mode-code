import React from "react";

const tones = {
  green:  { color: "var(--rain-green)", border: "color-mix(in srgb, var(--rain-green) 45%, transparent)", bg: "color-mix(in srgb, var(--rain-green) 10%, transparent)" },
  neutral:{ color: "var(--ink-2)", border: "var(--line-bright)", bg: "var(--surface-2)" },
  error:  { color: "var(--error)", border: "color-mix(in srgb, var(--error) 50%, transparent)", bg: "color-mix(in srgb, var(--error) 12%, transparent)" },
  warning:{ color: "var(--warning)", border: "color-mix(in srgb, var(--warning) 45%, transparent)", bg: "color-mix(in srgb, var(--warning) 12%, transparent)" },
  info:   { color: "var(--info)", border: "color-mix(in srgb, var(--info) 45%, transparent)", bg: "color-mix(in srgb, var(--info) 12%, transparent)" },
};

/** Badge — a small status/label chip. `dot` prepends a status dot; `solid` fills it. */
export function Badge({ tone = "green", solid = false, dot = false, children, style = {} }) {
  const t = tones[tone] || tones.green;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      fontFamily: "var(--font-display)", fontSize: "var(--text-2xs)",
      letterSpacing: "var(--tracking-wide)", textTransform: "uppercase",
      padding: "3px 9px", borderRadius: "var(--radius-pill)",
      color: solid ? "var(--ink-on)" : t.color,
      background: solid ? t.color : t.bg,
      border: `1px solid ${solid ? "transparent" : t.border}`,
      lineHeight: 1, whiteSpace: "nowrap", ...style,
    }}>
      {dot && <span style={{ width: 6, height: 6, borderRadius: "50%", background: solid ? "var(--ink-on)" : t.color, boxShadow: solid ? "none" : "var(--glow-sm)" }} />}
      {children}
    </span>
  );
}
