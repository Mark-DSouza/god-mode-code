package dev.markdsouza.godmodecode.typing;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.time.Instant;
import java.util.UUID;

/**
 * What the browser sends when a Run finishes: raw data only.
 *
 * There is no WPM field and no accuracy field, and that is the point. The
 * server recomputes both from what is here and would discard client figures if
 * they were sent, so the contract does not offer anywhere to put them
 * (ADR-0003). A payload that cannot express a forged metric is a payload nobody
 * has to remember to ignore.
 *
 * @param typedText   what was actually typed, in full. The comparison against
 *                    the issued Passage happens here, not in the browser.
 * @param keystrokes  every character key pressed, including the ones that were
 *                    wrong and then corrected. Backspaces are not counted:
 *                    Accuracy is correct keystrokes over total keystrokes, and
 *                    charging for the correction as well as the mistake would
 *                    penalise one error twice.
 * @param startedAt   the client's clock at the first keystroke.
 * @param completedAt the client's clock at the last one. Only the difference
 *                    between the two is used — a browser's absolute clock can
 *                    be set to anything, but the gap between two readings of it
 *                    is still a duration, and the server checks that duration
 *                    against its own record of when the Challenge went out.
 */
@Schema(description = "The raw data a finished Run is verified from")
public record TypingRunSubmission(
        @Schema(
                        description = "The Issue this Run answers",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                @NotNull UUID issueId,
        @Schema(
                        description = "The text as typed, in full",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                @NotBlank String typedText,
        @Schema(
                        description = "Total character keystrokes, mistakes included",
                        example = "312",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                @Positive int keystrokes,
        @Schema(
                        description = "The client's clock at the first keystroke",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                @NotNull Instant startedAt,
        @Schema(
                        description = "The client's clock at the last keystroke",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                @NotNull Instant completedAt) {}
