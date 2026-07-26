package dev.markdsouza.godmodecode.typing;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.UUID;

/**
 * A fixed piece of text to be transcribed.
 *
 * The text is printable ASCII throughout, enforced by the database rather than
 * by whoever writes the next content migration: this is a typing test, and a
 * curly apostrophe or an em dash is a character most players cannot produce at
 * all. A Run only ends when the final character is typed, so one untypeable
 * glyph makes the whole Passage impossible.
 *
 * @param characterCount the length of {@code text}, which the database derives
 *                       rather than stores — it is what expiry is scaled
 *                       against (ADR-0003), and a count that disagreed with the
 *                       text would mis-time every Run of this Passage.
 */
@Schema(description = "A fixed piece of text to be transcribed")
public record Passage(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) Discipline discipline,
        @Schema(
                        description = "The text to transcribe, printable ASCII throughout",
                        example = "Call me Ishmael.",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String text,
        @Schema(
                        description = "Who said or wrote it",
                        example = "Herman Melville, Moby-Dick, 1851",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String attribution,
        @Schema(
                        description = "How many characters the text is",
                        example = "302",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                int characterCount) {}
