package dev.markdsouza.godmodecode.pattern;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;
import java.util.UUID;

/**
 * A distilled algorithmic technique posed as a puzzle, as a player sees it.
 *
 * A Pattern is a technique, not a problem: "store what you've seen, look up what
 * you need" rather than "solve Two Sum" (ADR-0004). Four to eight lines of
 * answer, thirty to ninety seconds of thinking.
 *
 * <h2>What is deliberately absent</h2>
 *
 * The reference solution, which is the answer, and the Hidden Tests, which are
 * how the answer is checked. Both exist — the first in a column no endpoint
 * reads, the second in the judge's own binary on a host with no egress
 * (ADR-0005) — and neither has a field here, because a field is all it takes.
 *
 * @param exampleTests the contract the player is judged against, shown before
 *                     they start. Never the Hidden Tests, which are only ever a
 *                     count in a result.
 */
@Schema(description = "A Pattern to solve, as the player is shown it")
public record Pattern(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
        @Schema(
                        description = "Stable identifier, also what the judge knows this Pattern by",
                        example = "hash-map-seen-lookup",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String slug,
        @Schema(
                        example = "Store what you've seen, look up what you need",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String name,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) Family family,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) Seniority seniority,
        @Schema(
                        description = "The technique and what to do with it, in the player's words",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String prompt,
        @Schema(
                        description = "The read-only lines above the editable region",
                        example = "def pair_sum(numbers, target):",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String scaffold,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<ExampleTest> exampleTests) {}
