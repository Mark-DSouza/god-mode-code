import type { Discipline } from "@gmc/api-client";

export interface DisciplineDetails {
  title: string;
  /** A short symbol, shown large on the tile. Decorative. */
  glyph: string;
  description: string;
}

/**
 * How each Discipline introduces itself.
 *
 * All three are named, including the one that cannot be played yet, so that
 * nothing has to guard a lookup — a Run's Discipline comes back from the server
 * and every screen that shows one can simply ask for its title.
 */
export const DISCIPLINES: Record<Discipline, DisciplineDetails> = {
  QUOTES: {
    title: "Quotes",
    glyph: "❝❞",
    description: "Short attributed lines to warm up your fingers.",
  },
  PROSE: {
    title: "Prose",
    glyph: "¶",
    description: "Longer paragraphs from the canon of literature.",
  },
  CODE: {
    title: "Code",
    glyph: "{ }",
    description: "Algorithmic Patterns, solved rather than transcribed.",
  },
};

/**
 * Every Discipline that can be played, in the order the home screen offers them.
 *
 * Code is on the list but is not dealt out like the other two: picking it opens
 * the Pattern catalogue, because a Pattern is chosen rather than handed over and
 * there is no Passage in it to ask for (ADR-0004).
 */
export const PLAYABLE_DISCIPLINES = [
  "QUOTES",
  "PROSE",
  "CODE",
] as const satisfies readonly Discipline[];
