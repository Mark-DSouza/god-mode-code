package dev.markdsouza.godmodecode.pattern;

import dev.markdsouza.godmodecode.judge.Verdict;
import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * A Run against a Pattern, measured by Verdict and duration, with WPM as a
 * secondary reading.
 *
 * Can fail, which a Typing Run cannot — a Failed Solve Run is a recorded Run
 * with a Verdict on it, not an absence of one. There is no Accuracy field and no
 * error count, and their absence is the design rather than an omission: a Solve
 * Run has no target text to be accurate against, and a result screen that
 * rendered them as empty cells would be inventing a measurement (ADR-0006).
 *
 * @param testsPassed      Example Tests and Hidden Tests that were satisfied,
 *                         and {@code testsTotal} counts both together. A Hidden
 *                         Test's failure is a count and never more than a count
 *                         (CONTEXT.md).
 * @param personalBest     whether this Run beat every earlier Solve Run of this
 *                         User's. Only a Passed Solve Run can: only Passed Solve
 *                         Runs are ranked, so a fast Failed one sets nothing.
 * @param previousBestWpm  what it beat, and null when there was nothing to beat
 *                         or nothing was beaten.
 */
@Schema(description = "A completed and judged Run against a Pattern")
public record SolveRun(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID patternId,
        @Schema(example = "hash-map-seen-lookup", requiredMode = Schema.RequiredMode.REQUIRED) String patternSlug,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) Verdict verdict,
        @Schema(example = "6", requiredMode = Schema.RequiredMode.REQUIRED) int testsPassed,
        @Schema(example = "6", requiredMode = Schema.RequiredMode.REQUIRED) int testsTotal,
        @Schema(
                        description = "How long the Solve Run took, as verified",
                        example = "48210",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                int elapsedMillis,
        @Schema(
                        description = "Total character keystrokes",
                        example = "180",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                int keystrokes,
        @Schema(
                        description = "Every submitted character over five, per minute — a secondary reading",
                        example = "41.2",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                BigDecimal wpm,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant completedAt,
        @Schema(
                        description = "Whether this Run is a new Personal Best in the Code Discipline",
                        example = "true",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                boolean personalBest,
        @Schema(description = "The Personal Best this Run beat, when it beat one", example = "38.4")
                BigDecimal previousBestWpm) {}
