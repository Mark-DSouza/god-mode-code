import React from "react";

/**
 * TypingField — the core typing surface. Renders the target `text` overlaid
 * with the user's `typed` progress: correct glyphs glow green, mistakes flash
 * red, the active glyph carries a blinking block caret, untyped glyphs sit dim.
 * Purely presentational — feed it `text` and `typed` (the substring entered).
 */
export function TypingField({ text = "", typed = "", size = "lg", style = {} }) {
  const fontSize = size === "sm" ? "var(--text-md)" : size === "md" ? "var(--text-lg)" : "var(--text-xl)";
  const chars = text.split("");
  return (
    <div style={{
      fontFamily: "var(--font-mono)", fontSize, lineHeight: "var(--leading-loose)",
      letterSpacing: "0.02em", color: "var(--ink-3)", wordBreak: "break-word",
      whiteSpace: "pre-wrap", ...style,
    }}>
      {chars.map((ch, i) => {
        const done = i < typed.length;
        const isCurrent = i === typed.length;
        const correct = done && typed[i] === ch;
        const wrong = done && typed[i] !== ch;
        let color = "var(--ink-3)", background = "transparent", textShadow = "none";
        if (correct) { color = "var(--rain-green)"; textShadow = "var(--glow-sm)"; }
        if (wrong) { color = "var(--rain-shine)"; background = "color-mix(in srgb, var(--error) 45%, transparent)"; }
        return (
          <span key={i} style={{
            position: "relative", color, background, textShadow,
            borderRadius: 1, transition: "color 60ms linear, text-shadow 60ms linear",
          }}>
            {isCurrent && (
              <span aria-hidden style={{
                position: "absolute", left: -1, top: "0.12em", bottom: "0.12em", width: 2,
                background: "var(--rain-green)", boxShadow: "var(--glow-md)",
                animation: "gmc-caret 1s steps(1) infinite",
              }} />
            )}
            {ch === " " && wrong ? "␣" : ch}
          </span>
        );
      })}
      {typed.length >= text.length && (
        <span aria-hidden style={{ display: "inline-block", width: 2, height: "1em", verticalAlign: "text-bottom", background: "var(--rain-green)", boxShadow: "var(--glow-md)", animation: "gmc-caret 1s steps(1) infinite" }} />
      )}
    </div>
  );
}
