import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * `index.css` restates the design system's import manifest because the shipped
 * one cannot be imported directly (see the comment there). A restated list is a
 * list that drifts, so these fail if the design system adds, removes or
 * reorders a token file and ours does not follow — and if the set of files we
 * substitute rather than import verbatim ever changes without being recorded.
 */

const resolve = (relativePath: string) => fileURLToPath(new URL(relativePath, import.meta.url));
const read = (relativePath: string) => readFileSync(resolve(relativePath), "utf8");

const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");

const IMPORT = /@import\s+(?:url\()?["']([^"']+)["']\)?/g;

/** Import paths in order. Comments are stripped first — index.css quotes an
 * `@import url(...)` line while explaining why it cannot use one. */
function importPaths(css: string): string[] {
  return [...stripComments(css).matchAll(IMPORT)].map(([, path]) => path!);
}

const basename = (path: string) => path.split("/").pop()!;

const ourImports = importPaths(read("./index.css"));
const shippedImports = importPaths(
  read("../../../mockups-and-design-system/design_system/styles.css"),
);

describe("the token manifest", () => {
  it("imports the same files, in the same order, as the design system", () => {
    expect(ourImports.map(basename).filter((file) => file !== "deviations.css")).toEqual(
      shippedImports.map(basename),
    );
  });

  it("applies the deviations after the shipped tokens", () => {
    const css = read("./index.css");
    // A cascade override that lands before the value it overrides does nothing,
    // and the failure is silent — the ADR-0010 contrast fix would not apply.
    expect(css.indexOf("./deviations.css")).toBeGreaterThan(
      css.lastIndexOf("design_system/tokens/"),
    );
  });

  it("substitutes exactly one token file, and it is the fonts", () => {
    // Everything else must resolve into the design system itself. If a second
    // file is ever swapped for a local copy, that is a fork of the source of
    // truth and it should be a deliberate, recorded decision rather than
    // something that happened.
    const substituted = ourImports
      .filter((path) => !path.includes("design_system/"))
      .map(basename)
      .filter((file) => file !== "deviations.css");

    expect(substituted).toEqual(["fonts.css"]);
  });
});

describe("the token layer loads nothing over the network", () => {
  const isRemote = (path: string) => /^(https?:)?\/\//.test(path);

  /**
   * Walks the import graph from our entry point, collecting the text of every
   * local stylesheet and the URL of every remote reference.
   *
   * Remote imports are recorded, never fetched — following one would turn a
   * failing assertion into an ENOENT on a URL path, which says nothing about
   * what is actually wrong.
   */
  function walk(entryUrl: URL, seen = new Set<string>()): { sources: string[]; remote: string[] } {
    const path = fileURLToPath(entryUrl);
    if (seen.has(path)) return { sources: [], remote: [] };
    seen.add(path);

    const css = stripComments(readFileSync(path, "utf8"));
    const sources = [css];
    const remote: string[] = [];

    for (const imported of importPaths(css)) {
      if (isRemote(imported)) {
        remote.push(imported);
        continue;
      }
      // Nested imports resolve relative to the file that wrote them.
      const nested = walk(new URL(imported, entryUrl), seen);
      sources.push(...nested.sources);
      remote.push(...nested.remote);
    }
    return { sources, remote };
  }

  it("has no remote url or @import anywhere in the chain", () => {
    const { sources, remote } = walk(new URL("./index.css", import.meta.url));

    // Catches both a remote @import and a bare url(https://…) inside any
    // stylesheet we actually pull in.
    const remoteUrls = sources
      .flatMap((css) => [...css.matchAll(/url\(\s*["']?(https?:\/\/[^"')]+)/g)])
      .map(([, url]) => url!);

    // Deduped: a remote `@import url(...)` is matched by both passes above, and
    // the same URL listed twice reads as a bug in the test.
    expect([...new Set([...remote, ...remoteUrls])]).toEqual([]);

    // The design system's own fonts.css @imports Google Fonts. Substituting it
    // is the whole point: a third-party origin on the critical path of every
    // page load, a render that depends on a CDN, and — for the visual
    // regression work in #23 — a snapshot that differs depending on whether the
    // webfont had settled. Reinstating that import fails here.
    expect(remote).toEqual([]);
  });

  it("declares the three families typography.css binds", () => {
    const fonts = read("./fonts.css");
    const typography = read(
      "../../../mockups-and-design-system/design_system/tokens/typography.css",
    );

    /** Quote-agnostic: the generator emits Google's single quotes, but nothing
     * should break if that ever becomes double. */
    const declaredFamilies = new Set(
      [...fonts.matchAll(/font-family:\s*["']([^"']+)["']/g)].map(([, family]) => family!),
    );

    for (const family of ["JetBrains Mono", "Share Tech Mono", "VT323"]) {
      // Self-hosting must not quietly drop a face. A family bound by a token
      // but never declared falls back to a system monospace, which looks
      // almost right and is therefore easy to miss.
      expect(typography, `${family} should be bound by a token`).toContain(family);
      expect(declaredFamilies, `${family} should be declared as @font-face`).toContain(family);
    }
  });
});
