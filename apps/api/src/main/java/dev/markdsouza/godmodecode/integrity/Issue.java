package dev.markdsouza.godmodecode.integrity;

import java.time.Instant;
import java.util.UUID;

/**
 * A server's record that a specific Challenge was handed to a specific User at
 * a specific moment.
 *
 * {@code issuedAt} bounds a Run from below and {@code expiresAt} bounds it from
 * above (ADR-0003), and both are the server's own clock. Only the expiry
 * reaches the browser — the client has to notice expiry before the player
 * starts, and has no use at all for the issue time.
 *
 * One Issue serves both kinds of Run. A Typing Run and a Solve Run are separate
 * aggregates with nothing in common but a User and a timestamp (ADR-0006), but
 * "was this Challenge really handed to this person, and is it still answerable"
 * is the same question either way — and answering it in two places would be two
 * chances to answer it differently.
 *
 * @param passageId    set when the Challenge was a Passage to transcribe.
 * @param patternId    set when it was a Pattern to solve. Exactly one of the two
 *                     is present, which the database enforces rather than
 *                     whichever service happens to write the row.
 * @param consumedAt   when a Run was verified against this Issue. Set once,
 *                     ever; a replay finds it already set.
 * @param supersededAt when the User asked for another Challenge instead. Kept
 *                     apart from {@code consumedAt} so an abandoned Challenge
 *                     stays distinguishable from a played one.
 */
public record Issue(
        UUID id,
        UUID userId,
        UUID passageId,
        UUID patternId,
        Instant issuedAt,
        Instant expiresAt,
        Instant consumedAt,
        Instant supersededAt) {

    /** Whether this Issue is still available to submit a Run against. */
    public boolean isLive() {
        return consumedAt == null && supersededAt == null;
    }
}
