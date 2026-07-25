/** Minimal ambient types for `wcag-contrast`, which ships none. */
declare module "wcag-contrast" {
  /** Contrast ratio (1–21) between two hex colours. */
  export function hex(a: string, b: string): number;
}
