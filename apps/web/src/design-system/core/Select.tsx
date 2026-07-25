import type { CSSProperties } from "react";
import { cn } from "../cn.ts";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  options: SelectOption[];
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  /** Accessible name. A bare combobox announces only its current value. */
  label?: string;
  className?: string;
  style?: CSSProperties;
}

/**
 * Native-backed terminal dropdown with a green chevron.
 *
 * The popup list is the platform's. A custom one would have to reimplement
 * type-ahead, touch behaviour and screen-reader semantics to end up in the same
 * place, and the only thing gained is the colour of the scrollbar.
 */
export function Select({
  options,
  value,
  onChange,
  disabled = false,
  label,
  className,
  style,
}: SelectProps) {
  return (
    <div className={cn("relative inline-flex", className)} style={style}>
      <select
        value={value}
        disabled={disabled}
        aria-label={label}
        onChange={(event) => onChange?.(event.target.value)}
        className={cn(
          "h-[var(--control-md)] w-full appearance-none rounded-sm border border-line bg-surface-1",
          "py-0 pr-8 pl-3 font-display text-xs tracking-wide text-body",
          "transition-[border-color,box-shadow] duration-[var(--dur-fast)] ease-[var(--ease-out)]",
          "hover:not-disabled:border-line-bright",
          "focus-visible:border-accent focus-visible:shadow-glow",
          "disabled:cursor-not-allowed disabled:opacity-40",
        )}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} className="bg-surface-1-solid text-body">
            {option.label}
          </option>
        ))}
      </select>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-accent"
      >
        ▼
      </span>
    </div>
  );
}
