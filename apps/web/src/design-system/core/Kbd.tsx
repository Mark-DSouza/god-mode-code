import type { CSSProperties, ReactNode } from "react";
import { cn } from "../cn.ts";

export interface KbdProps {
  children?: ReactNode;
  wide?: boolean;
  className?: string;
  style?: CSSProperties;
}

/** A physical keycap glyph for showing keystrokes and shortcuts. */
export function Kbd({ children, wide = false, className, style }: KbdProps) {
  return (
    <kbd
      className={cn(
        "inline-flex items-center justify-center rounded-xs border border-line-bright",
        "bg-surface-3 px-2 py-1 font-display text-2xs tracking-wide text-body",
        "shadow-[0_1px_0_var(--line-faint)]",
        wide ? "min-w-[64px]" : "min-w-[24px]",
        className,
      )}
      style={style}
    >
      {children}
    </kbd>
  );
}
