package dev.markdsouza.godmodecode.typing;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;

/**
 * Asking for something to do.
 *
 * The Discipline is the only thing the caller chooses. Which Passage arrives is
 * the server's decision — letting a client name one would let it shop for the
 * shortest.
 */
@Schema(description = "A request for a Challenge in one Discipline")
public record ChallengeRequest(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotNull Discipline discipline) {}
