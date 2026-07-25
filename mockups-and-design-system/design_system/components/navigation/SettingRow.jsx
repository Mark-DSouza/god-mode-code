import React from "react";

/**
 * SettingRow — a labeled row with a description and a trailing control
 * (Switch, Select, Button…). The workhorse of the Settings screen.
 */
export function SettingRow({ label, description, children, divider = true, style = {} }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-5)",
      padding: "16px 0", borderBottom: divider ? "1px solid var(--line-faint)" : "none", ...style,
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-sm)", letterSpacing: "var(--tracking-wide)", textTransform: "uppercase", color: "var(--ink-max)" }}>{label}</div>
        {description && <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)", color: "var(--ink-2)", marginTop: 4, lineHeight: "var(--leading-snug)" }}>{description}</div>}
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  );
}
