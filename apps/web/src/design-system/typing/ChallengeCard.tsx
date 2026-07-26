import type { CSSProperties, ReactNode } from "react";
import { Badge } from "../core/Badge.tsx";
import { cn } from "../cn.ts";
import { CONTROL_TRANSITION } from "../core/control.ts";

export interface ChallengeCardProps {
  /** Short symbol or icon node, shown large. */
  glyph?: ReactNode;
  title: string;
  description?: string;
  /** Small corner tag, e.g. "22 passages". */
  meta?: string;
  selected?: boolean;
  /** md = full tile with description; sm = compact, description hidden. */
  size?: "sm" | "md";
  onClick?: () => void;
  className?: string;
  style?: CSSProperties;
}

/**
 * A selectable Discipline tile.
 *
 * <h2>Why this is a button rather than a Card</h2>
 *
 * The shipped component is a `<div>` with an `onClick`, which cannot be reached
 * by keyboard, is not announced as anything, and has no pressed state to
 * announce. This is the same surface treatment on a real `<button>`, which gets
 * focus, Enter and Space for free.
 *
 * The Card component is not reused here for one dull reason: a `<button>` may
 * only contain phrasing content, and Card renders a `<div>`. The surface classes
 * are therefore repeated rather than nested.
 *
 * `aria-pressed` rather than `aria-selected`, which belongs to listbox and tab
 * patterns this is not one of.
 */
export function ChallengeCard({
  glyph,
  title,
  description,
  meta,
  selected = false,
  size = "md",
  onClick,
  className,
  style,
}: ChallengeCardProps) {
  const compact = size === "sm";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "relative flex cursor-pointer flex-col rounded-md border bg-surface-2 text-left shadow-elev-1",
        CONTROL_TRANSITION,
        compact ? "min-h-[108px] gap-2 p-4" : "min-h-[168px] gap-3 p-5",
        selected
          ? "border-accent bg-[color-mix(in_srgb,var(--rain-green)_9%,var(--surface-2))] shadow-glow"
          : "border-line hover:-translate-y-px hover:border-line-bright hover:shadow-glow",
        className,
      )}
      style={style}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          aria-hidden="true"
          className={cn(
            "font-stat leading-none text-accent [text-shadow:var(--glow-md)]",
            compact ? "text-2xl" : "text-3xl",
          )}
        >
          {glyph}
        </span>
        {meta && <Badge tone="neutral">{meta}</Badge>}
      </div>

      <div className="mt-auto">
        <div
          className={cn(
            "font-display tracking-wide text-ink-max uppercase",
            compact ? "text-md" : "text-lg",
          )}
        >
          {title}
        </div>
        {description && !compact && (
          <div className="mt-1.5 font-code text-xs leading-snug text-ink-2">{description}</div>
        )}
      </div>
    </button>
  );
}
