import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void): () => void {
  // Older Safari has `addListener` only. Guarding keeps the hook from throwing
  // on a browser that can still render the rest of the app fine.
  const list = window.matchMedia?.(QUERY);
  if (!list) return () => {};
  list.addEventListener("change", onChange);
  return () => list.removeEventListener("change", onChange);
}

function getSnapshot(): boolean {
  return window.matchMedia?.(QUERY).matches ?? false;
}

/**
 * Whether the operating system is asking for reduced motion.
 *
 * Reads live rather than once on mount — the preference is a system toggle a
 * user can flip mid-session, usually *because* something on screen is making
 * them unwell, and the rain is the most likely candidate.
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
