import type { CSSProperties, HTMLAttributes } from "react";
import { cn } from "../cn.ts";

export interface AvatarProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  /** Up to two letters. Longer strings are trimmed rather than allowed to overflow the tile. */
  initials?: string;
  /** Edge length in px. The glyph scales with it. */
  size?: number;
  /** The phosphor ring. Off for the dense rows of a Leaderboard, where 40 of them would glare. */
  glow?: boolean;
  className?: string;
  style?: CSSProperties;
}

/**
 * A square terminal identity tile.
 *
 * One of the gaps the design system leaves — the mockups hand-build it — so it
 * is written here in the same class-based form as the rest of `design-system`
 * rather than copied from the mockup's inline styles, which no caller could
 * override.
 */
export function Avatar({
  initials = "",
  size = 34,
  glow = true,
  className,
  style,
  ...rest
}: AvatarProps) {
  return (
    <div
      className={cn(
        "grid shrink-0 place-items-center overflow-hidden rounded-sm",
        "border border-line-bright bg-surface-2",
        "font-display tracking-wide text-rain-green select-none",
        glow && "shadow-glow [text-shadow:var(--glow-sm)]",
        className,
      )}
      // Size is a free number rather than a scale step, so it cannot be a class.
      // Everything a caller might want to restyle is one.
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4), ...style }}
      {...rest}
    >
      {initials.slice(0, 2).toUpperCase()}
    </div>
  );
}
