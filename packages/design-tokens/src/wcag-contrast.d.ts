/** Minimal ambient types for `wcag-contrast`, which ships none. */
declare module "wcag-contrast" {
  /** Contrast ratio (1–21) between two hex colours. */
  export function hex(a: string, b: string): number;
  /** Contrast ratio between two `[r, g, b]` triples, 0–255. */
  export function rgb(a: readonly number[], b: readonly number[]): number;
  /** Relative luminance of an `[r, g, b]` triple, 0–255. */
  export function relativeLuminance(rgb: readonly number[]): number;
  /** "AAA" | "AA" | "AA Large" | "Fail" for a given ratio. */
  export function score(ratio: number): string;
}
