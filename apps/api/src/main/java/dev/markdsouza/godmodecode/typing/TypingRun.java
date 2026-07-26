package dev.markdsouza.godmodecode.typing;

import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * A Run against a Passage, measured by WPM and Accuracy.
 *
 * Cannot fail: it is either completed and recorded, or it never happened. A
 * Solve Run is a different aggregate with a different shape and can fail
 * (ADR-0006), which is why there is no polymorphic Run to share this record.
 *
 * The raw counts are published alongside the two metrics on purpose. They are
 * what the metrics were computed from, and a player who wants to know why their
 * accuracy reads 94.2 can see the two numbers that made it rather than being
 * asked to trust the one that came out.
 *
 * @param elapsedMillis how long the Run took, as verified — the difference
 *                      between the client's two timestamps, bounded by the
 *                      server's own record of when the Challenge went out.
 */
@Schema(description = "A completed and verified Run against a Passage")
public record TypingRun(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID passageId,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) Discipline discipline,
        @Schema(
                        description = "Correct characters over five, per minute, computed by the server",
                        example = "78.4",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                BigDecimal wpm,
        @Schema(
                        description = "Correct keystrokes over total keystrokes, as a percentage",
                        example = "99.1",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                BigDecimal accuracy,
        @Schema(description = "How long the Run took", example = "31240", requiredMode = Schema.RequiredMode.REQUIRED)
                int elapsedMillis,
        @Schema(
                        description = "Total character keystrokes, mistakes included",
                        example = "312",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                int keystrokes,
        @Schema(
                        description = "Characters of the Passage the final text got right",
                        example = "309",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                int correctCharacters,
        @Schema(
                        description = "Keystrokes that were not correct characters",
                        example = "3",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                int errors,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant completedAt) {}
