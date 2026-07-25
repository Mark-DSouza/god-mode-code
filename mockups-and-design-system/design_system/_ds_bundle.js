/* @ds-bundle: {"format":4,"namespace":"GODMODECODEDesignSystem_ca0aa4","components":[{"name":"Wordmark","sourcePath":"components/brand/Wordmark.jsx"},{"name":"Badge","sourcePath":"components/core/Badge.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Card","sourcePath":"components/core/Card.jsx"},{"name":"Dialog","sourcePath":"components/core/Dialog.jsx"},{"name":"IconButton","sourcePath":"components/core/IconButton.jsx"},{"name":"Input","sourcePath":"components/core/Input.jsx"},{"name":"Kbd","sourcePath":"components/core/Kbd.jsx"},{"name":"ProgressBar","sourcePath":"components/core/ProgressBar.jsx"},{"name":"Select","sourcePath":"components/core/Select.jsx"},{"name":"Stat","sourcePath":"components/core/Stat.jsx"},{"name":"Switch","sourcePath":"components/core/Switch.jsx"},{"name":"Tabs","sourcePath":"components/core/Tabs.jsx"},{"name":"Avatar","sourcePath":"components/data/Avatar.jsx"},{"name":"RunChart","sourcePath":"components/data/RunChart.jsx"},{"name":"Table","sourcePath":"components/data/Table.jsx"},{"name":"DigitalRain","sourcePath":"components/effects/DigitalRain.jsx"},{"name":"EmptyState","sourcePath":"components/feedback/EmptyState.jsx"},{"name":"FaultState","sourcePath":"components/feedback/FaultState.jsx"},{"name":"Breadcrumb","sourcePath":"components/navigation/Breadcrumb.jsx"},{"name":"SettingRow","sourcePath":"components/navigation/SettingRow.jsx"},{"name":"ChallengeCard","sourcePath":"components/typing/ChallengeCard.jsx"},{"name":"CodeStub","sourcePath":"components/typing/CodeStub.jsx"},{"name":"Countdown","sourcePath":"components/typing/Countdown.jsx"},{"name":"ResultPanel","sourcePath":"components/typing/ResultPanel.jsx"},{"name":"TypingField","sourcePath":"components/typing/TypingField.jsx"}],"sourceHashes":{"components/brand/Wordmark.jsx":"f3e07744b9cf","components/core/Badge.jsx":"070fed2ccf99","components/core/Button.jsx":"417cba7bc49a","components/core/Card.jsx":"057e34212da6","components/core/Dialog.jsx":"b55ee306df22","components/core/IconButton.jsx":"0379bc39ec31","components/core/Input.jsx":"3a184bc6b033","components/core/Kbd.jsx":"c74270a9267c","components/core/ProgressBar.jsx":"aec068d49f7c","components/core/Select.jsx":"f4c83abd9254","components/core/Stat.jsx":"ad160a2c1959","components/core/Switch.jsx":"f8a737ba62da","components/core/Tabs.jsx":"3fe9f065d69f","components/data/Avatar.jsx":"d5c9c74f10ce","components/data/RunChart.jsx":"3f72ef67dae9","components/data/Table.jsx":"8c8b0f5af68d","components/effects/DigitalRain.jsx":"40db7e4631de","components/feedback/EmptyState.jsx":"4920b7a61bb3","components/feedback/FaultState.jsx":"35e8729909fd","components/navigation/Breadcrumb.jsx":"2dba243de0bd","components/navigation/SettingRow.jsx":"617fe1be58bf","components/typing/ChallengeCard.jsx":"35ab05be9b33","components/typing/CodeStub.jsx":"45daa2327721","components/typing/Countdown.jsx":"d8eba03239f4","components/typing/ResultPanel.jsx":"772855060dc8","components/typing/TypingField.jsx":"55e6aa399f40","ui_kits/god_mode_code/App.jsx":"2e8d17de4413","ui_kits/god_mode_code/AuthScreen.jsx":"1198aa2e3b27","ui_kits/god_mode_code/CodeScreen.jsx":"877258bca2e1","ui_kits/god_mode_code/Header.jsx":"2e87da47c029","ui_kits/god_mode_code/HomeScreen.jsx":"ef2d8ee02ba4","ui_kits/god_mode_code/LeaderboardScreen.jsx":"841ca3651459","ui_kits/god_mode_code/ProfileScreen.jsx":"b444af2fce8f","ui_kits/god_mode_code/ResultScreen.jsx":"78de8f765402","ui_kits/god_mode_code/RunScreen.jsx":"b6d333ca65c1","ui_kits/god_mode_code/SettingsScreen.jsx":"8d974fd664d3","ui_kits/god_mode_code/data.js":"ec70e55c89e6"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.GODMODECODEDesignSystem_ca0aa4 = window.GODMODECODEDesignSystem_ca0aa4 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/brand/Wordmark.jsx
try { (() => {
/**
 * Wordmark — the GOD_MODE_CODE brand lockup: the ▚ block mark (a VT323 glyph,
 * standing in for a real logo) beside the terminal wordmark. Used in the header
 * chrome and on the access screen. No real logo exists yet.
 */
function Wordmark({
  size = 18,
  mark = true,
  glow = "md",
  color = "var(--rain-shine)",
  style = {}
}) {
  const glowVar = glow === "lg" ? "var(--glow-lg)" : glow === "sm" ? "var(--glow-sm)" : "var(--glow-md)";
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: size * 0.5,
      userSelect: "none",
      ...style
    }
  }, mark && /*#__PURE__*/React.createElement("span", {
    "aria-hidden": true,
    style: {
      fontFamily: "var(--font-crt)",
      fontSize: size * 1.7,
      color: "var(--rain-green)",
      textShadow: "var(--glow-md)",
      lineHeight: 0.7
    }
  }, "\u259A"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-terminal)",
      fontSize: size,
      letterSpacing: "0.16em",
      color,
      textShadow: glowVar === "none" ? "none" : glowVar
    }
  }, "GOD_MODE_CODE"));
}
Object.assign(__ds_scope, { Wordmark });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/brand/Wordmark.jsx", error: String((e && e.message) || e) }); }

// components/core/Badge.jsx
try { (() => {
const tones = {
  green: {
    color: "var(--rain-green)",
    border: "color-mix(in srgb, var(--rain-green) 45%, transparent)",
    bg: "color-mix(in srgb, var(--rain-green) 10%, transparent)"
  },
  neutral: {
    color: "var(--ink-2)",
    border: "var(--line-bright)",
    bg: "var(--surface-2)"
  },
  error: {
    color: "var(--error)",
    border: "color-mix(in srgb, var(--error) 50%, transparent)",
    bg: "color-mix(in srgb, var(--error) 12%, transparent)"
  },
  warning: {
    color: "var(--warning)",
    border: "color-mix(in srgb, var(--warning) 45%, transparent)",
    bg: "color-mix(in srgb, var(--warning) 12%, transparent)"
  },
  info: {
    color: "var(--info)",
    border: "color-mix(in srgb, var(--info) 45%, transparent)",
    bg: "color-mix(in srgb, var(--info) 12%, transparent)"
  }
};

/** Badge — a small status/label chip. `dot` prepends a status dot; `solid` fills it. */
function Badge({
  tone = "green",
  solid = false,
  dot = false,
  children,
  style = {}
}) {
  const t = tones[tone] || tones.green;
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      fontFamily: "var(--font-display)",
      fontSize: "var(--text-2xs)",
      letterSpacing: "var(--tracking-wide)",
      textTransform: "uppercase",
      padding: "3px 9px",
      borderRadius: "var(--radius-pill)",
      color: solid ? "var(--ink-on)" : t.color,
      background: solid ? t.color : t.bg,
      border: `1px solid ${solid ? "transparent" : t.border}`,
      lineHeight: 1,
      whiteSpace: "nowrap",
      ...style
    }
  }, dot && /*#__PURE__*/React.createElement("span", {
    style: {
      width: 6,
      height: 6,
      borderRadius: "50%",
      background: solid ? "var(--ink-on)" : t.color,
      boxShadow: solid ? "none" : "var(--glow-sm)"
    }
  }), children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Badge.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const sizes = {
  sm: {
    height: "var(--control-sm)",
    padding: "0 14px",
    fontSize: "var(--text-xs)"
  },
  md: {
    height: "var(--control-md)",
    padding: "0 20px",
    fontSize: "var(--text-sm)"
  },
  lg: {
    height: "var(--control-lg)",
    padding: "0 30px",
    fontSize: "var(--text-md)"
  }
};
const base = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "10px",
  fontFamily: "var(--font-display)",
  fontWeight: "var(--weight-regular)",
  letterSpacing: "var(--tracking-wider)",
  textTransform: "uppercase",
  borderRadius: "var(--radius-sm)",
  border: "1px solid transparent",
  cursor: "pointer",
  whiteSpace: "nowrap",
  userSelect: "none",
  transition: "background var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-snap)"
};
const variants = {
  primary: {
    rest: {
      background: "var(--rain-green)",
      color: "var(--ink-on)",
      borderColor: "var(--rain-green)",
      boxShadow: "0 0 14px color-mix(in srgb, var(--rain-green) 40%, transparent)"
    },
    hover: {
      background: "var(--rain-bright)",
      borderColor: "var(--rain-bright)",
      boxShadow: "0 0 22px color-mix(in srgb, var(--rain-green) 60%, transparent)"
    }
  },
  secondary: {
    rest: {
      background: "transparent",
      color: "var(--rain-green)",
      borderColor: "var(--line-bright)"
    },
    hover: {
      background: "color-mix(in srgb, var(--rain-green) 12%, transparent)",
      borderColor: "var(--rain-green)",
      color: "var(--rain-bright)",
      boxShadow: "var(--box-glow)"
    }
  },
  ghost: {
    rest: {
      background: "transparent",
      color: "var(--ink-2)",
      borderColor: "transparent"
    },
    hover: {
      background: "var(--surface-2)",
      color: "var(--rain-green)"
    }
  },
  danger: {
    rest: {
      background: "transparent",
      color: "var(--error)",
      borderColor: "color-mix(in srgb, var(--error) 55%, transparent)"
    },
    hover: {
      background: "color-mix(in srgb, var(--error) 14%, transparent)",
      borderColor: "var(--error)",
      boxShadow: "var(--glow-error)"
    }
  }
};
function Button({
  variant = "primary",
  size = "md",
  disabled = false,
  block = false,
  children,
  style = {},
  onMouseEnter,
  onMouseLeave,
  onMouseDown,
  onMouseUp,
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const [down, setDown] = React.useState(false);
  const v = variants[variant] || variants.primary;
  const s = {
    ...base,
    ...sizes[size],
    ...v.rest,
    ...(hover && !disabled ? v.hover : null),
    ...(block ? {
      width: "100%"
    } : null),
    ...(down && !disabled ? {
      transform: "translateY(1px) scale(0.985)"
    } : null),
    ...(disabled ? {
      opacity: 0.4,
      cursor: "not-allowed",
      boxShadow: "none"
    } : null),
    ...style
  };
  return /*#__PURE__*/React.createElement("button", _extends({
    disabled: disabled,
    style: s,
    onMouseEnter: e => {
      setHover(true);
      onMouseEnter?.(e);
    },
    onMouseLeave: e => {
      setHover(false);
      setDown(false);
      onMouseLeave?.(e);
    },
    onMouseDown: e => {
      setDown(true);
      onMouseDown?.(e);
    },
    onMouseUp: e => {
      setDown(false);
      onMouseUp?.(e);
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/Card.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Card — a raised terminal panel. `glow` adds a green edge bloom; `scanlines`
 * overlays faint CRT lines; `interactive` lifts on hover.
 */
function Card({
  glow = false,
  scanlines = false,
  interactive = false,
  padding = "var(--space-5)",
  children,
  style = {},
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", _extends({
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      position: "relative",
      background: "var(--bg-card)",
      border: "1px solid var(--border-color)",
      borderRadius: "var(--radius-md)",
      padding,
      overflow: "hidden",
      boxShadow: glow ? "var(--box-glow), var(--elev-1)" : "var(--elev-1)",
      transition: "border-color var(--dur-med) var(--ease-out), box-shadow var(--dur-med) var(--ease-out), transform var(--dur-med) var(--ease-out)",
      ...(interactive ? {
        cursor: "pointer"
      } : null),
      ...(interactive && hover ? {
        borderColor: "var(--rain-green)",
        boxShadow: "var(--box-glow), var(--elev-2)",
        transform: "translateY(-2px)"
      } : null),
      ...style
    }
  }, rest), scanlines && /*#__PURE__*/React.createElement("div", {
    "aria-hidden": true,
    style: {
      position: "absolute",
      inset: 0,
      backgroundImage: "var(--scanlines)",
      pointerEvents: "none",
      opacity: 0.6,
      zIndex: 1
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      zIndex: 2
    }
  }, children));
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Card.jsx", error: String((e && e.message) || e) }); }

// components/core/Dialog.jsx
try { (() => {
/**
 * Dialog — a centered modal over a rain-dimming scrim. Controlled via `open`.
 * Renders nothing when closed.
 */
function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  width = 480,
  style = {}
}) {
  if (!open) return null;
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClose,
    style: {
      position: "fixed",
      inset: 0,
      zIndex: 1000,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "color-mix(in srgb, var(--void) 78%, transparent)",
      backdropFilter: "blur(2px)",
      padding: "var(--space-5)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    role: "dialog",
    "aria-modal": "true",
    onClick: e => e.stopPropagation(),
    style: {
      position: "relative",
      width,
      maxWidth: "100%",
      background: "var(--bg-card)",
      border: "1px solid var(--rain-green)",
      borderRadius: "var(--radius-md)",
      boxShadow: "var(--box-glow-lg), var(--elev-2)",
      overflow: "hidden",
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    "aria-hidden": true,
    style: {
      position: "absolute",
      inset: 0,
      backgroundImage: "var(--scanlines)",
      opacity: 0.4,
      pointerEvents: "none"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      padding: "var(--space-5) var(--space-5) var(--space-4)",
      borderBottom: "1px solid var(--line)",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-display)",
      fontSize: "var(--text-md)",
      letterSpacing: "var(--tracking-wide)",
      textTransform: "uppercase",
      color: "var(--ink-max)",
      textShadow: "var(--glow-sm)"
    }
  }, title), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    "aria-label": "Close",
    style: {
      background: "none",
      border: "none",
      color: "var(--ink-2)",
      cursor: "pointer",
      fontFamily: "var(--font-mono)",
      fontSize: "var(--text-md)"
    }
  }, "\u2715")), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      padding: "var(--space-5)",
      fontFamily: "var(--font-mono)",
      fontSize: "var(--text-sm)",
      color: "var(--ink-1)",
      lineHeight: "var(--leading-normal)"
    }
  }, children), footer && /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      padding: "var(--space-4) var(--space-5)",
      borderTop: "1px solid var(--line)",
      display: "flex",
      justifyContent: "flex-end",
      gap: 12
    }
  }, footer)));
}
Object.assign(__ds_scope, { Dialog });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Dialog.jsx", error: String((e && e.message) || e) }); }

// components/core/IconButton.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * IconButton — square bare-icon control for toolbars / chrome.
 * Pass an icon node (e.g. a Lucide <i data-lucide> or SVG) as children.
 */
function IconButton({
  size = "md",
  variant = "ghost",
  disabled = false,
  label,
  children,
  style = {},
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const dim = size === "sm" ? 32 : size === "lg" ? 52 : 40;
  const variants = {
    ghost: {
      color: "var(--ink-2)",
      background: "transparent",
      border: "1px solid transparent"
    },
    outline: {
      color: "var(--rain-green)",
      background: "transparent",
      border: "1px solid var(--line-bright)"
    }
  };
  const hoverStyle = {
    ghost: {
      color: "var(--rain-green)",
      background: "var(--surface-2)"
    },
    outline: {
      color: "var(--rain-bright)",
      background: "color-mix(in srgb, var(--rain-green) 10%, transparent)",
      boxShadow: "var(--box-glow)",
      borderColor: "var(--rain-green)"
    }
  };
  return /*#__PURE__*/React.createElement("button", _extends({
    "aria-label": label,
    title: label,
    disabled: disabled,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      width: dim,
      height: dim,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      borderRadius: "var(--radius-sm)",
      cursor: disabled ? "not-allowed" : "pointer",
      transition: "all var(--dur-fast) var(--ease-out)",
      padding: 0,
      ...variants[variant],
      ...(hover && !disabled ? hoverStyle[variant] : null),
      ...(disabled ? {
        opacity: 0.35,
        cursor: "not-allowed"
      } : null),
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { IconButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/IconButton.jsx", error: String((e && e.message) || e) }); }

// components/core/Input.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Input — a terminal text field. Optional `prefix` glyph (e.g. a "> " prompt). */
function Input({
  prefix,
  invalid = false,
  disabled = false,
  style = {},
  wrapStyle = {},
  ...rest
}) {
  const [focus, setFocus] = React.useState(false);
  const border = invalid ? "var(--error)" : focus ? "var(--rain-green)" : "var(--line-bright)";
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      height: "var(--control-md)",
      padding: "0 12px",
      background: "var(--surface-1)",
      border: `1px solid ${border}`,
      borderRadius: "var(--radius-sm)",
      boxShadow: focus && !invalid ? "var(--box-glow)" : invalid ? "var(--glow-error)" : "none",
      transition: "border-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)",
      opacity: disabled ? 0.45 : 1,
      ...wrapStyle
    }
  }, prefix && /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--rain-green)",
      fontFamily: "var(--font-mono)",
      textShadow: "var(--glow-sm)",
      userSelect: "none"
    }
  }, prefix), /*#__PURE__*/React.createElement("input", _extends({
    disabled: disabled,
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    style: {
      flex: 1,
      minWidth: 0,
      background: "transparent",
      border: "none",
      outline: "none",
      color: "var(--ink-1)",
      fontFamily: "var(--font-mono)",
      fontSize: "var(--text-sm)",
      caretColor: "var(--rain-green)",
      ...style
    }
  }, rest)));
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Input.jsx", error: String((e && e.message) || e) }); }

// components/core/Kbd.jsx
try { (() => {
/** Kbd — a physical keycap glyph. Used throughout to show keystrokes/shortcuts. */
function Kbd({
  children,
  wide = false,
  style = {}
}) {
  return /*#__PURE__*/React.createElement("kbd", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      minWidth: wide ? 56 : 26,
      height: 26,
      padding: "0 8px",
      fontFamily: "var(--font-mono)",
      fontSize: "var(--text-2xs)",
      fontWeight: "var(--weight-medium)",
      color: "var(--ink-1)",
      background: "var(--surface-2)",
      border: "1px solid var(--line-bright)",
      borderBottomWidth: 3,
      borderRadius: "var(--radius-sm)",
      boxShadow: "inset 0 1px 0 color-mix(in srgb, var(--rain-green) 8%, transparent)",
      textShadow: "var(--glow-sm)",
      lineHeight: 1,
      ...style
    }
  }, children);
}
Object.assign(__ds_scope, { Kbd });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Kbd.jsx", error: String((e && e.message) || e) }); }

// components/core/ProgressBar.jsx
try { (() => {
/** ProgressBar — a segmented phosphor progress track. `tone` recolors the fill. */
function ProgressBar({
  value = 0,
  max = 100,
  tone = "green",
  showLabel = false,
  style = {}
}) {
  const pct = Math.max(0, Math.min(100, value / max * 100));
  const colors = {
    green: "var(--rain-green)",
    error: "var(--error)",
    warning: "var(--warning)",
    info: "var(--info)"
  };
  const c = colors[tone] || colors.green;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      flex: 1,
      height: 8,
      background: "var(--surface-3)",
      border: "1px solid var(--line)",
      borderRadius: "var(--radius-xs)",
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      width: pct + "%",
      background: c,
      boxShadow: "0 0 10px color-mix(in srgb, " + c + " 70%, transparent)",
      transition: "width var(--dur-med) var(--ease-out)"
    }
  }), /*#__PURE__*/React.createElement("div", {
    "aria-hidden": true,
    style: {
      position: "absolute",
      inset: 0,
      backgroundImage: "repeating-linear-gradient(to right, transparent 0 6px, #0006 6px 7px)",
      pointerEvents: "none"
    }
  })), showLabel && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-crt)",
      fontSize: "var(--text-lg)",
      color: c,
      minWidth: 44,
      textAlign: "right"
    }
  }, Math.round(pct), "%"));
}
Object.assign(__ds_scope, { ProgressBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/ProgressBar.jsx", error: String((e && e.message) || e) }); }

// components/core/Select.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Select — a native-backed terminal dropdown. `options` = [{value,label}]. */
function Select({
  options = [],
  value,
  onChange,
  disabled = false,
  style = {},
  ...rest
}) {
  const [focus, setFocus] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      display: "inline-flex",
      alignItems: "center",
      height: "var(--control-md)",
      background: "var(--surface-1)",
      border: `1px solid ${focus ? "var(--rain-green)" : "var(--line-bright)"}`,
      borderRadius: "var(--radius-sm)",
      boxShadow: focus ? "var(--box-glow)" : "none",
      opacity: disabled ? 0.45 : 1,
      transition: "border-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)",
      ...style
    }
  }, /*#__PURE__*/React.createElement("select", _extends({
    value: value,
    disabled: disabled,
    onChange: e => onChange?.(e.target.value),
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    style: {
      appearance: "none",
      WebkitAppearance: "none",
      background: "transparent",
      border: "none",
      outline: "none",
      color: "var(--ink-1)",
      fontFamily: "var(--font-mono)",
      fontSize: "var(--text-sm)",
      padding: "0 34px 0 12px",
      height: "100%",
      cursor: disabled ? "not-allowed" : "pointer"
    }
  }, rest), options.map(o => /*#__PURE__*/React.createElement("option", {
    key: o.value,
    value: o.value,
    style: {
      background: "#0A0F0A",
      color: "#6BFF8E"
    }
  }, o.label))), /*#__PURE__*/React.createElement("span", {
    "aria-hidden": true,
    style: {
      position: "absolute",
      right: 12,
      color: "var(--rain-green)",
      fontSize: 10,
      pointerEvents: "none"
    }
  }, "\u25BC"));
}
Object.assign(__ds_scope, { Select });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Select.jsx", error: String((e && e.message) || e) }); }

// components/core/Stat.jsx
try { (() => {
/**
 * Stat — an oversized CRT numeral readout (WPM, accuracy, streak). Big VT323
 * value with a small terminal label. `accent` recolors value + glow.
 */
function Stat({
  value,
  unit,
  label,
  accent = "green",
  size = "lg",
  align = "center",
  style = {}
}) {
  const colors = {
    green: "var(--rain-green)",
    white: "var(--rain-shine)",
    error: "var(--error)",
    warning: "var(--warning)",
    info: "var(--info)"
  };
  const c = colors[accent] || colors.green;
  const valSize = size === "sm" ? "var(--text-3xl)" : size === "md" ? "var(--text-4xl)" : "var(--text-5xl)";
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      alignItems: align === "center" ? "center" : "flex-start",
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "baseline",
      gap: 6,
      lineHeight: 0.9
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-crt)",
      fontSize: valSize,
      color: c,
      textShadow: "0 0 12px color-mix(in srgb, " + c + " 55%, transparent)"
    }
  }, value), unit && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-crt)",
      fontSize: "var(--text-lg)",
      color: "var(--ink-2)"
    }
  }, unit)), label && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-display)",
      fontSize: "var(--text-2xs)",
      letterSpacing: "var(--tracking-wider)",
      textTransform: "uppercase",
      color: "var(--ink-2)",
      marginTop: 6
    }
  }, label));
}
Object.assign(__ds_scope, { Stat });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Stat.jsx", error: String((e && e.message) || e) }); }

// components/core/Switch.jsx
try { (() => {
/** Switch — a hard-edged terminal toggle. Controlled via `checked` + `onChange`. */
function Switch({
  checked = false,
  onChange,
  disabled = false,
  label,
  style = {}
}) {
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 12,
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.45 : 1,
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    role: "switch",
    "aria-checked": checked,
    onClick: () => !disabled && onChange?.(!checked),
    style: {
      position: "relative",
      width: 46,
      height: 24,
      flexShrink: 0,
      background: checked ? "color-mix(in srgb, var(--rain-green) 22%, transparent)" : "var(--surface-3)",
      border: `1px solid ${checked ? "var(--rain-green)" : "var(--line-bright)"}`,
      borderRadius: "var(--radius-xs)",
      transition: "all var(--dur-fast) var(--ease-out)",
      boxShadow: checked ? "var(--box-glow)" : "none"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      top: 2,
      left: checked ? 24 : 2,
      width: 18,
      height: 18,
      background: checked ? "var(--rain-green)" : "var(--ink-3)",
      boxShadow: checked ? "var(--glow-sm)" : "none",
      transition: "left var(--dur-fast) var(--ease-snap), background var(--dur-fast) var(--ease-out)"
    }
  })), label && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: "var(--text-sm)",
      color: "var(--ink-1)"
    }
  }, label));
}
Object.assign(__ds_scope, { Switch });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Switch.jsx", error: String((e && e.message) || e) }); }

// components/core/Tabs.jsx
try { (() => {
/** Tabs — underlined terminal tab bar. `items` = [{id,label}]; controlled via `value`. */
function Tabs({
  items = [],
  value,
  onChange,
  style = {}
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 4,
      borderBottom: "1px solid var(--line)",
      ...style
    }
  }, items.map(it => {
    const active = it.id === value;
    return /*#__PURE__*/React.createElement("button", {
      key: it.id,
      onClick: () => onChange?.(it.id),
      style: {
        position: "relative",
        background: "transparent",
        border: "none",
        cursor: "pointer",
        padding: "10px 16px",
        marginBottom: -1,
        fontFamily: "var(--font-display)",
        fontSize: "var(--text-xs)",
        letterSpacing: "var(--tracking-wide)",
        textTransform: "uppercase",
        color: active ? "var(--rain-green)" : "var(--ink-2)",
        textShadow: active ? "var(--glow-sm)" : "none",
        borderBottom: `2px solid ${active ? "var(--rain-green)" : "transparent"}`,
        transition: "color var(--dur-fast) var(--ease-out)"
      }
    }, it.label);
  }));
}
Object.assign(__ds_scope, { Tabs });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Tabs.jsx", error: String((e && e.message) || e) }); }

// components/data/Avatar.jsx
try { (() => {
/**
 * Avatar — a square terminal tile showing initials (or an image), with a
 * green phosphor glow. `src` overrides initials when provided.
 */
function Avatar({
  initials = "",
  src,
  size = 34,
  glow = true,
  style = {}
}) {
  const px = typeof size === "number" ? size : {
    sm: 28,
    md: 34,
    lg: 48
  }[size] || 34;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: px,
      height: px,
      flexShrink: 0,
      display: "grid",
      placeItems: "center",
      background: src ? "var(--surface-2)" : "var(--surface-2)",
      border: "1px solid var(--line-bright)",
      borderRadius: "var(--radius-sm)",
      overflow: "hidden",
      boxShadow: glow ? "var(--box-glow)" : "none",
      fontFamily: "var(--font-terminal)",
      fontSize: Math.round(px * 0.4),
      letterSpacing: "0.06em",
      color: "var(--rain-green)",
      textShadow: glow ? "var(--glow-sm)" : "none",
      userSelect: "none",
      ...style
    }
  }, src ? /*#__PURE__*/React.createElement("img", {
    src: src,
    alt: "",
    style: {
      width: "100%",
      height: "100%",
      objectFit: "cover"
    }
  }) : initials.slice(0, 2).toUpperCase());
}
Object.assign(__ds_scope, { Avatar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/Avatar.jsx", error: String((e && e.message) || e) }); }

// components/data/RunChart.jsx
try { (() => {
/**
 * RunChart — a phosphor bar chart of recent runs (profile history). The single
 * peak bar glows brightest; the rest sit dimmed. `values` is an array of
 * numbers; `label` + `peakLabel` caption the chart.
 */
function RunChart({
  values = [],
  label,
  peakLabel,
  height = 120,
  style = {}
}) {
  const peak = Math.max(1, ...values);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      border: "1px solid var(--line)",
      borderRadius: "var(--radius-md)",
      background: "var(--surface-1)",
      padding: "var(--space-5)",
      ...style
    }
  }, (label || peakLabel) && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "baseline",
      justifyContent: "space-between",
      marginBottom: 16
    }
  }, label && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-display)",
      fontSize: "var(--text-2xs)",
      letterSpacing: "var(--tracking-wide)",
      textTransform: "uppercase",
      color: "var(--ink-2)"
    }
  }, label), peakLabel && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: "var(--text-xs)",
      color: "var(--ink-3)"
    }
  }, peakLabel)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "flex-end",
      gap: 8,
      height
    }
  }, values.map((v, i) => {
    const isPeak = v === peak;
    return /*#__PURE__*/React.createElement("div", {
      key: i,
      title: String(v),
      style: {
        flex: 1,
        height: Math.round(v / peak * 100) + "%",
        borderRadius: "2px 2px 0 0",
        background: isPeak ? "var(--rain-green)" : "color-mix(in srgb, var(--rain-green) 42%, var(--surface-3))",
        boxShadow: isPeak ? "var(--glow-sm)" : "none",
        transition: "height var(--dur-med) var(--ease-out)"
      }
    });
  })));
}
Object.assign(__ds_scope, { RunChart });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/RunChart.jsx", error: String((e && e.message) || e) }); }

// components/data/Table.jsx
try { (() => {
/**
 * Table — a terminal data grid / ranked list. `columns` describe cells;
 * rows whose `highlight` is true get a pinned green-tinted "your row" treatment.
 * columns: [{ key, label, width?, align?, mono?, render? }]
 */
function Table({
  columns = [],
  rows = [],
  getRowKey,
  getHighlight,
  style = {}
}) {
  const gridCols = columns.map(c => c.width || "1fr").join(" ");
  const cellBase = {
    padding: "10px 14px",
    fontFamily: "var(--font-mono)",
    fontSize: "var(--text-sm)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap"
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      border: "1px solid var(--line)",
      borderRadius: "var(--radius-md)",
      overflow: "hidden",
      background: "var(--bg-card)",
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: gridCols,
      borderBottom: "1px solid var(--line)",
      background: "var(--surface-1)"
    }
  }, columns.map(c => /*#__PURE__*/React.createElement("div", {
    key: c.key,
    style: {
      ...cellBase,
      fontFamily: "var(--font-display)",
      fontSize: "var(--text-2xs)",
      letterSpacing: "var(--tracking-wide)",
      textTransform: "uppercase",
      color: "var(--ink-2)",
      textAlign: c.align || "left"
    }
  }, c.label))), rows.map((row, i) => {
    const hl = getHighlight ? getHighlight(row) : row.highlight;
    return /*#__PURE__*/React.createElement("div", {
      key: getRowKey ? getRowKey(row) : i,
      style: {
        display: "grid",
        gridTemplateColumns: gridCols,
        alignItems: "center",
        borderBottom: i < rows.length - 1 ? "1px solid var(--line-faint)" : "none",
        background: hl ? "color-mix(in srgb, var(--rain-green) 12%, transparent)" : "transparent",
        boxShadow: hl ? "inset 2px 0 0 var(--rain-green)" : "none"
      }
    }, columns.map(c => /*#__PURE__*/React.createElement("div", {
      key: c.key,
      style: {
        ...cellBase,
        textAlign: c.align || "left",
        fontFamily: c.mono === false ? "var(--font-display)" : "var(--font-mono)",
        color: hl ? "var(--rain-bright)" : c.muted ? "var(--ink-2)" : "var(--ink-1)"
      }
    }, c.render ? c.render(row[c.key], row) : row[c.key])));
  }));
}
Object.assign(__ds_scope, { Table });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/Table.jsx", error: String((e && e.message) || e) }); }

// components/effects/DigitalRain.jsx
try { (() => {
const {
  useRef,
  useEffect
} = React;
/**
 * DigitalRain — the signature GOD_MODE_CODE background.
 * Falling columns of glyphs: a near-white glowing head, a fading green trail.
 * `speed` scales fall rate; `intensity` (0–1) drives density + brightness and
 * is meant to be raised while the user is actively typing.
 */
function DigitalRain({
  speed = 1,
  intensity = 0.65,
  fontSize = 16,
  color = "#00FF41",
  headColor = "#E9FFEE",
  fade = 0.06,
  className = "",
  style = {}
}) {
  const canvasRef = useRef(null);
  const stateRef = useRef({
    speed,
    intensity
  });
  stateRef.current = {
    speed,
    intensity
  };
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const glyphs = "ﾊﾐﾋｰｳｼﾅﾓﾆｻﾜﾂｵﾘｱﾎﾃﾏｹﾒｴｶｷﾑﾕﾗｾﾈｽﾀﾇﾉ0123456789<>=*+-¦｜╌ﾘ:.\"".split("");
    let cols = 0,
      drops = [],
      speeds = [],
      raf = 0,
      last = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    function resize() {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.ceil(rect.width / fontSize);
      drops = new Array(cols).fill(0).map(() => Math.random() * -rect.height / fontSize);
      speeds = new Array(cols).fill(0).map(() => 0.5 + Math.random() * 0.9);
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, rect.width, rect.height);
    }
    function frame(t) {
      const dt = Math.min((t - last) / 16.67, 3) || 1;
      last = t;
      const {
        speed: sp,
        intensity: it
      } = stateRef.current;
      const rect = canvas.getBoundingClientRect();
      // fade previous frame to black — this is what creates the trailing tail
      ctx.fillStyle = `rgba(0,0,0,${fade})`;
      ctx.fillRect(0, 0, rect.width, rect.height);
      ctx.font = `${fontSize}px 'Share Tech Mono', monospace`;
      ctx.textBaseline = "top";
      const activeCols = Math.floor(cols * (0.35 + it * 0.65));
      for (let i = 0; i < cols; i++) {
        if (i > activeCols) continue;
        const x = i * fontSize;
        const y = drops[i] * fontSize;
        const g = glyphs[Math.random() * glyphs.length | 0];
        // head glyph: near-white with heavy bloom
        if (Math.random() > 0.975) {
          ctx.fillStyle = headColor;
          ctx.shadowColor = headColor;
          ctx.shadowBlur = 12;
        } else {
          const bright = 0.55 + it * 0.45;
          ctx.fillStyle = color;
          ctx.globalAlpha = bright;
          ctx.shadowColor = color;
          ctx.shadowBlur = 6;
        }
        if (y > -fontSize) ctx.fillText(g, x, y);
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
        drops[i] += speeds[i] * sp * dt * 0.55;
        if (y > rect.height && Math.random() > 0.975) {
          drops[i] = Math.random() * -20;
          speeds[i] = 0.5 + Math.random() * 0.9;
        }
      }
      raf = requestAnimationFrame(frame);
    }
    resize();
    raf = requestAnimationFrame(frame);
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [fontSize, color, headColor, fade]);
  return /*#__PURE__*/React.createElement("canvas", {
    ref: canvasRef,
    className: className,
    "aria-hidden": "true",
    style: {
      display: "block",
      width: "100%",
      height: "100%",
      background: "#000",
      ...style
    }
  });
}
Object.assign(__ds_scope, { DigitalRain });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/effects/DigitalRain.jsx", error: String((e && e.message) || e) }); }

// components/feedback/EmptyState.jsx
try { (() => {
/**
 * EmptyState — a centered zero-data placeholder: a large dim glyph, a title,
 * a line of copy, and an action (passed as children). Used for first-visit
 * profiles and empty histories.
 */
function EmptyState({
  glyph = "_",
  title,
  description,
  children,
  style = {}
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      textAlign: "center",
      gap: 20,
      padding: "var(--space-8)",
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    "aria-hidden": true,
    style: {
      fontFamily: "var(--font-crt)",
      fontSize: "var(--text-5xl)",
      lineHeight: 0.8,
      color: "var(--ink-3)"
    }
  }, glyph), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-display)",
      fontSize: "var(--text-xl)",
      letterSpacing: "var(--tracking-wide)",
      textTransform: "uppercase",
      color: "var(--ink-max)",
      marginBottom: 8
    }
  }, title), description && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: "var(--text-sm)",
      color: "var(--ink-2)",
      maxWidth: 360,
      lineHeight: "var(--leading-normal)",
      margin: "0 auto"
    }
  }, description)), children);
}
Object.assign(__ds_scope, { EmptyState });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/EmptyState.jsx", error: String((e && e.message) || e) }); }

// components/feedback/FaultState.jsx
try { (() => {
/**
 * FaultState — a full-screen system fault. A giant pulsing glyph in the fault
 * color (error red by default — the one moment red owns the void), a title,
 * a line of copy, and recovery actions (children). Use over dimmed rain.
 */
function FaultState({
  glyph = "!",
  title = "SIGNAL LOST",
  description,
  tone = "error",
  children,
  style = {}
}) {
  const c = tone === "warning" ? "var(--warning)" : tone === "info" ? "var(--info)" : "var(--error)";
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      textAlign: "center",
      gap: 22,
      padding: "var(--space-8)",
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    "aria-hidden": true,
    style: {
      fontFamily: "var(--font-crt)",
      fontSize: "clamp(90px, 16vw, 130px)",
      lineHeight: 0.8,
      color: c,
      textShadow: `0 0 24px color-mix(in srgb, ${c} 70%, transparent)`,
      animation: "gmc-pulse-glow 1.4s steps(2) infinite"
    }
  }, glyph), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-display)",
      fontSize: "var(--text-2xl)",
      letterSpacing: "var(--tracking-wide)",
      color: c,
      marginBottom: 8
    }
  }, title), description && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: "var(--text-sm)",
      color: "var(--ink-2)",
      maxWidth: 360,
      lineHeight: "var(--leading-normal)",
      margin: "0 auto"
    }
  }, description)), children && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 12,
      flexWrap: "wrap",
      justifyContent: "center"
    }
  }, children));
}
Object.assign(__ds_scope, { FaultState });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/FaultState.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Breadcrumb.jsx
try { (() => {
/**
 * Breadcrumb — a terminal path trail, e.g. godmodecode / code / two-sum.
 * items: [{ label, onClick? }]; the last item renders as the active leaf.
 */
function Breadcrumb({
  items = [],
  separator = "/",
  style = {}
}) {
  return /*#__PURE__*/React.createElement("nav", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      fontFamily: "var(--font-mono)",
      fontSize: "var(--text-xs)",
      ...style
    }
  }, items.map((it, i) => {
    const last = i === items.length - 1;
    return /*#__PURE__*/React.createElement(React.Fragment, {
      key: i
    }, it.onClick && !last ? /*#__PURE__*/React.createElement("button", {
      onClick: it.onClick,
      style: {
        background: "none",
        border: "none",
        padding: 0,
        cursor: "pointer",
        fontFamily: "inherit",
        fontSize: "inherit",
        color: "var(--ink-2)"
      }
    }, it.label) : /*#__PURE__*/React.createElement("span", {
      style: {
        color: last ? "var(--rain-green)" : "var(--ink-2)",
        textShadow: last ? "var(--glow-sm)" : "none"
      }
    }, it.label), !last && /*#__PURE__*/React.createElement("span", {
      "aria-hidden": true,
      style: {
        color: "var(--ink-3)"
      }
    }, separator));
  }));
}
Object.assign(__ds_scope, { Breadcrumb });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Breadcrumb.jsx", error: String((e && e.message) || e) }); }

// components/navigation/SettingRow.jsx
try { (() => {
/**
 * SettingRow — a labeled row with a description and a trailing control
 * (Switch, Select, Button…). The workhorse of the Settings screen.
 */
function SettingRow({
  label,
  description,
  children,
  divider = true,
  style = {}
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "var(--space-5)",
      padding: "16px 0",
      borderBottom: divider ? "1px solid var(--line-faint)" : "none",
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-display)",
      fontSize: "var(--text-sm)",
      letterSpacing: "var(--tracking-wide)",
      textTransform: "uppercase",
      color: "var(--ink-max)"
    }
  }, label), description && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: "var(--text-xs)",
      color: "var(--ink-2)",
      marginTop: 4,
      lineHeight: "var(--leading-snug)"
    }
  }, description)), /*#__PURE__*/React.createElement("div", {
    style: {
      flexShrink: 0
    }
  }, children));
}
Object.assign(__ds_scope, { SettingRow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/SettingRow.jsx", error: String((e && e.message) || e) }); }

// components/typing/ChallengeCard.jsx
try { (() => {
/**
 * ChallengeCard — a selectable challenge-category tile (Quotes / Code / Prose).
 * `glyph` is a short symbol or icon node; interactive lift on hover.
 */
function ChallengeCard({
  glyph,
  title,
  description,
  meta,
  selected = false,
  size = "md",
  onClick,
  style = {}
}) {
  const compact = size === "sm";
  return /*#__PURE__*/React.createElement(__ds_scope.Card, {
    interactive: true,
    onClick: onClick,
    padding: compact ? "var(--space-4)" : "var(--space-5)",
    style: {
      display: "flex",
      flexDirection: "column",
      gap: compact ? 8 : 12,
      minHeight: compact ? 108 : 168,
      borderColor: selected ? "var(--rain-green)" : "var(--border-color)",
      background: selected ? "color-mix(in srgb, var(--rain-green) 9%, var(--bg-card))" : "var(--bg-card)",
      boxShadow: selected ? "0 0 0 1.5px var(--rain-green), var(--box-glow), var(--elev-1)" : "var(--elev-1)",
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "space-between"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-crt)",
      fontSize: compact ? "var(--text-2xl)" : "var(--text-3xl)",
      color: "var(--rain-green)",
      textShadow: "var(--glow-md)",
      lineHeight: 1
    }
  }, glyph), meta && /*#__PURE__*/React.createElement(__ds_scope.Badge, {
    tone: "neutral"
  }, meta)), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: "auto"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-display)",
      fontSize: compact ? "var(--text-md)" : "var(--text-lg)",
      color: "var(--ink-max)",
      letterSpacing: "var(--tracking-wide)",
      textTransform: "uppercase"
    }
  }, title), description && !compact && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: "var(--text-xs)",
      color: "var(--ink-2)",
      marginTop: 6,
      lineHeight: "var(--leading-snug)"
    }
  }, description)));
}
Object.assign(__ds_scope, { ChallengeCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/typing/ChallengeCard.jsx", error: String((e && e.message) || e) }); }

// components/typing/CodeStub.jsx
try { (() => {
/**
 * CodeStub — a line-numbered editor surface for the Code discipline. Renders
 * a gutter of line numbers beside monospace lines; when `caret` is true the
 * active line shows a blinking block caret at the end of its text. Pass
 * `lines` (array of strings) for a filled stub, or leave empty for a bare start.
 */
function CodeStub({
  lines = [""],
  activeLine = 0,
  caret = true,
  minLines = 6,
  style = {}
}) {
  const rows = lines.length < minLines ? [...lines, ...Array(minLines - lines.length).fill("")] : lines;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      background: "var(--surface-1)",
      border: "1px solid var(--line)",
      borderRadius: "var(--radius-md)",
      overflow: "hidden",
      fontFamily: "var(--font-mono)",
      fontSize: "var(--text-sm)",
      lineHeight: "var(--leading-loose)",
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    "aria-hidden": true,
    style: {
      padding: "14px 12px",
      textAlign: "right",
      color: "var(--ink-3)",
      userSelect: "none",
      background: "color-mix(in srgb, var(--void) 40%, transparent)",
      borderRight: "1px solid var(--line-faint)",
      minWidth: 44
    }
  }, rows.map((_, i) => /*#__PURE__*/React.createElement("div", {
    key: i
  }, String(i + 1).padStart(2, "0")))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "14px 16px",
      flex: 1,
      overflow: "auto",
      color: "var(--ink-1)"
    }
  }, rows.map((ln, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      whiteSpace: "pre",
      minHeight: "1.9em",
      background: i === activeLine ? "color-mix(in srgb, var(--rain-green) 7%, transparent)" : "transparent",
      color: i === activeLine ? "var(--rain-bright)" : "var(--ink-1)"
    }
  }, ln, caret && i === activeLine && /*#__PURE__*/React.createElement("span", {
    "aria-hidden": true,
    style: {
      display: "inline-block",
      width: 2,
      height: "1em",
      verticalAlign: "text-bottom",
      marginLeft: 1,
      background: "var(--rain-green)",
      boxShadow: "var(--glow-md)",
      animation: "gmc-caret 1s steps(1) infinite"
    }
  })))));
}
Object.assign(__ds_scope, { CodeStub });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/typing/CodeStub.jsx", error: String((e && e.message) || e) }); }

// components/typing/Countdown.jsx
try { (() => {
/**
 * Countdown — the pre-run "GET READY" screen. An oversized CRT numeral with a
 * white-cored shine glow, an optional discipline badge, and a dimmed passage
 * preview. Presentational: drive `count` (3 → 2 → 1) from a timer.
 */
function Countdown({
  count = 3,
  label = "GET READY",
  tag,
  preview,
  style = {}
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      textAlign: "center",
      ...style
    }
  }, tag && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-display)",
      fontSize: "var(--text-2xs)",
      letterSpacing: "var(--tracking-wide)",
      textTransform: "uppercase",
      color: "var(--ink-2)",
      border: "1px solid var(--line-bright)",
      padding: "4px 12px",
      borderRadius: "var(--radius-pill)",
      marginBottom: 8
    }
  }, tag), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-display)",
      fontSize: "var(--text-sm)",
      letterSpacing: "var(--tracking-wider)",
      textTransform: "uppercase",
      color: "var(--ink-2)"
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-crt)",
      fontSize: "clamp(120px, 22vw, 200px)",
      lineHeight: 0.8,
      color: "var(--rain-shine)",
      textShadow: "0 0 40px var(--rain-green), 0 0 12px #fff"
    }
  }, count), preview && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: "var(--text-sm)",
      color: "var(--ink-3)",
      opacity: 0.85,
      maxWidth: 440,
      marginTop: 6,
      filter: "blur(0.3px)"
    }
  }, preview), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: "var(--text-xs)",
      color: "var(--ink-3)",
      marginTop: 18
    }
  }, "start typing to begin the clock"));
}
Object.assign(__ds_scope, { Countdown });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/typing/Countdown.jsx", error: String((e && e.message) || e) }); }

// components/typing/ResultPanel.jsx
try { (() => {
/**
 * ResultPanel — the end-of-run summary. A grid of Stat readouts (WPM,
 * accuracy, time, errors) under a headline verdict.
 */
function ResultPanel({
  wpm,
  accuracy,
  time,
  errors,
  verdict = "RUN COMPLETE",
  isBest = false,
  style = {}
}) {
  return /*#__PURE__*/React.createElement(__ds_scope.Card, {
    glow: true,
    scanlines: true,
    padding: "var(--space-6)",
    style: {
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      marginBottom: "var(--space-5)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-display)",
      fontSize: "var(--text-xl)",
      letterSpacing: "var(--tracking-wide)",
      color: "var(--ink-max)",
      textTransform: "uppercase",
      textShadow: "var(--glow-sm)"
    }
  }, verdict), isBest && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-display)",
      fontSize: "var(--text-2xs)",
      letterSpacing: "var(--tracking-wider)",
      color: "var(--warning)",
      textTransform: "uppercase",
      border: "1px solid color-mix(in srgb, var(--warning) 45%, transparent)",
      padding: "3px 8px",
      borderRadius: "var(--radius-pill)"
    }
  }, "New Best")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(4, 1fr)",
      gap: "var(--space-4)"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Stat, {
    value: wpm,
    unit: "wpm",
    label: "Speed",
    size: "md"
  }), /*#__PURE__*/React.createElement(__ds_scope.Stat, {
    value: accuracy,
    unit: "%",
    label: "Accuracy",
    size: "md",
    accent: accuracy >= 97 ? "green" : accuracy >= 90 ? "warning" : "error"
  }), /*#__PURE__*/React.createElement(__ds_scope.Stat, {
    value: time,
    unit: "s",
    label: "Time",
    size: "md",
    accent: "white"
  }), /*#__PURE__*/React.createElement(__ds_scope.Stat, {
    value: errors,
    label: "Errors",
    size: "md",
    accent: errors === 0 ? "green" : "error"
  })));
}
Object.assign(__ds_scope, { ResultPanel });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/typing/ResultPanel.jsx", error: String((e && e.message) || e) }); }

// components/typing/TypingField.jsx
try { (() => {
/**
 * TypingField — the core typing surface. Renders the target `text` overlaid
 * with the user's `typed` progress: correct glyphs glow green, mistakes flash
 * red, the active glyph carries a blinking block caret, untyped glyphs sit dim.
 * Purely presentational — feed it `text` and `typed` (the substring entered).
 */
function TypingField({
  text = "",
  typed = "",
  size = "lg",
  style = {}
}) {
  const fontSize = size === "sm" ? "var(--text-md)" : size === "md" ? "var(--text-lg)" : "var(--text-xl)";
  const chars = text.split("");
  return /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-mono)",
      fontSize,
      lineHeight: "var(--leading-loose)",
      letterSpacing: "0.02em",
      color: "var(--ink-3)",
      wordBreak: "break-word",
      whiteSpace: "pre-wrap",
      ...style
    }
  }, chars.map((ch, i) => {
    const done = i < typed.length;
    const isCurrent = i === typed.length;
    const correct = done && typed[i] === ch;
    const wrong = done && typed[i] !== ch;
    let color = "var(--ink-3)",
      background = "transparent",
      textShadow = "none";
    if (correct) {
      color = "var(--rain-green)";
      textShadow = "var(--glow-sm)";
    }
    if (wrong) {
      color = "var(--rain-shine)";
      background = "color-mix(in srgb, var(--error) 45%, transparent)";
    }
    return /*#__PURE__*/React.createElement("span", {
      key: i,
      style: {
        position: "relative",
        color,
        background,
        textShadow,
        borderRadius: 1,
        transition: "color 60ms linear, text-shadow 60ms linear"
      }
    }, isCurrent && /*#__PURE__*/React.createElement("span", {
      "aria-hidden": true,
      style: {
        position: "absolute",
        left: -1,
        top: "0.12em",
        bottom: "0.12em",
        width: 2,
        background: "var(--rain-green)",
        boxShadow: "var(--glow-md)",
        animation: "gmc-caret 1s steps(1) infinite"
      }
    }), ch === " " && wrong ? "␣" : ch);
  }), typed.length >= text.length && /*#__PURE__*/React.createElement("span", {
    "aria-hidden": true,
    style: {
      display: "inline-block",
      width: 2,
      height: "1em",
      verticalAlign: "text-bottom",
      background: "var(--rain-green)",
      boxShadow: "var(--glow-md)",
      animation: "gmc-caret 1s steps(1) infinite"
    }
  }));
}
Object.assign(__ds_scope, { TypingField });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/typing/TypingField.jsx", error: String((e && e.message) || e) }); }

// ui_kits/god_mode_code/App.jsx
try { (() => {
// App orchestrator — ties screens together over the digital rain.
const {
  DigitalRain,
  Countdown
} = window.GODMODECODEDesignSystem_ca0aa4;
function App() {
  const [screen, setScreen] = React.useState("auth"); // auth | home | countdown | run | code | result | leaderboard | settings | profile
  const [nav, setNav] = React.useState("practice");
  const [category, setCategory] = React.useState("code");
  const [result, setResult] = React.useState(null);
  const [count, setCount] = React.useState(3);
  const [intensity, setIntensity] = React.useState(0.5);
  const [speed, setSpeed] = React.useState(1);
  React.useEffect(() => {
    const active = screen === "run" || screen === "code";
    setIntensity(active ? 0.75 : screen === "countdown" ? 0.72 : screen === "result" ? 0.4 : screen === "auth" ? 0.4 : 0.5);
    setSpeed(active ? 1.5 : screen === "countdown" ? 1.25 : 1);
  }, [screen]);

  // Countdown 3 → 1 then into the run.
  React.useEffect(() => {
    if (screen !== "countdown") return;
    setCount(3);
    let n = 3;
    const id = setInterval(() => {
      n -= 1;
      if (n <= 0) {
        clearInterval(id);
        setScreen(category === "code" ? "code" : "run");
      } else setCount(n);
    }, 800);
    return () => clearInterval(id);
  }, [screen, category]);
  function start(cat) {
    setCategory(cat);
    setScreen("countdown");
  }
  function done(r) {
    setResult(r);
    setScreen("result");
  }
  function goNav(id) {
    setNav(id === "profile" ? "profile" : id);
    setScreen(id === "leaderboard" ? "leaderboard" : id === "about" ? "settings" : id === "profile" ? "profile" : "home");
  }
  React.useEffect(() => {
    window.lucide && window.lucide.createIcons();
  });
  if (screen === "auth") {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        position: "relative",
        minHeight: "100vh",
        background: "var(--void)"
      }
    }, /*#__PURE__*/React.createElement(DigitalRain, {
      intensity: 0.4,
      speed: 0.9,
      style: {
        position: "fixed",
        inset: 0,
        zIndex: 0,
        opacity: 0.55
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        position: "relative",
        zIndex: 10
      }
    }, /*#__PURE__*/React.createElement(AuthScreen, {
      onEnter: () => setScreen("home")
    })));
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      minHeight: "100vh",
      background: "var(--void)"
    }
  }, /*#__PURE__*/React.createElement(DigitalRain, {
    intensity: intensity,
    speed: speed,
    style: {
      position: "fixed",
      inset: 0,
      zIndex: 0,
      opacity: 0.55
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      zIndex: 10,
      minHeight: "100vh"
    }
  }, /*#__PURE__*/React.createElement(Header, {
    nav: nav,
    onNav: goNav
  }), screen === "home" && /*#__PURE__*/React.createElement(HomeScreen, {
    onStart: start
  }), screen === "countdown" && /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: "70vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }
  }, /*#__PURE__*/React.createElement(Countdown, {
    count: count,
    tag: category.toUpperCase()
  })), screen === "run" && /*#__PURE__*/React.createElement(RunScreen, {
    category: category,
    onDone: done,
    onExit: () => setScreen("home"),
    onIntensity: setIntensity
  }), screen === "code" && /*#__PURE__*/React.createElement(CodeScreen, {
    onDone: done,
    onExit: () => setScreen("home")
  }), screen === "leaderboard" && /*#__PURE__*/React.createElement(LeaderboardScreen, null), screen === "settings" && /*#__PURE__*/React.createElement(SettingsScreen, null), screen === "profile" && /*#__PURE__*/React.createElement(ProfileScreen, null), screen === "result" && /*#__PURE__*/React.createElement(ResultScreen, {
    result: result,
    onRetry: () => start(category),
    onHome: () => setScreen("home")
  })));
}
ReactDOM.createRoot(document.getElementById("root")).render(/*#__PURE__*/React.createElement(App, null));
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/god_mode_code/App.jsx", error: String((e && e.message) || e) }); }

// ui_kits/god_mode_code/AuthScreen.jsx
try { (() => {
// Access gate — "Jack in". Composes Wordmark + Input + Button.
const {
  Wordmark,
  Input,
  Button
} = window.GODMODECODEDesignSystem_ca0aa4;
function AuthScreen({
  onEnter
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 40
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 400,
      background: "color-mix(in srgb, var(--surface-2) 80%, transparent)",
      border: "1px solid var(--line-bright)",
      borderRadius: "var(--radius-md)",
      boxShadow: "var(--box-glow)",
      padding: "38px 34px",
      textAlign: "center"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "center",
      marginBottom: 24
    }
  }, /*#__PURE__*/React.createElement(Wordmark, {
    size: 18
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-terminal)",
      fontSize: "var(--text-xl)",
      letterSpacing: "0.1em",
      color: "var(--ink-max)",
      textShadow: "var(--glow-sm)",
      marginBottom: 6
    }
  }, "JACK IN"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: "var(--text-xs)",
      color: "var(--ink-2)",
      marginBottom: 26
    }
  }, "enter the grid \u2014 the rain is waiting"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 14,
      textAlign: "left"
    }
  }, /*#__PURE__*/React.createElement(Input, {
    prefix: ">",
    defaultValue: "neo_anderson",
    placeholder: "operator handle"
  }), /*#__PURE__*/React.createElement(Input, {
    prefix: "#",
    type: "password",
    defaultValue: "\xB7\xB7\xB7\xB7\xB7\xB7\xB7\xB7",
    placeholder: "access key"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 6
    }
  }, /*#__PURE__*/React.createElement(Button, {
    size: "lg",
    block: true,
    onClick: onEnter
  }, "Enter the Grid")), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      fontFamily: "var(--font-mono)",
      fontSize: "var(--text-2xs)",
      color: "var(--ink-3)",
      marginTop: 4
    }
  }, "no identity yet? ", /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => {
      e.preventDefault();
      onEnter();
    }
  }, "create one")))));
}
Object.assign(window, {
  AuthScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/god_mode_code/AuthScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/god_mode_code/CodeScreen.jsx
try { (() => {
// Code discipline screen — breadcrumb + line-numbered CodeStub the user types into.
const {
  Breadcrumb,
  CodeStub,
  Stat,
  Card,
  Button,
  IconButton,
  Badge
} = window.GODMODECODEDesignSystem_ca0aa4;
const SOLUTION = ["function twoSum(nums, target) {", "  const seen = new Map();", "  for (let i = 0; i < nums.length; i++) {", "    const need = target - nums[i];", "    if (seen.has(need)) return [seen.get(need), i];", "    seen.set(nums[i], i);", "  }", "}"];
function CodeScreen({
  onExit,
  onDone
}) {
  const flat = SOLUTION.join("\n");
  const [typed, setTyped] = React.useState("");
  const [startAt, setStartAt] = React.useState(null);
  const wrapRef = React.useRef(null);
  React.useEffect(() => {
    wrapRef.current?.focus();
  }, []);

  // Derive rendered lines + active line from typed length.
  const typedLines = typed.split("\n");
  const activeLine = typedLines.length - 1;
  const renderLines = SOLUTION.map((ln, i) => i < typedLines.length ? typedLines[i] : "");
  const elapsed = startAt ? (Date.now() - startAt) / 1000 : 0;
  const wpm = elapsed > 0.5 ? Math.round(typed.length / 5 / elapsed * 60) : 0;
  const pct = Math.round(typed.length / flat.length * 100);
  function handleKey(e) {
    if (e.key === "Escape") {
      onExit();
      return;
    }
    if (e.metaKey || e.ctrlKey) return;
    if (e.key === "Backspace") {
      setTyped(t => t.slice(0, -1));
      e.preventDefault();
      return;
    }
    let ch = null;
    if (e.key === "Enter") ch = "\n";else if (e.key === "Tab") {
      ch = "  ";
    } else if (e.key.length === 1) ch = e.key;
    if (ch == null) return;
    e.preventDefault();
    if (!startAt) setStartAt(Date.now());
    const next = typed + ch;
    setTyped(next);
    if (next.length >= flat.length) onDone?.({
      wpm,
      accuracy: 97.8,
      time: Math.round(elapsed),
      errors: 2
    });
  }
  return /*#__PURE__*/React.createElement("div", {
    ref: wrapRef,
    tabIndex: 0,
    onKeyDown: handleKey,
    style: {
      outline: "none",
      maxWidth: 860,
      margin: "0 auto",
      padding: "36px 28px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement(Breadcrumb, {
    items: [{
      label: "godmodecode",
      onClick: onExit
    }, {
      label: "code",
      onClick: onExit
    }, {
      label: "two-sum"
    }]
  }), /*#__PURE__*/React.createElement(IconButton, {
    label: "Abort (Esc)",
    variant: "outline",
    onClick: onExit
  }, /*#__PURE__*/React.createElement("i", {
    "data-lucide": "x"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      fontFamily: "var(--font-terminal)",
      fontSize: "var(--text-xl)",
      letterSpacing: "0.06em",
      color: "var(--ink-max)"
    }
  }, "TWO SUM"), /*#__PURE__*/React.createElement(Badge, {
    tone: "neutral"
  }, "easy"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginLeft: "auto",
      display: "flex",
      gap: 28
    }
  }, /*#__PURE__*/React.createElement(Stat, {
    value: wpm,
    unit: "wpm",
    label: "Speed",
    size: "sm",
    align: "left"
  }), /*#__PURE__*/React.createElement(Stat, {
    value: pct,
    unit: "%",
    label: "Done",
    size: "sm",
    align: "left",
    accent: "white"
  }))), /*#__PURE__*/React.createElement(CodeStub, {
    lines: renderLines,
    activeLine: Math.min(activeLine, SOLUTION.length - 1),
    minLines: SOLUTION.length
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      marginTop: 16,
      fontFamily: "var(--font-mono)",
      fontSize: "var(--text-xs)",
      color: "var(--ink-3)"
    }
  }, startAt ? "⏎ for newline · Tab indents" : "start typing the solution to begin"));
}
Object.assign(window, {
  CodeScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/god_mode_code/CodeScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/god_mode_code/Header.jsx
try { (() => {
// Header chrome + wordmark for the GOD_MODE_CODE site.
const {
  IconButton,
  Wordmark,
  Avatar
} = window.GODMODECODEDesignSystem_ca0aa4;
function Header({
  nav = "practice",
  onNav
}) {
  const items = [["practice", "Practice"], ["leaderboard", "Leaderboard"], ["about", "Settings"]];
  return /*#__PURE__*/React.createElement("header", {
    style: {
      position: "relative",
      zIndex: 20,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "16px 28px",
      borderBottom: "1px solid var(--line)",
      background: "color-mix(in srgb, var(--void) 72%, transparent)",
      backdropFilter: "blur(4px)"
    }
  }, /*#__PURE__*/React.createElement(Wordmark, {
    size: 18
  }), /*#__PURE__*/React.createElement("nav", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 4
    }
  }, items.map(([id, label]) => /*#__PURE__*/React.createElement("button", {
    key: id,
    onClick: () => onNav?.(id),
    style: {
      background: "none",
      border: "none",
      cursor: "pointer",
      padding: "8px 14px",
      fontFamily: "var(--font-terminal)",
      fontSize: "var(--text-xs)",
      letterSpacing: "var(--tracking-wide)",
      textTransform: "uppercase",
      color: nav === id ? "var(--rain-green)" : "var(--ink-2)",
      textShadow: nav === id ? "var(--glow-sm)" : "none"
    }
  }, label)), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 1,
      height: 22,
      background: "var(--line)",
      margin: "0 10px"
    }
  }), /*#__PURE__*/React.createElement(IconButton, {
    label: "Settings",
    onClick: () => onNav?.("about")
  }, /*#__PURE__*/React.createElement("i", {
    "data-lucide": "settings"
  })), /*#__PURE__*/React.createElement("button", {
    onClick: () => onNav?.("profile"),
    style: {
      background: "none",
      border: "none",
      padding: 0,
      marginLeft: 4,
      cursor: "pointer"
    },
    "aria-label": "Profile"
  }, /*#__PURE__*/React.createElement(Avatar, {
    initials: "YU",
    glow: nav === "profile"
  }))));
}
Object.assign(window, {
  Header
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/god_mode_code/Header.jsx", error: String((e && e.message) || e) }); }

// ui_kits/god_mode_code/HomeScreen.jsx
try { (() => {
// Home / challenge-selection screen.
const {
  ChallengeCard,
  Tabs,
  Button,
  Kbd,
  Badge
} = window.GODMODECODEDesignSystem_ca0aa4;
function HomeScreen({
  onStart
}) {
  const [cat, setCat] = React.useState("code");
  const cats = window.CHALLENGES;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 980,
      margin: "0 auto",
      padding: "56px 28px 40px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      marginBottom: 44
    }
  }, /*#__PURE__*/React.createElement(Badge, {
    tone: "green",
    dot: true,
    style: {
      marginBottom: 18
    }
  }, "System online"), /*#__PURE__*/React.createElement("h1", {
    style: {
      fontFamily: "var(--font-terminal)",
      fontSize: "var(--text-4xl)",
      letterSpacing: "0.06em",
      color: "var(--ink-max)",
      textShadow: "var(--glow-md)",
      marginBottom: 14
    }
  }, "HOW FAST CAN YOU TYPE?"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: "var(--text-md)",
      color: "var(--ink-2)",
      maxWidth: 560,
      margin: "0 auto",
      lineHeight: "var(--leading-snug)"
    }
  }, "Pick a discipline. The rain falls while you type. Beat your best WPM.")), /*#__PURE__*/React.createElement(Tabs, {
    value: cat,
    onChange: setCat,
    style: {
      justifyContent: "center",
      marginBottom: 26
    },
    items: Object.values(cats).map(c => ({
      id: c.id,
      label: c.title
    }))
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(3, 1fr)",
      gap: 18,
      marginBottom: 34
    }
  }, Object.values(cats).map(c => /*#__PURE__*/React.createElement(ChallengeCard, {
    key: c.id,
    glyph: c.glyph,
    title: c.title,
    description: c.description,
    meta: c.meta,
    selected: c.id === cat,
    onClick: () => setCat(c.id)
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(Button, {
    size: "lg",
    onClick: () => onStart(cat)
  }, "Start Run"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: "var(--text-xs)",
      color: "var(--ink-3)"
    }
  }, "or hit ", /*#__PURE__*/React.createElement(Kbd, null, "\u23CE"), " to begin \xB7 ", /*#__PURE__*/React.createElement(Kbd, {
    wide: true
  }, "Esc"), " to reset")));
}
Object.assign(window, {
  HomeScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/god_mode_code/HomeScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/god_mode_code/LeaderboardScreen.jsx
try { (() => {
// Leaderboard screen — full ranked table with your-row pinned.
const {
  Table,
  Avatar,
  Tabs,
  Card,
  Badge
} = window.GODMODECODEDesignSystem_ca0aa4;
const FULL_BOARD = [{
  rank: 1,
  user: "neo_anderson",
  wpm: 148,
  acc: 99.2,
  runs: 1204
}, {
  rank: 2,
  user: "trinity",
  wpm: 141,
  acc: 98.7,
  runs: 903
}, {
  rank: 3,
  user: "morpheus",
  wpm: 133,
  acc: 99.9,
  runs: 1560
}, {
  rank: 4,
  user: "cypher",
  wpm: 128,
  acc: 94.1,
  runs: 421
}, {
  rank: 5,
  user: "you",
  wpm: 112,
  acc: 98.4,
  runs: 88
}, {
  rank: 6,
  user: "tank",
  wpm: 109,
  acc: 96.0,
  runs: 210
}, {
  rank: 7,
  user: "dozer",
  wpm: 104,
  acc: 97.3,
  runs: 143
}, {
  rank: 8,
  user: "switch",
  wpm: 98,
  acc: 95.5,
  runs: 77
}];
function LeaderboardScreen() {
  const [scope, setScope] = React.useState("code");
  return /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 820,
      margin: "0 auto",
      padding: "48px 28px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 22
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      fontFamily: "var(--font-terminal)",
      fontSize: "var(--text-2xl)",
      letterSpacing: "0.08em",
      color: "var(--ink-max)",
      textShadow: "var(--glow-sm)"
    }
  }, "GLOBAL LEADERBOARD"), /*#__PURE__*/React.createElement(Badge, {
    tone: "green",
    dot: true
  }, "live")), /*#__PURE__*/React.createElement(Tabs, {
    value: scope,
    onChange: setScope,
    style: {
      marginBottom: 20
    },
    items: [{
      id: "quotes",
      label: "Quotes"
    }, {
      id: "code",
      label: "Code"
    }, {
      id: "prose",
      label: "Prose"
    }]
  }), /*#__PURE__*/React.createElement(Table, {
    columns: [{
      key: "rank",
      label: "#",
      width: "52px",
      align: "center"
    }, {
      key: "user",
      label: "User",
      render: v => /*#__PURE__*/React.createElement("span", {
        style: {
          display: "inline-flex",
          alignItems: "center",
          gap: 10
        }
      }, /*#__PURE__*/React.createElement(Avatar, {
        initials: v.slice(0, 2),
        size: 26,
        glow: false
      }), v)
    }, {
      key: "wpm",
      label: "WPM",
      width: "90px",
      align: "right"
    }, {
      key: "acc",
      label: "Acc",
      width: "80px",
      align: "right",
      muted: true,
      render: v => v + "%"
    }, {
      key: "runs",
      label: "Runs",
      width: "80px",
      align: "right",
      muted: true
    }],
    rows: FULL_BOARD,
    getRowKey: r => r.rank,
    getHighlight: r => r.user === "you"
  }));
}
Object.assign(window, {
  LeaderboardScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/god_mode_code/LeaderboardScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/god_mode_code/ProfileScreen.jsx
try { (() => {
// Profile screen — Avatar + streak Badge + CRT Stat readouts + RunChart.
const {
  Avatar,
  Badge,
  Stat,
  RunChart,
  Card
} = window.GODMODECODEDesignSystem_ca0aa4;
function ProfileScreen() {
  const runs = [96, 104, 88, 118, 110, 126, 121, 133, 119, 140, 131, 148, 129, 136];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 900,
      margin: "0 auto",
      padding: "40px 28px",
      display: "flex",
      flexDirection: "column",
      gap: 22
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 18
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    initials: "YU",
    size: 64
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-terminal)",
      fontSize: "var(--text-xl)",
      letterSpacing: "0.08em",
      color: "var(--ink-max)"
    }
  }, "you"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: "var(--text-xs)",
      color: "var(--ink-2)",
      marginTop: 2
    }
  }, "jacked in 42 days ago \xB7 88 runs logged")), /*#__PURE__*/React.createElement(Badge, {
    tone: "green",
    dot: true
  }, "7-day streak")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(3, 1fr)",
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(Card, {
    padding: "var(--space-5)"
  }, /*#__PURE__*/React.createElement(Stat, {
    value: 112,
    unit: "wpm",
    label: "All-time best",
    size: "md",
    align: "left"
  })), /*#__PURE__*/React.createElement(Card, {
    padding: "var(--space-5)"
  }, /*#__PURE__*/React.createElement(Stat, {
    value: 98,
    unit: "wpm",
    label: "30-day avg",
    size: "md",
    align: "left"
  })), /*#__PURE__*/React.createElement(Card, {
    padding: "var(--space-5)"
  }, /*#__PURE__*/React.createElement(Stat, {
    value: "98.4",
    unit: "%",
    label: "Best accuracy",
    size: "md",
    align: "left",
    accent: "warning"
  }))), /*#__PURE__*/React.createElement(RunChart, {
    values: runs,
    label: "Last 14 runs \xB7 WPM",
    peakLabel: "peak " + Math.max(...runs)
  }));
}
Object.assign(window, {
  ProfileScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/god_mode_code/ProfileScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/god_mode_code/ResultScreen.jsx
try { (() => {
// Results screen — run summary + leaderboard.
const {
  ResultPanel,
  Button,
  Card,
  Badge
} = window.GODMODECODEDesignSystem_ca0aa4;
function Leaderboard() {
  return /*#__PURE__*/React.createElement(Card, {
    padding: "var(--space-5)"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-terminal)",
      fontSize: "var(--text-sm)",
      letterSpacing: "var(--tracking-wide)",
      textTransform: "uppercase",
      color: "var(--ink-max)",
      marginBottom: 16
    }
  }, "Global Leaderboard"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 2
    }
  }, window.LEADERBOARD.map(r => {
    const me = r.user === "you";
    return /*#__PURE__*/React.createElement("div", {
      key: r.rank,
      style: {
        display: "grid",
        gridTemplateColumns: "28px 1fr auto auto",
        alignItems: "center",
        gap: 14,
        padding: "9px 12px",
        borderRadius: "var(--radius-sm)",
        background: me ? "color-mix(in srgb, var(--rain-green) 10%, transparent)" : "transparent",
        border: me ? "1px solid color-mix(in srgb, var(--rain-green) 40%, transparent)" : "1px solid transparent"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: "var(--font-crt)",
        fontSize: "var(--text-lg)",
        color: r.rank <= 3 ? "var(--rain-green)" : "var(--ink-3)"
      }
    }, r.rank), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: "var(--font-mono)",
        fontSize: "var(--text-sm)",
        color: me ? "var(--rain-bright)" : "var(--ink-1)"
      }
    }, r.user, me && " ←"), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: "var(--font-crt)",
        fontSize: "var(--text-lg)",
        color: "var(--ink-max)"
      }
    }, r.wpm, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: "var(--text-xs)",
        color: "var(--ink-3)",
        fontFamily: "var(--font-mono)"
      }
    }, " wpm")), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: "var(--font-mono)",
        fontSize: "var(--text-xs)",
        color: "var(--ink-2)",
        minWidth: 46,
        textAlign: "right"
      }
    }, r.acc, "%"));
  })));
}
function ResultScreen({
  result,
  onRetry,
  onHome
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 820,
      margin: "0 auto",
      padding: "48px 28px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      marginBottom: 28
    }
  }, /*#__PURE__*/React.createElement(Badge, {
    tone: "warning",
    style: {
      marginBottom: 14
    }
  }, "Run logged")), /*#__PURE__*/React.createElement(ResultPanel, {
    wpm: result.wpm,
    accuracy: result.accuracy,
    time: result.time,
    errors: result.errors,
    isBest: result.wpm >= 110,
    style: {
      marginBottom: 22
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 26
    }
  }, /*#__PURE__*/React.createElement(Leaderboard, null)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "center",
      gap: 14
    }
  }, /*#__PURE__*/React.createElement(Button, {
    size: "lg",
    onClick: onRetry
  }, "Run Again"), /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    size: "lg",
    onClick: onHome
  }, "Change Mode")));
}
Object.assign(window, {
  ResultScreen,
  Leaderboard
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/god_mode_code/ResultScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/god_mode_code/RunScreen.jsx
try { (() => {
// Active typing run — real keyboard input drives the TypingField + live stats.
const {
  TypingField,
  Stat,
  ProgressBar,
  Button,
  Card,
  IconButton
} = window.GODMODECODEDesignSystem_ca0aa4;
function RunScreen({
  category,
  onDone,
  onExit,
  onIntensity
}) {
  const passages = window.CHALLENGES[category].passages;
  const [text] = React.useState(() => passages[Math.floor(Math.random() * passages.length)]);
  const [typed, setTyped] = React.useState("");
  const [startAt, setStartAt] = React.useState(null);
  const [now, setNow] = React.useState(0);
  const [errors, setErrors] = React.useState(0);
  const wrapRef = React.useRef(null);
  const elapsed = startAt ? (now - startAt) / 1000 : 0;
  const words = typed.length / 5;
  const wpm = elapsed > 0.5 ? Math.round(words / elapsed * 60) : 0;
  const correctCount = typed.split("").filter((ch, i) => ch === text[i]).length;
  const accuracy = typed.length ? Math.round(correctCount / typed.length * 1000) / 10 : 100;
  React.useEffect(() => {
    wrapRef.current?.focus();
  }, []);
  React.useEffect(() => {
    if (!startAt) return;
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [startAt]);

  // Feed the rain: faster typing -> higher intensity.
  React.useEffect(() => {
    onIntensity?.(startAt ? Math.min(1, 0.6 + wpm / 220) : 0.7);
  }, [wpm, startAt]);
  function handleKey(e) {
    if (e.key === "Escape") {
      onExit();
      return;
    }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === "Backspace") {
      setTyped(t => t.slice(0, -1));
      e.preventDefault();
      return;
    }
    if (e.key.length !== 1) return;
    e.preventDefault();
    if (!startAt) setStartAt(Date.now());
    const next = typed + e.key;
    if (e.key !== text[typed.length]) setErrors(n => n + 1);
    setTyped(next);
    if (next.length >= text.length) {
      const secs = Math.max(0.1, (Date.now() - (startAt || Date.now())) / 1000);
      onDone({
        wpm: Math.round(text.length / 5 / secs * 60),
        accuracy,
        time: Math.round(secs),
        errors
      });
    }
  }
  const pct = Math.round(typed.length / text.length * 100);
  return /*#__PURE__*/React.createElement("div", {
    ref: wrapRef,
    tabIndex: 0,
    onKeyDown: handleKey,
    style: {
      outline: "none",
      maxWidth: 900,
      margin: "0 auto",
      padding: "40px 28px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 26
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 40
    }
  }, /*#__PURE__*/React.createElement(Stat, {
    value: wpm,
    unit: "wpm",
    label: "Speed",
    size: "sm",
    align: "left"
  }), /*#__PURE__*/React.createElement(Stat, {
    value: accuracy,
    unit: "%",
    label: "Accuracy",
    size: "sm",
    align: "left",
    accent: accuracy >= 97 ? "green" : "warning"
  }), /*#__PURE__*/React.createElement(Stat, {
    value: Math.floor(elapsed),
    unit: "s",
    label: "Time",
    size: "sm",
    align: "left",
    accent: "white"
  })), /*#__PURE__*/React.createElement(IconButton, {
    label: "Abort (Esc)",
    variant: "outline",
    onClick: onExit
  }, /*#__PURE__*/React.createElement("i", {
    "data-lucide": "x"
  }))), /*#__PURE__*/React.createElement(Card, {
    scanlines: true,
    padding: "var(--space-6)",
    style: {
      minHeight: 200,
      display: "flex",
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement(TypingField, {
    text: text,
    typed: typed
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 22
    }
  }, /*#__PURE__*/React.createElement(ProgressBar, {
    value: pct,
    showLabel: true
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      marginTop: 18,
      fontFamily: "var(--font-mono)",
      fontSize: "var(--text-xs)",
      color: "var(--ink-3)"
    }
  }, startAt ? "keep going — the rain is with you" : "start typing to begin the clock"));
}
Object.assign(window, {
  RunScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/god_mode_code/RunScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/god_mode_code/SettingsScreen.jsx
try { (() => {
// Settings screen — SettingRow rows with mixed controls.
const {
  Card,
  SettingRow,
  Switch,
  Select,
  Avatar,
  Button,
  Badge
} = window.GODMODECODEDesignSystem_ca0aa4;
function SettingsScreen() {
  const [rain, setRain] = React.useState(true);
  const [sound, setSound] = React.useState(false);
  const [scan, setScan] = React.useState(true);
  const [diff, setDiff] = React.useState("hard");
  const [caret, setCaret] = React.useState("block");
  return /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 720,
      margin: "0 auto",
      padding: "48px 28px"
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      fontFamily: "var(--font-terminal)",
      fontSize: "var(--text-2xl)",
      letterSpacing: "0.08em",
      color: "var(--ink-max)",
      textShadow: "var(--glow-sm)",
      marginBottom: 26
    }
  }, "SETTINGS"), /*#__PURE__*/React.createElement(Card, {
    padding: "var(--space-5)",
    style: {
      marginBottom: 22
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 16,
      paddingBottom: 18,
      borderBottom: "1px solid var(--line-faint)",
      marginBottom: 6
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    initials: "YU",
    size: "lg"
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: "var(--text-md)",
      color: "var(--ink-max)"
    }
  }, "you"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: "var(--text-xs)",
      color: "var(--ink-2)"
    }
  }, "rank #5 \xB7 88 runs logged")), /*#__PURE__*/React.createElement(Badge, {
    tone: "warning",
    style: {
      marginLeft: "auto"
    }
  }, "Best 112 wpm")), /*#__PURE__*/React.createElement(SettingRow, {
    label: "Digital rain",
    description: "Falling code behind the typing surface."
  }, /*#__PURE__*/React.createElement(Switch, {
    checked: rain,
    onChange: setRain
  })), /*#__PURE__*/React.createElement(SettingRow, {
    label: "Scanlines",
    description: "Faint CRT overlay on panels."
  }, /*#__PURE__*/React.createElement(Switch, {
    checked: scan,
    onChange: setScan
  })), /*#__PURE__*/React.createElement(SettingRow, {
    label: "Keystroke sound",
    description: "Mechanical click on every key."
  }, /*#__PURE__*/React.createElement(Switch, {
    checked: sound,
    onChange: setSound
  })), /*#__PURE__*/React.createElement(SettingRow, {
    label: "Caret style",
    description: "Shape of the typing cursor."
  }, /*#__PURE__*/React.createElement(Select, {
    value: caret,
    onChange: setCaret,
    options: [{
      value: "block",
      label: "BLOCK"
    }, {
      value: "line",
      label: "LINE"
    }, {
      value: "underline",
      label: "UNDERLINE"
    }]
  })), /*#__PURE__*/React.createElement(SettingRow, {
    label: "Difficulty",
    description: "Passage length and complexity.",
    divider: false
  }, /*#__PURE__*/React.createElement(Select, {
    value: diff,
    onChange: setDiff,
    options: [{
      value: "easy",
      label: "EASY"
    }, {
      value: "med",
      label: "STANDARD"
    }, {
      value: "hard",
      label: "NIGHTMARE"
    }]
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between"
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "danger"
  }, "Wipe Progress"), /*#__PURE__*/React.createElement(Button, {
    variant: "primary"
  }, "Save")));
}
Object.assign(window, {
  SettingsScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/god_mode_code/SettingsScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/god_mode_code/data.js
try { (() => {
// Sample challenge content for the GOD_MODE_CODE UI kit.
const GMC = window.GODMODECODEDesignSystem_ca0aa4;
const CHALLENGES = {
  quotes: {
    id: "quotes",
    glyph: "❝❞",
    title: "Quotes",
    meta: "240 passages",
    description: "Motivational one-liners to warm up your fingers.",
    passages: ["Do or do not. There is no try.", "The only way out is through, so keep your hands moving.", "Discipline is choosing between what you want now and what you want most."]
  },
  code: {
    id: "code",
    glyph: "{ }",
    title: "Code",
    meta: "88 blocks",
    description: "Short blocks pulled from real open-source repos.",
    passages: ["const sum = arr.reduce((a, b) => a + b, 0);", "for (let i = 0; i < n; i++) { grid[i] = new Array(n).fill(0); }", "export function clamp(x, lo, hi) { return Math.min(hi, Math.max(lo, x)); }"]
  },
  prose: {
    id: "prose",
    glyph: "¶",
    title: "Prose",
    meta: "60 passages",
    description: "Profound paragraphs from the canon of literature.",
    passages: ["It was the best of times, it was the worst of times, it was the age of wisdom.", "All happy families are alike; each unhappy family is unhappy in its own way.", "Call me Ishmael. Some years ago, having little money in my purse, I went to sea."]
  }
};
const LEADERBOARD = [{
  rank: 1,
  user: "neo_anderson",
  wpm: 148,
  acc: 99.2
}, {
  rank: 2,
  user: "trinity",
  wpm: 141,
  acc: 98.7
}, {
  rank: 3,
  user: "morpheus",
  wpm: 133,
  acc: 99.9
}, {
  rank: 4,
  user: "cypher",
  wpm: 128,
  acc: 94.1
}, {
  rank: 5,
  user: "you",
  wpm: 112,
  acc: 98.4
}];
Object.assign(window, {
  GMC,
  CHALLENGES,
  LEADERBOARD
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/god_mode_code/data.js", error: String((e && e.message) || e) }); }

__ds_ns.Wordmark = __ds_scope.Wordmark;

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.Dialog = __ds_scope.Dialog;

__ds_ns.IconButton = __ds_scope.IconButton;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.Kbd = __ds_scope.Kbd;

__ds_ns.ProgressBar = __ds_scope.ProgressBar;

__ds_ns.Select = __ds_scope.Select;

__ds_ns.Stat = __ds_scope.Stat;

__ds_ns.Switch = __ds_scope.Switch;

__ds_ns.Tabs = __ds_scope.Tabs;

__ds_ns.Avatar = __ds_scope.Avatar;

__ds_ns.RunChart = __ds_scope.RunChart;

__ds_ns.Table = __ds_scope.Table;

__ds_ns.DigitalRain = __ds_scope.DigitalRain;

__ds_ns.EmptyState = __ds_scope.EmptyState;

__ds_ns.FaultState = __ds_scope.FaultState;

__ds_ns.Breadcrumb = __ds_scope.Breadcrumb;

__ds_ns.SettingRow = __ds_scope.SettingRow;

__ds_ns.ChallengeCard = __ds_scope.ChallengeCard;

__ds_ns.CodeStub = __ds_scope.CodeStub;

__ds_ns.Countdown = __ds_scope.Countdown;

__ds_ns.ResultPanel = __ds_scope.ResultPanel;

__ds_ns.TypingField = __ds_scope.TypingField;

})();
