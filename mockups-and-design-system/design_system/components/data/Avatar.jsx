import React from "react";

/**
 * Avatar — a square terminal tile showing initials (or an image), with a
 * green phosphor glow. `src` overrides initials when provided.
 */
export function Avatar({ initials = "", src, size = 34, glow = true, style = {} }) {
  const px = typeof size === "number" ? size : { sm: 28, md: 34, lg: 48 }[size] || 34;
  return (
    <div style={{
      width: px, height: px, flexShrink: 0, display: "grid", placeItems: "center",
      background: src ? "var(--surface-2)" : "var(--surface-2)",
      border: "1px solid var(--line-bright)", borderRadius: "var(--radius-sm)",
      overflow: "hidden", boxShadow: glow ? "var(--box-glow)" : "none",
      fontFamily: "var(--font-terminal)", fontSize: Math.round(px * 0.4),
      letterSpacing: "0.06em", color: "var(--rain-green)", textShadow: glow ? "var(--glow-sm)" : "none",
      userSelect: "none", ...style,
    }}>
      {src ? <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initials.slice(0, 2).toUpperCase()}
    </div>
  );
}
