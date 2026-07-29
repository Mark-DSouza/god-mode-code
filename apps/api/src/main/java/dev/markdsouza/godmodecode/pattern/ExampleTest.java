package dev.markdsouza.godmodecode.pattern;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * A test case shown to the player alongside the Pattern, so they know the
 * contract they are being judged against.
 *
 * There is no Hidden Test counterpart to this record, and there must never be
 * one. A Hidden Test is never shown and its failure is reported only as a count
 * (CONTEXT.md); a type that could carry one to the browser is the shape of the
 * mistake, so the shape does not exist.
 *
 * @param call     the Python expression the submitted source must satisfy.
 * @param expected the answer it has to produce, as a Python literal.
 */
@Schema(description = "A test case shown to the player before they start")
public record ExampleTest(
        @Schema(
                        description = "What the case is about",
                        example = "the pair is the first two numbers",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String name,
        @Schema(
                        description = "The call the submitted source must satisfy",
                        example = "pair_sum([2, 7, 11, 15], 9)",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String call,
        @Schema(
                        description = "The answer the call has to produce",
                        example = "[0, 1]",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String expected) {}
