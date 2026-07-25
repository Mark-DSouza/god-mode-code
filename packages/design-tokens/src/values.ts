import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Reads token values out of the CSS rather than restating them in TypeScript.
 *
 * The CSS is the source of truth — a second hand-maintained copy of the palette
 * is exactly the "competing scale" the architecture decisions rule out, and it
 * would drift silently. Anything that needs a token value at runtime or in a
 * test reads it from here.
 *
 * Node-only: this reaches for the filesystem, so it is for build scripts and
 * tests. Browser code uses the CSS custom properties directly.
 */

const CUSTOM_PROPERTY = /^\s*(--[\w-]+)\s*:\s*([^;]+);/gm;

function resolve(relativePath: string): string {
  return fileURLToPath(new URL(relativePath, import.meta.url));
}

/** Every `--foo: bar;` declaration in a stylesheet, last one winning. */
export function parseTokens(cssPath: string): Map<string, string> {
  const css = readFileSync(cssPath, "utf8");
  const tokens = new Map<string, string>();
  for (const match of css.matchAll(CUSTOM_PROPERTY)) {
    const [, name, value] = match;
    // Both groups are required by the pattern, so this only ever guards against
    // someone loosening the regex later.
    if (name && value) tokens.set(name, value.trim());
  }
  return tokens;
}

export const SHIPPED_TOKENS_PATH = resolve(
  "../../../mockups-and-design-system/design_system/tokens/colors.css",
);
export const DEVIATIONS_PATH = resolve("./deviations.css");

/** The palette exactly as the design system ships it, deviations not applied. */
export const shippedColors: Map<string, string> = parseTokens(SHIPPED_TOKENS_PATH);

/** The deviations from ADR-0010 that live at the token layer. */
export const deviations: Map<string, string> = parseTokens(DEVIATIONS_PATH);

/** The palette this application actually renders: shipped values, then deviations. */
export const colors: Map<string, string> = new Map([...shippedColors, ...deviations]);

/** Throwing lookup — a typo in a token name should fail loudly, not yield undefined. */
export function color(name: string): string {
  const value = colors.get(name);
  if (value === undefined) {
    throw new Error(`Unknown colour token "${name}". Known: ${[...colors.keys()].join(", ")}`);
  }
  return value;
}
