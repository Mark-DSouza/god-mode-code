package dev.markdsouza.godmodecode.pattern;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.util.UUID;

/**
 * A Pattern to solve, and the Issue that recorded it going out.
 *
 * The Code Discipline's counterpart to a transcription Challenge, and a separate
 * type rather than one record with two optional halves. A Passage Challenge and
 * a Pattern Challenge have nothing in common but the Issue, and a shared shape
 * would leave half its fields null on every response (ADR-0006).
 *
 * Unlike a Passage, the player chooses which Pattern. There is nothing to shop
 * for: a Pattern is a technique to practise rather than a score to farm, and the
 * whole point of browsing by Family is picking the one you are bad at.
 */
@Schema(description = "A Pattern to solve, and the Issue that recorded it going out")
public record SolveChallenge(
        @Schema(
                        description = "What the client hands back when the Solve Run is submitted",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                UUID issueId,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) Pattern pattern,
        @Schema(
                        description = "After this moment the Challenge can no longer be answered",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Instant expiresAt) {}
