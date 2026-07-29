package dev.markdsouza.godmodecode.pattern;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * The grouping a Pattern belongs to.
 *
 * Eight of them, and the list is closed on purpose: a Family is how a player
 * navigates the catalogue, and a ninth that appeared because somebody typed a
 * new string into a content migration would be a Family with one Pattern in it
 * and no place in the browse screen. Adding one is a schema change and a
 * frontend change, which is the right amount of friction.
 *
 * The player-facing wording ("Hash Map", "Dynamic Programming") lives in the
 * frontend rather than here. This is the vocabulary; the presentation of it is
 * the screen's business, and a label served from the backend would be a string
 * nobody could translate or shorten without a deploy.
 */
@Schema(description = "The grouping a Pattern belongs to")
public enum Family {
    HASH_MAP,
    TWO_POINTERS,
    SLIDING_WINDOW,
    STACK,
    HEAP,
    BINARY_SEARCH,
    GRAPH,
    DYNAMIC_PROGRAMMING
}
