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
 * The Disciplines that can be played today.
 *
 * Code is deliberately absent rather than present and disabled. It is not a
 * Passage to transcribe at all — it is a Pattern, judged by running submitted
 * source against hidden tests (ADR-0004) — so it needs its own screen rather
 * than a greyed-out tile on this one. A tile that does nothing reads as a broken
 * site; an absent tile reads as an unfinished one, which is the truth.
 */
export const TRANSCRIPTION_DISCIPLINES = [
  "QUOTES",
  "PROSE",
] as const satisfies readonly Discipline[];
