import React from "react";

/** Input — a terminal text field. Optional `prefix` glyph (e.g. a "> " prompt). */
export function Input({ prefix, invalid = false, disabled = false, style = {}, wrapStyle = {}, ...rest }) {
  const [focus, setFocus] = React.useState(false);
  const border = invalid ? "var(--error)" : focus ? "var(--rain-green)" : "var(--line-bright)";
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8, height: "var(--control-md)", padding: "0 12px",
      background: "var(--surface-1)", border: `1px solid ${border}`, borderRadius: "var(--radius-sm)",
      boxShadow: focus && !invalid ? "var(--box-glow)" : invalid ? "var(--glow-error)" : "none",
      transition: "border-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)",
      opacity: disabled ? 0.45 : 1, ...wrapStyle,
    }}>
      {prefix && <span style={{ color: "var(--rain-green)", fontFamily: "var(--font-mono)", textShadow: "var(--glow-sm)", userSelect: "none" }}>{prefix}</span>}
      <input
        disabled={disabled}
        onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
        style={{
          flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "none",
          color: "var(--ink-1)", fontFamily: "var(--font-mono)", fontSize: "var(--text-sm)",
          caretColor: "var(--rain-green)", ...style,
        }}
        {...rest}
      />
    </div>
  );
}
