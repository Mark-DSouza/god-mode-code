package dev.markdsouza.godmodecode.ratelimit;

import static org.assertj.core.api.Assertions.assertThat;

import dev.markdsouza.godmodecode.AbstractIntegrationTest;
import dev.markdsouza.godmodecode.Browser;
import dev.markdsouza.godmodecode.typing.Challenge;
import dev.markdsouza.godmodecode.typing.Discipline;
import dev.markdsouza.godmodecode.user.User;
import java.time.Duration;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/**
 * Rate limiting, driven through the HTTP boundary.
 *
 * A context of its own (the properties below differ from every other class'),
 * so its {@link RateLimiter} starts empty and a handful of requests is enough
 * to trip a limit — the shared context every other test class runs against
 * uses limits generous enough (application-test.yaml) that the rest of the
 * suite never brushes against them.
 *
 * TestRestTemplate keeps no cookie jar and every request in this class
 * originates from the same JVM, so every request here shares one source
 * address by construction (ClientAddress falls back to {@code
 * getRemoteAddr()} with no Cloudflare in front of it) — which proves the
 * per-address dimension fine, but cannot exercise "a different address is
 * unaffected" without a second process to send from.
 *
 * {@link RateLimiter} is a singleton for the life of the context, and every
 * request in this class shares one source address — so without this, one
 * test method's requests would count against the next method's budget.
 * {@code @DirtiesContext} rebuilds the context, and with it a fresh
 * RateLimiter, between methods.
 */
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_EACH_TEST_METHOD)
class RateLimitEndpointTest extends AbstractIntegrationTest {

    private static final int LIMIT = 3;

    @DynamicPropertySource
    static void tightLimits(DynamicPropertyRegistry registry) {
        for (String action : new String[] {"user-creation", "challenge-issuing", "run-submission"}) {
            registry.add("gmc.rate-limits.%s.limit".formatted(action), () -> LIMIT);
            registry.add("gmc.rate-limits.%s.window".formatted(action), () -> "1m");
        }
    }

    @Autowired
    TestRestTemplate http;

    @Test
    @DisplayName("too many Unclaimed Users from one address are refused")
    void tooManyUserCreationsFromOneAddressAreRefused() {
        for (int visitor = 0; visitor < LIMIT; visitor++) {
            assertThat(http.postForEntity("/api/users", null, User.class).getStatusCode())
                    .isEqualTo(HttpStatus.CREATED);
        }

        assertThat(http.postForEntity("/api/users", null, User.class).getStatusCode())
                .isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
    }

    @Test
    @DisplayName("too many Challenges asked for by one User are refused")
    void tooManyChallengesFromOneUserAreRefused() {
        Browser browser = Browser.arrivingAt(http);

        for (int ask = 0; ask < LIMIT; ask++) {
            assertThat(browser.asksFor(Discipline.QUOTES).getStatusCode()).isEqualTo(HttpStatus.CREATED);
        }

        assertThat(browser.asksFor(Discipline.QUOTES).getStatusCode()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
    }

    @Test
    @DisplayName("too many Runs submitted by one User are refused")
    void tooManyRunsFromOneUserAreRefused() {
        Browser browser = Browser.arrivingAt(http);
        Challenge challenge = browser.isHanded(Discipline.QUOTES);
        // The limit is checked before the Issue is even looked at, so the same
        // submission repeated (which the Issue itself would refuse on the second
        // attempt as a replay) is enough to prove the limit fires first.
        ResponseEntity<String> firstBatch = null;
        for (int submission = 0; submission < LIMIT; submission++) {
            firstBatch = browser.submits(Browser.perfectRun(challenge, Duration.ofSeconds(30)), String.class);
            assertThat(firstBatch.getStatusCode()).isNotEqualTo(HttpStatus.TOO_MANY_REQUESTS);
        }

        assertThat(browser.submits(Browser.perfectRun(challenge, Duration.ofSeconds(30)), String.class)
                        .getStatusCode())
                .isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
    }

    @Test
    @DisplayName("a returning visitor reading who they are is never rate limited")
    void readingTheCurrentUserIsNeverRateLimited() {
        Browser browser = Browser.arrivingAt(http);

        // Well past the user-creation limit, none of which apply here: this is
        // /api/users/me, not /api/users, and the whole point of checking the
        // cookie first is that a returning visitor never reaches the limiter.
        for (int read = 0; read < LIMIT * 3; read++) {
            assertThat(browser.reads("/api/users/me", User.class).getStatusCode()).isEqualTo(HttpStatus.OK);
        }
    }

}
