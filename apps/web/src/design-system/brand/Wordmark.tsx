import type { CSSProperties } from "react";
import { cn } from "../cn.ts";

export interface WordmarkProps {
  /** Font size of the wordmark text in px; the mark scales with it. */
  size?: number;
  /** Show the ▚ block mark before the text. */
  mark?: boolean;
  glow?: "none" | "sm" | "md" | "lg";
  /** Wordmark text colour. */
  color?: string;
  className?: string;
  style?: CSSProperties;
}

const GLOWS = {
  none: "",
  sm: "[text-shadow:var(--glow-sm)]",
  md: "[text-shadow:var(--glow-md)]",
  lg: "[text-shadow:var(--glow-lg)]",
} as const;

/**
 * The GOD_MODE_CODE brand lockup (▚ mark + terminal wordmark).
 *
 * Stands in for a real logo, which does not exist. The ▚ half-block is a glyph,
 * not a drawn mark — replace the whole component if a real logo arrives.
 */
export function Wordmark({
  size = 20,
  mark = true,
  glow = "md",
  color = "var(--rain-green)",
  className,
  style,
}: WordmarkProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 font-display tracking-wider",
        GLOWS[glow],
        className,
      )}
      style={{ fontSize: size, color, ...style }}
    >
      {mark && (
        <span
          aria-hidden="true"
          className="font-stat leading-none"
          style={{ fontSize: size * 1.15 }}
        >
          ▚
        </span>
      )}
      GOD_MODE_CODE
    </span>
  );
}
