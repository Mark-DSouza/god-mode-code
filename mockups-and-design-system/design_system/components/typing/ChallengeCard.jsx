import React from "react";
import { Card } from "../core/Card.jsx";
import { Badge } from "../core/Badge.jsx";

/**
 * ChallengeCard — a selectable challenge-category tile (Quotes / Code / Prose).
 * `glyph` is a short symbol or icon node; interactive lift on hover.
 */
export function ChallengeCard({ glyph, title, description, meta, selected = false, size = "md", onClick, style = {} }) {
  const compact = size === "sm";
  return (
    <Card interactive onClick={onClick} padding={compact ? "var(--space-4)" : "var(--space-5)"}
      style={{
        display: "flex", flexDirection: "column", gap: compact ? 8 : 12, minHeight: compact ? 108 : 168,
        borderColor: selected ? "var(--rain-green)" : "var(--border-color)",
        background: selected ? "color-mix(in srgb, var(--rain-green) 9%, var(--bg-card))" : "var(--bg-card)",
        boxShadow: selected
          ? "0 0 0 1.5px var(--rain-green), var(--box-glow), var(--elev-1)"
          : "var(--elev-1)", ...style,
      }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <span style={{ fontFamily: "var(--font-crt)", fontSize: compact ? "var(--text-2xl)" : "var(--text-3xl)", color: "var(--rain-green)", textShadow: "var(--glow-md)", lineHeight: 1 }}>{glyph}</span>
        {meta && <Badge tone="neutral">{meta}</Badge>}
      </div>
      <div style={{ marginTop: "auto" }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: compact ? "var(--text-md)" : "var(--text-lg)", color: "var(--ink-max)", letterSpacing: "var(--tracking-wide)", textTransform: "uppercase" }}>{title}</div>
        {description && !compact && <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)", color: "var(--ink-2)", marginTop: 6, lineHeight: "var(--leading-snug)" }}>{description}</div>}
      </div>
    </Card>
  );
}
