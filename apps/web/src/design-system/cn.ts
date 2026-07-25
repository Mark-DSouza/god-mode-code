import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * Class composer for the reimplemented design system.
 *
 * Concatenating class strings is not enough. If a component's base classes say
 * `bg-accent` and a caller passes `bg-error`, both land in the class list and
 * the winner is whichever Tailwind emitted later — an implementation detail of
 * the build, not something a caller can reason about. `tailwind-merge` drops the
 * earlier conflicting class so the caller's always wins, which is what
 * "class-based overrides behave normally" has to mean in practice.
 *
 * Only the values tailwind-merge cannot infer are declared below. Its built-in
 * validators already understand t-shirt sizes, so the design system's
 * `text-2xs`/`text-md`/`text-5xl` scale needs no help; `rounded-pill` and the
 * named shadows and fonts do, because they are bare words it would otherwise
 * treat as unknown and refuse to deduplicate.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-family": [{ font: ["display", "body", "code", "stat"] }],
      rounded: [{ rounded: ["pill"] }],
      shadow: [{ shadow: ["glow", "glow-lg", "elev-1", "elev-2"] }],
    },
  },
});

/** Composes class values, resolving Tailwind conflicts in the caller's favour. */
export function cn(...values: ClassValue[]): string {
  return twMerge(clsx(values));
}

export type { ClassValue };
