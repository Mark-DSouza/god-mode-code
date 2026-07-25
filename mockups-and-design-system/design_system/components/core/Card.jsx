import React from "react";

/**
 * Card — a raised terminal panel. `glow` adds a green edge bloom; `scanlines`
 * overlays faint CRT lines; `interactive` lifts on hover.
 */
export function Card({
  glow = false, scanlines = false, interactive = false, padding = "var(--space-5)",
  children, style = {}, ...rest
}) {
  const [hover, setHover] = React.useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        position: "relative", background: "var(--bg-card)",
        border: "1px solid var(--border-color)", borderRadius: "var(--radius-md)",
        padding, overflow: "hidden",
        boxShadow: glow ? "var(--box-glow), var(--elev-1)" : "var(--elev-1)",
        transition: "border-color var(--dur-med) var(--ease-out), box-shadow var(--dur-med) var(--ease-out), transform var(--dur-med) var(--ease-out)",
        ...(interactive ? { cursor: "pointer" } : null),
        ...(interactive && hover ? { borderColor: "var(--rain-green)", boxShadow: "var(--box-glow), var(--elev-2)", transform: "translateY(-2px)" } : null),
        ...style,
      }}
      {...rest}
    >
      {scanlines && <div aria-hidden style={{ position: "absolute", inset: 0, backgroundImage: "var(--scanlines)", pointerEvents: "none", opacity: 0.6, zIndex: 1 }} />}
      <div style={{ position: "relative", zIndex: 2 }}>{children}</div>
    </div>
  );
}
