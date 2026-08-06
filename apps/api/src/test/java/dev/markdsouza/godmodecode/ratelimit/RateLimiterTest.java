package dev.markdsouza.godmodecode.ratelimit;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/** Pure logic, no Spring context: the HTTP-boundary tests prove the endpoints call this correctly. */
class RateLimiterTest {

    @Test
    @DisplayName("the first `limit` calls in a window are allowed, and the next one is not")
    void allowsUpToTheLimitThenRefuses() {
        RateLimiter limiter = new RateLimiter();

        assertThat(limiter.allow("key", 3, Duration.ofMinutes(1))).isTrue();
        assertThat(limiter.allow("key", 3, Duration.ofMinutes(1))).isTrue();
        assertThat(limiter.allow("key", 3, Duration.ofMinutes(1))).isTrue();
        assertThat(limiter.allow("key", 3, Duration.ofMinutes(1))).isFalse();
    }

    @Test
    @DisplayName("different keys are counted separately")
    void keysAreIndependent() {
        RateLimiter limiter = new RateLimiter();

        assertThat(limiter.allow("a", 1, Duration.ofMinutes(1))).isTrue();
        // "a" is now at its limit; "b" has never been asked.
        assertThat(limiter.allow("b", 1, Duration.ofMinutes(1))).isTrue();
        assertThat(limiter.allow("a", 1, Duration.ofMinutes(1))).isFalse();
    }

    @Test
    @DisplayName("a limit is temporary: the window resets once it has elapsed")
    void theWindowResets() throws InterruptedException {
        RateLimiter limiter = new RateLimiter();
        Duration window = Duration.ofMillis(30);

        assertThat(limiter.allow("key", 1, window)).isTrue();
        assertThat(limiter.allow("key", 1, window)).isFalse();

        Thread.sleep(window.toMillis() * 3);

        assertThat(limiter.allow("key", 1, window)).isTrue();
    }
}
