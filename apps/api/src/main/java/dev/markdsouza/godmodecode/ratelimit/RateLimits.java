package dev.markdsouza.godmodecode.ratelimit;

import java.util.UUID;
import org.springframework.stereotype.Component;

/**
 * The three request-level limits ADR-0007 calls for, named for what they
 * guard rather than left as bare {@link RateLimiter} calls at each call site.
 *
 * Every check touches both of its counters even once one has already tripped
 * — {@code &} rather than {@code &&} — so a request that is over its User
 * limit still counts against its address limit. Short-circuiting would let a
 * caller who already knows they are blocked on one dimension probe the other
 * for free.
 */
@Component
public class RateLimits {

    private final RateLimiter limiter;
    private final RateLimitsProperties properties;

    RateLimits(RateLimiter limiter, RateLimitsProperties properties) {
        this.limiter = limiter;
        this.properties = properties;
    }

    /** {@code POST /api/users}: the actual leaderboard-farming vector once guests are ranked (ADR-0007). */
    public boolean allowUserCreation(String sourceAddress) {
        return check("user-creation:ip:" + sourceAddress, properties.userCreation());
    }

    /** {@code POST /api/challenges}, by the User asking and by where they are asking from. */
    public boolean allowChallengeIssuing(UUID userId, String sourceAddress) {
        return checkByUserAndAddress("challenge", properties.challengeIssuing(), userId, sourceAddress);
    }

    /** {@code POST /api/typing-runs}, by the User submitting and by where they are submitting from. */
    public boolean allowRunSubmission(UUID userId, String sourceAddress) {
        return checkByUserAndAddress("run", properties.runSubmission(), userId, sourceAddress);
    }

    private boolean checkByUserAndAddress(
            String action, RateLimitsProperties.Limit limit, UUID userId, String sourceAddress) {
        boolean byUser = check(action + ":user:" + userId, limit);
        boolean byAddress = check(action + ":ip:" + sourceAddress, limit);
        return byUser & byAddress;
    }

    private boolean check(String key, RateLimitsProperties.Limit limit) {
        return limiter.allow(key, limit.limit(), limit.window());
    }
}
