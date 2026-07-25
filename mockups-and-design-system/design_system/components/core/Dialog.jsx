import React from "react";

/**
 * Dialog — a centered modal over a rain-dimming scrim. Controlled via `open`.
 * Renders nothing when closed.
 */
export function Dialog({ open, onClose, title, children, footer, width = 480, style = {} }) {
  if (!open) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center",
        background: "color-mix(in srgb, var(--void) 78%, transparent)", backdropFilter: "blur(2px)", padding: "var(--space-5)",
      }}
    >
      <div
        role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative", width, maxWidth: "100%", background: "var(--bg-card)",
          border: "1px solid var(--rain-green)", borderRadius: "var(--radius-md)",
          boxShadow: "var(--box-glow-lg), var(--elev-2)", overflow: "hidden", ...style,
        }}
      >
        <div aria-hidden style={{ position: "absolute", inset: 0, backgroundImage: "var(--scanlines)", opacity: 0.4, pointerEvents: "none" }} />
        <div style={{ position: "relative", padding: "var(--space-5) var(--space-5) var(--space-4)", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-md)", letterSpacing: "var(--tracking-wide)", textTransform: "uppercase", color: "var(--ink-max)", textShadow: "var(--glow-sm)" }}>{title}</span>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", color: "var(--ink-2)", cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: "var(--text-md)" }}>✕</button>
        </div>
        <div style={{ position: "relative", padding: "var(--space-5)", fontFamily: "var(--font-mono)", fontSize: "var(--text-sm)", color: "var(--ink-1)", lineHeight: "var(--leading-normal)" }}>{children}</div>
        {footer && <div style={{ position: "relative", padding: "var(--space-4) var(--space-5)", borderTop: "1px solid var(--line)", display: "flex", justifyContent: "flex-end", gap: 12 }}>{footer}</div>}
      </div>
    </div>
  );
}
