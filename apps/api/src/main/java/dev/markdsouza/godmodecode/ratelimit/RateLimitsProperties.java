package dev.markdsouza.godmodecode.ratelimit;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * How many times each guarded action may happen, per key, per window.
 *
 * No defaults here, unlike {@link dev.markdsouza.godmodecode.judge.JudgeProperties}
 * next to it: every environment — local, test, production — states its own
 * numbers in {@code application.yaml} rather than inheriting a guess baked
 * into the code, since the right limit for a test suite firing requests in a
 * tight loop and the right limit for a real visitor are not close to the same
 * number.
 *
 * Unclaimed User creation is the actual leaderboard-farming vector once
 * guests are ranked (ADR-0007) and is checked by source address alone —
 * there is no User yet to key it by. Challenge issuing and Run submission
 * are checked by User and by source address both, because either one on its
 * own is a limit a farmer routes around: a fixed address behind a NAT would
 * throttle every honest player sharing it, and a limit by User alone does
 * nothing to a script that mints a fresh Unclaimed User per request.
 *
 * @param userCreation     guards {@code POST /api/users}, by source address.
 * @param challengeIssuing guards {@code POST /api/challenges}, by User and by
 *                          source address.
 * @param runSubmission    guards {@code POST /api/typing-runs}, by User and
 *                          by source address.
 */
@ConfigurationProperties("gmc.rate-limits")
public record RateLimitsProperties(Limit userCreation, Limit challengeIssuing, Limit runSubmission) {

    /**
     * @param limit  how many occurrences {@code window} allows.
     * @param window how often the limit resets.
     */
    public record Limit(int limit, Duration window) {}
}
