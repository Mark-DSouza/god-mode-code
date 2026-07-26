package dev.markdsouza.godmodecode.typing;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.util.UUID;

/**
 * What you are asked to do in a single sitting: a Passage, and the Issue that
 * records it was handed to you.
 *
 * {@code expiresAt} is published because ADR-0003 requires the client to notice
 * expiry <em>before</em> the player starts typing — rejecting a submission after
 * four minutes of work is a bug report, not a security control. The issue time
 * is not published: it is the anchor the server checks durations against, and
 * nothing in the browser has any use for it.
 *
 * @param issueId what the client hands back when the Run is submitted.
 */
@Schema(description = "A Passage to transcribe, and the Issue that recorded it going out")
public record Challenge(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID issueId,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) Passage passage,
        @Schema(
                        description = "After this moment the Challenge can no longer be answered",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Instant expiresAt) {}
