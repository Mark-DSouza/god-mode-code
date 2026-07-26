package dev.markdsouza.godmodecode.typing;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * The body of a refused submission.
 *
 * The explanation is for whoever is reading a network tab; the reason is what
 * the client branches on.
 */
@Schema(description = "A submitted Run that was not recorded, and why")
public record Rejection(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) RejectionReason reason,
        @Schema(
                        description = "Human-readable restatement of the reason",
                        example = "The typed text does not correspond to the Passage that was issued.",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String explanation) {

    static Rejection of(RejectionReason reason) {
        return new Rejection(reason, reason.explanation());
    }
}
