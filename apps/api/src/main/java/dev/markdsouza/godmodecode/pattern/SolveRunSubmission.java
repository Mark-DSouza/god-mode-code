package dev.markdsouza.godmodecode.pattern;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.UUID;

/**
 * What the browser sends when a Solve Run finishes: the lines that were written,
 * and nothing that claims to be a metric.
 *
 * No Verdict field, for the same reason a Typing Run has no WPM field. The
 * Verdict is produced by executing the source and is the one thing a client
 * cannot be allowed an opinion on; the payload has nowhere to put one, so nobody
 * has to remember to ignore it (ADR-0003).
 *
 * No Scaffold field either. The Scaffold belongs to the Pattern, the server
 * already has it, and accepting it here would let a submission rewrite the
 * function signature its own tests call.
 *
 * @param source     the editable region only — the four to eight lines below the
 *                   Scaffold, exactly as typed. Indentation is meaning in
 *                   Python and nothing on this path touches it.
 * @param keystrokes every character key pressed, including the ones that were
 *                   deleted. Kept alongside the source it produced because a
 *                   four-line answer is trivially pasteable (ADR-0004), and the
 *                   defence built on comparing the two needs the number to have
 *                   been recorded from the first Solve Run onwards.
 */
@Schema(description = "The raw data a finished Solve Run is judged and verified from")
public record SolveRunSubmission(
        @Schema(description = "The Issue this Solve Run answers", requiredMode = Schema.RequiredMode.REQUIRED)
                @NotNull UUID issueId,
        @Schema(
                        description = "The lines written below the Scaffold, exactly as typed",
                        example = "    return []",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                @NotBlank
                // Bounded here as well as at the judge, which refuses anything
                // over 64KB. The judge's cap protects the judge; this one keeps
                // a submission that will certainly be refused from crossing the
                // private link at all.
                @Size(max = 16_384)
                String source,
        @Schema(
                        description = "Total character keystrokes, deletions of them excluded",
                        example = "180",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                @Positive int keystrokes,
        @Schema(
                        description = "The client's clock at the first keystroke",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                @NotNull Instant startedAt,
        @Schema(
                        description = "The client's clock when the Solve Run was submitted",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                @NotNull Instant completedAt) {}
