package dev.markdsouza.godmodecode.user;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * What the player chooses on Claiming.
 *
 * Always required, even on a request that turns out to merge into an existing
 * account: the field the player sees is the Handle input, pre-filled with the
 * one they already have, and only the branch inside {@link UserService#claim}
 * knows whether it ends up used.
 */
@Schema(description = "What the player chooses on Claiming")
public record ClaimRequest(
        @Schema(
                        description = "The Handle to Claim with, retiring the generated one. Ignored when "
                                + "signing in merges into an account that already has one",
                        example = "PERCOLATING_FERRET",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                @NotBlank
                @Size(min = 3, max = 22)
                @Pattern(regexp = "^[A-Za-z0-9_]+$")
                String handle) {}
