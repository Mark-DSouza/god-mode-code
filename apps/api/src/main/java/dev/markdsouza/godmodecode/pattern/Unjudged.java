package dev.markdsouza.godmodecode.pattern;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * The body of a Solve Run that could not be judged.
 *
 * Deliberately not a {@link dev.markdsouza.godmodecode.integrity.Rejection}. A
 * Rejection means the submission did not survive Verification and carries the
 * one reason it did not; this means Verification passed and there was no judge
 * to ask. Nothing about the submitted source can be concluded, no Run exists,
 * and the Issue was not spent — so the honest thing to hand back is a sentence
 * and a 503, not a reason code that implies the player did something.
 */
@Schema(description = "A Solve Run that could not be judged. No Run was recorded and the Challenge is still live")
public record Unjudged(
        @Schema(
                        example = "The judge could not be reached. Your Challenge is still yours.",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String explanation) {}
