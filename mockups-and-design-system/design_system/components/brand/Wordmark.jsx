import React from "react";

/**
 * Wordmark — the GOD_MODE_CODE brand lockup: the ▚ block mark (a VT323 glyph,
 * standing in for a real logo) beside the terminal wordmark. Used in the header
 * chrome and on the access screen. No real logo exists yet.
 */
export function Wordmark({ size = 18, mark = true, glow = "md", color = "var(--rain-shine)", style = {} }) {
  const glowVar = glow === "lg" ? "var(--glow-lg)" : glow === "sm" ? "var(--glow-sm)" : "var(--glow-md)";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: size * 0.5, userSelect: "none", ...style }}>
      {mark && <span aria-hidden style={{ fontFamily: "var(--font-crt)", fontSize: size * 1.7, color: "var(--rain-green)", textShadow: "var(--glow-md)", lineHeight: 0.7 }}>▚</span>}
      <span style={{ fontFamily: "var(--font-terminal)", fontSize: size, letterSpacing: "0.16em", color, textShadow: glowVar === "none" ? "none" : glowVar }}>GOD_MODE_CODE</span>
    </span>
  );
}
