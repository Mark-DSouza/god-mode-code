import React from "react";

const sizes = {
  sm: { height: "var(--control-sm)", padding: "0 14px", fontSize: "var(--text-xs)" },
  md: { height: "var(--control-md)", padding: "0 20px", fontSize: "var(--text-sm)" },
  lg: { height: "var(--control-lg)", padding: "0 30px", fontSize: "var(--text-md)" },
};

const base = {
  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "10px",
  fontFamily: "var(--font-display)", fontWeight: "var(--weight-regular)",
  letterSpacing: "var(--tracking-wider)", textTransform: "uppercase",
  borderRadius: "var(--radius-sm)", border: "1px solid transparent",
  cursor: "pointer", whiteSpace: "nowrap", userSelect: "none",
  transition: "background var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-snap)",
};

const variants = {
  primary: {
    rest: { background: "var(--rain-green)", color: "var(--ink-on)", borderColor: "var(--rain-green)", boxShadow: "0 0 14px color-mix(in srgb, var(--rain-green) 40%, transparent)" },
    hover: { background: "var(--rain-bright)", borderColor: "var(--rain-bright)", boxShadow: "0 0 22px color-mix(in srgb, var(--rain-green) 60%, transparent)" },
  },
  secondary: {
    rest: { background: "transparent", color: "var(--rain-green)", borderColor: "var(--line-bright)" },
    hover: { background: "color-mix(in srgb, var(--rain-green) 12%, transparent)", borderColor: "var(--rain-green)", color: "var(--rain-bright)", boxShadow: "var(--box-glow)" },
  },
  ghost: {
    rest: { background: "transparent", color: "var(--ink-2)", borderColor: "transparent" },
    hover: { background: "var(--surface-2)", color: "var(--rain-green)" },
  },
  danger: {
    rest: { background: "transparent", color: "var(--error)", borderColor: "color-mix(in srgb, var(--error) 55%, transparent)" },
    hover: { background: "color-mix(in srgb, var(--error) 14%, transparent)", borderColor: "var(--error)", boxShadow: "var(--glow-error)" },
  },
};

export function Button({
  variant = "primary", size = "md", disabled = false, block = false,
  children, style = {}, onMouseEnter, onMouseLeave, onMouseDown, onMouseUp, ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const [down, setDown] = React.useState(false);
  const v = variants[variant] || variants.primary;
  const s = {
    ...base, ...sizes[size], ...v.rest, ...(hover && !disabled ? v.hover : null),
    ...(block ? { width: "100%" } : null),
    ...(down && !disabled ? { transform: "translateY(1px) scale(0.985)" } : null),
    ...(disabled ? { opacity: 0.4, cursor: "not-allowed", boxShadow: "none" } : null),
    ...style,
  };
  return (
    <button
      disabled={disabled} style={s}
      onMouseEnter={(e) => { setHover(true); onMouseEnter?.(e); }}
      onMouseLeave={(e) => { setHover(false); setDown(false); onMouseLeave?.(e); }}
      onMouseDown={(e) => { setDown(true); onMouseDown?.(e); }}
      onMouseUp={(e) => { setDown(false); onMouseUp?.(e); }}
      {...rest}
    >{children}</button>
  );
}
