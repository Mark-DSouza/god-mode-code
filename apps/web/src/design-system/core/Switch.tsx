import { useId } from "react";
import type { CSSProperties, ReactNode } from "react";
import { cn } from "../cn.ts";

export interface SwitchProps {
  checked?: boolean;
  onChange?: (next: boolean) => void;
  disabled?: boolean;
  label?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/**
 * Hard-edged terminal toggle.
 *
 * Built on a real checkbox rather than a styled `<div>`, so it is reachable by
 * Tab, toggles on Space, and announces its checked state without any ARIA
 * bookkeeping of our own.
 */
export function Switch({
  checked = false,
  onChange,
  disabled = false,
  label,
  className,
  style,
}: SwitchProps) {
  const id = useId();

  return (
    <div className={cn("inline-flex items-center gap-3", className)} style={style}>
      <input
        id={id}
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange?.(event.target.checked)}
        className="peer sr-only"
      />
      <label
        htmlFor={id}
        className={cn(
          "relative inline-flex h-[22px] w-[44px] shrink-0 cursor-pointer items-center",
          "rounded-xs border border-line bg-surface-1 p-[2px]",
          "transition-[background,border-color,box-shadow] duration-[var(--dur-fast)] ease-[var(--ease-out)]",
          checked &&
            "border-accent bg-[color-mix(in_srgb,var(--rain-green)_18%,transparent)] shadow-glow",
          // The visually hidden checkbox owns focus, so the ring is drawn here.
          "peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2",
          "peer-focus-visible:outline-[var(--focus-ring)]",
          disabled && "cursor-not-allowed opacity-40",
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "block size-[16px] rounded-[1px] transition-transform duration-[var(--dur-fast)] ease-[var(--ease-snap)]",
            checked ? "translate-x-[22px] bg-accent" : "translate-x-0 bg-ink-3",
          )}
        />
      </label>
      {label && (
        <label htmlFor={id} className="cursor-pointer font-display text-xs tracking-wide text-body">
          {label}
        </label>
      )}
    </div>
  );
}
