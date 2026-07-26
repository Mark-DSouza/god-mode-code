package dev.markdsouza.godmodecode.typing;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * One of the three ways to play: what you are given, and how you are judged.
 *
 * All three are named here because the vocabulary has three, not because all
 * three are playable yet. {@link #CODE} is judged by running submitted source
 * against a Pattern's hidden tests (ADR-0004) and has no Passages at all, so
 * asking for a Passage in it answers "there is nothing here" rather than
 * pretending otherwise.
 */
@Schema(description = "One of the three ways to play")
public enum Discipline {
    /** Short attributed quotations. */
    QUOTES,

    /** Longer passages of prose. */
    PROSE,

    /** Pattern puzzles, which have no Passage — see ADR-0004. */
    CODE
}
