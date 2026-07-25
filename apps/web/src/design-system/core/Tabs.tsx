import type { CSSProperties, ReactNode } from "react";
import { cn } from "../cn.ts";

export interface TabItem {
  id: string;
  label: ReactNode;
}

export interface TabsProps {
  items: TabItem[];
  value: string;
  onChange?: (id: string) => void;
  /** Accessible name for the tab list, e.g. "Leaderboard period". */
  label?: string;
  className?: string;
  style?: CSSProperties;
}

/**
 * Underlined terminal tab bar.
 *
 * Carries the ARIA tab pattern, including roving `tabIndex` — only the selected
 * tab is in the tab order, and arrow keys move between them. Without that, a
 * keyboard user Tabs through every period filter to reach the table below.
 */
export function Tabs({ items, value, onChange, label, className, style }: TabsProps) {
  function focusTabAt(index: number, container: HTMLElement | null) {
    const wrapped = (index + items.length) % items.length;
    const target = items[wrapped];
    if (!target) return;
    onChange?.(target.id);
    container?.querySelector<HTMLButtonElement>(`[data-tab-id="${target.id}"]`)?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn("flex items-stretch gap-1 border-b border-line", className)}
      style={style}
      onKeyDown={(event) => {
        const index = items.findIndex((item) => item.id === value);
        if (index < 0) return;
        if (event.key === "ArrowRight") {
          event.preventDefault();
          focusTabAt(index + 1, event.currentTarget);
        } else if (event.key === "ArrowLeft") {
          event.preventDefault();
          focusTabAt(index - 1, event.currentTarget);
        }
      }}
    >
      {items.map((item) => {
        const selected = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            data-tab-id={item.id}
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange?.(item.id)}
            className={cn(
              "-mb-px cursor-pointer border-b-2 px-4 py-3",
              "font-display text-xs tracking-wider uppercase",
              "transition-[color,border-color] duration-[var(--dur-fast)] ease-[var(--ease-out)]",
              selected
                ? "border-accent text-accent [text-shadow:var(--glow-sm)]"
                : "border-transparent text-muted hover:text-body",
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
