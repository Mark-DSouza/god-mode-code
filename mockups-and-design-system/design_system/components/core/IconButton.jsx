import React from "react";

/**
 * IconButton — square bare-icon control for toolbars / chrome.
 * Pass an icon node (e.g. a Lucide <i data-lucide> or SVG) as children.
 */
export function IconButton({
  size = "md", variant = "ghost", disabled = false, label,
  children, style = {}, ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const dim = size === "sm" ? 32 : size === "lg" ? 52 : 40;
  const variants = {
    ghost: { color: "var(--ink-2)", background: "transparent", border: "1px solid transparent" },
    outline: { color: "var(--rain-green)", background: "transparent", border: "1px solid var(--line-bright)" },
  };
  const hoverStyle = {
    ghost: { color: "var(--rain-green)", background: "var(--surface-2)" },
    outline: { color: "var(--rain-bright)", background: "color-mix(in srgb, var(--rain-green) 10%, transparent)", boxShadow: "var(--box-glow)", borderColor: "var(--rain-green)" },
  };
  return (
    <button
      aria-label={label} title={label} disabled={disabled}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        width: dim, height: dim, display: "inline-flex", alignItems: "center", justifyContent: "center",
        borderRadius: "var(--radius-sm)", cursor: disabled ? "not-allowed" : "pointer",
        transition: "all var(--dur-fast) var(--ease-out)", padding: 0,
        ...variants[variant], ...(hover && !disabled ? hoverStyle[variant] : null),
        ...(disabled ? { opacity: 0.35, cursor: "not-allowed" } : null), ...style,
      }}
      {...rest}
    >{children}</button>
  );
}
