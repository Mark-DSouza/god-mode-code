import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../cn.ts";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Green edge bloom. */
  glow?: boolean;
  /** Faint CRT scanline overlay. */
  scanlines?: boolean;
  /** Lift + glow on hover. */
  interactive?: boolean;
  /** Padding override. Accepts any CSS length; defaults to the `--space-5` step. */
  padding?: string;
  children?: ReactNode;
}

/**
 * A raised terminal panel — the default container for grouped content.
 *
 * Surfaces are veiled rather than opaque (~90% over the void) so the rain reads
 * faintly through every panel while text stays crisp.
 */
export function Card({
  glow = false,
  scanlines = false,
  interactive = false,
  padding,
  className,
  style,
  children,
  ...rest
}: CardProps) {
  return (
    <div
      className={cn(
        "relative rounded-md border border-line bg-surface-2 p-5 shadow-elev-1",
        glow && "shadow-glow",
        interactive &&
          cn(
            "cursor-pointer transition-[border-color,box-shadow,transform]",
            "duration-[var(--dur-fast)] ease-[var(--ease-out)]",
            "hover:-translate-y-px hover:border-line-bright hover:shadow-glow",
          ),
        scanlines &&
          cn(
            "before:pointer-events-none before:absolute before:inset-0",
            "before:rounded-[inherit] before:scanlines before:content-['']",
          ),
        className,
      )}
      style={padding ? { padding, ...style } : style}
      {...rest}
    >
      {children}
    </div>
  );
}
