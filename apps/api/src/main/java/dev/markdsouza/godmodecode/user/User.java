package dev.markdsouza.godmodecode.user;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.UUID;

/**
 * Anyone who has played.
 *
 * There is one of these, not two. An Unclaimed User is this same record with
 * {@code claimed} false — the state, not a separate kind of person (ADR-0007) —
 * so every screen, query and payload built on top of it keeps working unchanged
 * once credentials arrive.
 *
 * @param id      stable identifier, safe to publish: the browser is recognised
 *                by a separate secret, never by this.
 * @param handle  the display name, {@code GERUND_CREATURE} while Unclaimed.
 * @param claimed whether credentials have been attached.
 */
@Schema(description = "A player, whether or not they have Claimed their identity")
public record User(
        @Schema(
                        description = "Stable identifier",
                        example = "3f1c0b1a-5c2e-4d3b-9f8a-1e2d3c4b5a69",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                UUID id,
        @Schema(
                        description = "Display name",
                        example = "PERCOLATING_FERRET",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String handle,
        @Schema(
                        description = "Whether credentials have been attached to this User",
                        example = "false",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                boolean claimed) {}
