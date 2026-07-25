import React from "react";

/**
 * Breadcrumb — a terminal path trail, e.g. godmodecode / code / two-sum.
 * items: [{ label, onClick? }]; the last item renders as the active leaf.
 */
export function Breadcrumb({ items = [], separator = "/", style = {} }) {
  return (
    <nav style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)", ...style }}>
      {items.map((it, i) => {
        const last = i === items.length - 1;
        return (
          <React.Fragment key={i}>
            {it.onClick && !last ? (
              <button onClick={it.onClick} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", fontSize: "inherit", color: "var(--ink-2)" }}>{it.label}</button>
            ) : (
              <span style={{ color: last ? "var(--rain-green)" : "var(--ink-2)", textShadow: last ? "var(--glow-sm)" : "none" }}>{it.label}</span>
            )}
            {!last && <span aria-hidden style={{ color: "var(--ink-3)" }}>{separator}</span>}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
