import type { CSSProperties, ReactNode } from "react";
import { cn } from "../cn.ts";

export interface EmptyStateProps {
  /** Large dim glyph; defaults to a caret. Decorative. */
  glyph?: ReactNode;
  title: string;
  description?: string;
  /** Action(s), usually a primary Button. */
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/**
 * A centred zero-data placeholder: a dim glyph, a title, a line of copy, and
 * something to do about it.
 *
 * The title is an `h2` rather than a styled `div`. This is the whole content of
 * the region it fills, and a screen with no headings is a screen a screen
 * reader user has to read end to end to find their way around.
 */
export function EmptyState({
  glyph = "_",
  title,
  description,
  children,
  className,
  style,
}: EmptyStateProps) {
  return (
    <div
      className={cn("flex flex-col items-center justify-center gap-5 p-8 text-center", className)}
      style={style}
    >
      <div aria-hidden="true" className="font-stat text-5xl leading-[0.8] text-disabled">
        {glyph}
      </div>
      <div className="flex flex-col gap-2">
        <h2 className="font-display text-xl tracking-wide text-ink-max uppercase">{title}</h2>
        {description && (
          <p className="mx-auto max-w-[45ch] font-code text-sm leading-normal text-muted">
            {description}
          </p>
        )}
      </div>
      {children}
    </div>
  );
}
