import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * `index.css` restates the design system's import manifest because the shipped
 * one cannot be imported directly (see the comment there). A restated list is a
 * list that drifts, so this fails if the design system adds, removes or
 * reorders a token file and ours does not follow.
 */

const read = (relativePath: string) =>
  readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");

const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");

/** Filenames in `@import` order, whether written as a bare string or `url()`. */
function importedFiles(css: string): string[] {
  // Comments must go first — index.css quotes an `@import url(...)` line while
  // explaining why it cannot use one, and matching that would count it twice.
  return [...stripComments(css).matchAll(/@import\s+(?:url\()?["']([^"']+)["']\)?/g)]
    .map(([, path]) => path!.split("/").pop()!)
    .filter((file) => file !== "deviations.css");
}

describe("the token manifest", () => {
  it("imports the same files, in the same order, as the design system", () => {
    const shipped = importedFiles(
      read("../../../mockups-and-design-system/design_system/styles.css"),
    );
    const ours = importedFiles(read("./index.css"));

    expect(ours).toEqual(shipped);
  });

  it("applies the deviations after the shipped tokens", () => {
    const ours = read("./index.css");
    const lastShipped = ours.lastIndexOf("design_system/tokens/");
    const deviations = ours.indexOf("./deviations.css");

    // A cascade override that lands before the value it overrides does nothing,
    // and the failure is silent — the ADR-0010 contrast fix would simply not
    // apply.
    expect(deviations).toBeGreaterThan(lastShipped);
  });
});
