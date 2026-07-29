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
 * The Disciplines that hand out a Passage to transcribe.
 *
 * Code is not one of them and never will be: it is a Pattern, judged by running
 * submitted source against Hidden Tests (ADR-0004), so asking for a Passage in
 * it answers "there is nothing here". Picking it on the home screen leads to the
 * catalogue rather than straight into a Run, which is the other thing that makes
 * it different — you choose your Pattern, and nobody chooses their Passage.
 */
export const TRANSCRIPTION_DISCIPLINES = [
  "QUOTES",
  "PROSE",
] as const satisfies readonly Discipline[];

/** Every Discipline that can be played, in the order the home screen offers them. */
export const PLAYABLE_DISCIPLINES = [
  "QUOTES",
  "PROSE",
  "CODE",
] as const satisfies readonly Discipline[];
