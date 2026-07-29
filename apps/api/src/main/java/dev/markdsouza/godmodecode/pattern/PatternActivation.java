package dev.markdsouza.godmodecode.pattern;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * What the activation gate made of one Pattern.
 *
 * A sentence rather than a machine-readable code, unlike a
 * {@link dev.markdsouza.godmodecode.integrity.Rejection}. Nothing branches on
 * this: it is read by whoever ran the gate after shipping a content migration,
 * and what they need is which Pattern and what went wrong with it.
 *
 * @param activated whether this Pattern is now playable. False is the ordinary
 *                  answer while a judge is down — the gate could not be run, so
 *                  it did not pass.
 */
@Schema(description = "What the activation gate made of one Pattern")
public record PatternActivation(
        @Schema(example = "hash-map-seen-lookup", requiredMode = Schema.RequiredMode.REQUIRED) String slug,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean activated,
        @Schema(
                        description = "What happened, in a sentence",
                        example = "The reference solution passed all 6 tests.",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String explanation) {

    static PatternActivation activated(String slug, int tests) {
        return new PatternActivation(slug, true, "The reference solution passed all %d tests.".formatted(tests));
    }

    static PatternActivation refused(String slug, String explanation) {
        return new PatternActivation(slug, false, explanation);
    }
}
