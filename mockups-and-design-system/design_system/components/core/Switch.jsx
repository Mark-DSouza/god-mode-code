import React from "react";

/** Switch — a hard-edged terminal toggle. Controlled via `checked` + `onChange`. */
export function Switch({ checked = false, onChange, disabled = false, label, style = {} }) {
  return (
    <label style={{ display: "inline-flex", alignItems: "center", gap: 12, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.45 : 1, ...style }}>
      <span
        role="switch" aria-checked={checked}
        onClick={() => !disabled && onChange?.(!checked)}
        style={{
          position: "relative", width: 46, height: 24, flexShrink: 0,
          background: checked ? "color-mix(in srgb, var(--rain-green) 22%, transparent)" : "var(--surface-3)",
          border: `1px solid ${checked ? "var(--rain-green)" : "var(--line-bright)"}`,
          borderRadius: "var(--radius-xs)", transition: "all var(--dur-fast) var(--ease-out)",
          boxShadow: checked ? "var(--box-glow)" : "none",
        }}
      >
        <span style={{
          position: "absolute", top: 2, left: checked ? 24 : 2, width: 18, height: 18,
          background: checked ? "var(--rain-green)" : "var(--ink-3)",
          boxShadow: checked ? "var(--glow-sm)" : "none",
          transition: "left var(--dur-fast) var(--ease-snap), background var(--dur-fast) var(--ease-out)",
        }} />
      </span>
      {label && <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-sm)", color: "var(--ink-1)" }}>{label}</span>}
    </label>
  );
}
