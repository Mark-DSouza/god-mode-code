import React from "react";

/** Select — a native-backed terminal dropdown. `options` = [{value,label}]. */
export function Select({ options = [], value, onChange, disabled = false, style = {}, ...rest }) {
  const [focus, setFocus] = React.useState(false);
  return (
    <div style={{
      position: "relative", display: "inline-flex", alignItems: "center",
      height: "var(--control-md)", background: "var(--surface-1)",
      border: `1px solid ${focus ? "var(--rain-green)" : "var(--line-bright)"}`,
      borderRadius: "var(--radius-sm)", boxShadow: focus ? "var(--box-glow)" : "none",
      opacity: disabled ? 0.45 : 1, transition: "border-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)", ...style,
    }}>
      <select
        value={value} disabled={disabled}
        onChange={(e) => onChange?.(e.target.value)}
        onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
        style={{
          appearance: "none", WebkitAppearance: "none", background: "transparent", border: "none", outline: "none",
          color: "var(--ink-1)", fontFamily: "var(--font-mono)", fontSize: "var(--text-sm)",
          padding: "0 34px 0 12px", height: "100%", cursor: disabled ? "not-allowed" : "pointer",
        }}
        {...rest}
      >
        {options.map((o) => <option key={o.value} value={o.value} style={{ background: "#0A0F0A", color: "#6BFF8E" }}>{o.label}</option>)}
      </select>
      <span aria-hidden style={{ position: "absolute", right: 12, color: "var(--rain-green)", fontSize: 10, pointerEvents: "none" }}>▼</span>
    </div>
  );
}
