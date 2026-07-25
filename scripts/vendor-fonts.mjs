#!/usr/bin/env node
/**
 * Vendors the design system's three webfonts into packages/design-tokens/fonts.
 *
 * The shipped `tokens/fonts.css` is a single `@import` of a Google Fonts URL.
 * That is one third-party origin on the critical path of every page load, a
 * render that depends on a CDN being reachable, and — once visual regression
 * testing lands (#23) — a snapshot that differs depending on whether the
 * webfont had settled when the shot was taken.
 *
 * This fetches the stylesheet Google serves, downloads the woff2 files it
 * points at, and writes an equivalent stylesheet with local paths. Run it again
 * to pick up upstream changes; the output is committed.
 *
 *   node scripts/vendor-fonts.mjs
 *
 * All three families are SIL Open Font License 1.1, which permits
 * redistribution. Licences are committed alongside the binaries.
 */
import { createHash } from "node:crypto";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

/** Exactly the families, weights and styles the shipped fonts.css asks for. */
const GOOGLE_CSS_URL =
  "https://fonts.googleapis.com/css2?family=JetBrains+Mono:ital,wght@0,400;0,500;0,700;0,800;1,400&family=Share+Tech+Mono&family=VT323&display=swap";

/**
 * A browser UA, because Google serves woff2 to modern browsers and older
 * formats to anything it does not recognise. Requesting as curl would vendor
 * ttf and roughly triple the bytes.
 */
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

/**
 * The interface is Latin-only. Google also serves Cyrillic, Greek and
 * Vietnamese cuts, which nothing in the product renders — they would be dead
 * weight in the repository. The rain canvas draws half-width katakana, but no
 * subset here has ever covered those: they fall through to the system
 * monospace, before this change and after it.
 */
const WANTED_SUBSETS = new Set(["latin", "latin-ext"]);

const FONTS_DIR = fileURLToPath(new URL("../packages/design-tokens/fonts/", import.meta.url));
const OUTPUT_CSS = fileURLToPath(
  new URL("../packages/design-tokens/src/fonts.css", import.meta.url),
);

async function main() {
  const response = await fetch(GOOGLE_CSS_URL, { headers: { "User-Agent": USER_AGENT } });
  if (!response.ok) {
    throw new Error(`Google Fonts returned ${response.status} ${response.statusText}`);
  }
  const css = await response.text();

  // Google emits `/* latin */` immediately before each @font-face it labels.
  const blocks = [...css.matchAll(/\/\*\s*([\w-]+)\s*\*\/\s*(@font-face\s*\{[^}]*\})/g)];
  if (blocks.length === 0) {
    throw new Error("Parsed no @font-face blocks — Google's stylesheet format has changed.");
  }

  // Clear the binaries only. Removing the directory would take LICENSE with it,
  // and redistributing OFL fonts without their licence is not optional.
  await mkdir(FONTS_DIR, { recursive: true });
  for (const existing of await readdir(FONTS_DIR)) {
    if (existing.endsWith(".woff2")) await rm(new URL(existing, `file://${FONTS_DIR}`));
  }

  const kept = [];
  /**
   * Content hash to filename.
   *
   * JetBrains Mono is a variable font: Google serves one file for weights 400,
   * 500, 700 and 800 and distinguishes them purely by the `font-weight` in each
   * @font-face. Downloading per rule would commit four byte-identical copies,
   * and naming them by weight would be a lie about what the file contains.
   */
  const byContent = new Map();

  for (const [, subset, block] of blocks) {
    if (!WANTED_SUBSETS.has(subset)) continue;

    const url = block.match(/url\((https:\/\/[^)]+\.woff2)\)/)?.[1];
    const family = block.match(/font-family:\s*'([^']+)'/)?.[1];
    if (!url || !family) continue;

    const binary = await fetch(url);
    if (!binary.ok) throw new Error(`Could not download ${url}: ${binary.status}`);
    const bytes = Buffer.from(await binary.arrayBuffer());

    const digest = createHash("sha256").update(bytes).digest("hex").slice(0, 8);
    let filename = byContent.get(digest);
    if (!filename) {
      // No weight in the name — one file may serve several.
      filename = `${slug(family)}-${subset}-${digest}.woff2`;
      byContent.set(digest, filename);
      await writeFile(new URL(filename, `file://${FONTS_DIR}`), bytes);
    }

    // Rewrite to a path relative to the emitted stylesheet, and keep the
    // unicode-range so the browser still skips files it does not need.
    kept.push(block.replace(/url\(https:\/\/[^)]+\.woff2\)/, `url("../fonts/${filename}")`).trim());
  }

  if (kept.length === 0) throw new Error("Kept no font faces — check WANTED_SUBSETS.");

  await writeFile(OUTPUT_CSS, header() + kept.join("\n\n") + "\n");

  const files = (await readdir(FONTS_DIR)).filter((file) => file.endsWith(".woff2")).sort();
  console.log(`Vendored ${files.length} woff2 files and ${kept.length} @font-face rules.`);
  for (const file of files) console.log(`  packages/design-tokens/fonts/${file}`);
}

const slug = (family) => family.toLowerCase().replace(/\s+/g, "-");

const header = () => `/* GENERATED by scripts/vendor-fonts.mjs — do not edit by hand.
 *
 * Self-hosted replacement for the design system's tokens/fonts.css, which is a
 * single @import of a Google Fonts URL. Substituting it is a deliberate
 * deviation, recorded in packages/design-tokens/src/deviations.css and pinned
 * by manifest.test.ts.
 *
 * Nothing else about the design system's typography changes: the family names
 * below are exactly those tokens/typography.css binds --font-terminal,
 * --font-mono and --font-crt to.
 *
 * Fonts are SIL OFL 1.1; see packages/design-tokens/fonts/LICENSE.
 */

`;

await main();
