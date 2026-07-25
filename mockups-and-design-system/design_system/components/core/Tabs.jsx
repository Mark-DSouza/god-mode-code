import React from "react";

/** Tabs — underlined terminal tab bar. `items` = [{id,label}]; controlled via `value`. */
export function Tabs({ items = [], value, onChange, style = {} }) {
  return (
    <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--line)", ...style }}>
      {items.map((it) => {
        const active = it.id === value;
        return (
          <button key={it.id} onClick={() => onChange?.(it.id)}
            style={{
              position: "relative", background: "transparent", border: "none", cursor: "pointer",
              padding: "10px 16px", marginBottom: -1,
              fontFamily: "var(--font-display)", fontSize: "var(--text-xs)",
              letterSpacing: "var(--tracking-wide)", textTransform: "uppercase",
              color: active ? "var(--rain-green)" : "var(--ink-2)",
              textShadow: active ? "var(--glow-sm)" : "none",
              borderBottom: `2px solid ${active ? "var(--rain-green)" : "transparent"}`,
              transition: "color var(--dur-fast) var(--ease-out)",
            }}
          >{it.label}</button>
        );
      })}
    </div>
  );
}
