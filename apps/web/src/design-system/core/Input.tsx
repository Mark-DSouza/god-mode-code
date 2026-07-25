import type { CSSProperties, InputHTMLAttributes, ReactNode } from "react";
import { cn } from "../cn.ts";

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "prefix"> {
  /** Leading glyph, e.g. ">" for a prompt. */
  prefix?: ReactNode;
  invalid?: boolean;
  disabled?: boolean;
  /** Class for the wrapper box. */
  wrapClassName?: string;
  /** Style for the wrapper box. */
  wrapStyle?: CSSProperties;
}

/** Terminal text field with an optional prompt prefix and green focus glow. */
export function Input({
  prefix,
  invalid = false,
  disabled = false,
  wrapClassName,
  wrapStyle,
  className,
  ...rest
}: InputProps) {
  return (
    <div
      className={cn(
        "flex h-[var(--control-md)] items-center gap-2 rounded-sm border bg-surface-1 px-3",
        "transition-[border-color,box-shadow] duration-[var(--dur-fast)] ease-[var(--ease-out)]",
        // The ring follows the real input's focus rather than the wrapper's, so
        // clicking the prefix glyph still lights the box.
        "focus-within:border-accent focus-within:shadow-glow",
        invalid ? "border-error" : "border-line",
        disabled && "opacity-40",
        wrapClassName,
      )}
      style={wrapStyle}
    >
      {prefix && (
        <span aria-hidden="true" className="shrink-0 font-display text-accent select-none">
          {prefix}
        </span>
      )}
      <input
        disabled={disabled}
        aria-invalid={invalid || undefined}
        className={cn(
          "min-w-0 flex-1 bg-transparent font-body text-sm text-body",
          "placeholder:text-disabled",
          // The wrapper already draws the focus treatment; a second ring inside
          // it reads as two overlapping boxes.
          "outline-none focus-visible:outline-none",
          "disabled:cursor-not-allowed",
          className,
        )}
        {...rest}
      />
    </div>
  );
}
