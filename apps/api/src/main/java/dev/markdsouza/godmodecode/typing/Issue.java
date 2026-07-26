package dev.markdsouza.godmodecode.typing;

import java.time.Instant;
import java.util.UUID;

/**
 * A server's record that a specific Challenge was handed to a specific User at
 * a specific moment.
 *
 * {@code issuedAt} bounds a Run from below and {@code expiresAt} bounds it from
 * above (ADR-0003), and both are the server's own clock. Only the expiry
 * reaches the browser, in {@link Challenge} — the client has to notice expiry
 * before the player starts typing, and has no use at all for the issue time.
 *
 * @param consumedAt   when a Typing Run was verified against this Issue. Set
 *                     once, ever; a replay finds it already set.
 * @param supersededAt when the User asked for another Challenge instead. Kept
 *                     apart from {@code consumedAt} so an abandoned Challenge
 *                     stays distinguishable from a played one.
 */
record Issue(
        UUID id,
        UUID userId,
        UUID passageId,
        Instant issuedAt,
        Instant expiresAt,
        Instant consumedAt,
        Instant supersededAt) {

    /** Whether this Issue is still available to submit a Run against. */
    boolean isLive() {
        return consumedAt == null && supersededAt == null;
    }
}
