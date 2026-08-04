package dev.markdsouza.godmodecode.user;

import static org.assertj.core.api.Assertions.assertThat;

import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.MACSigner;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import dev.markdsouza.godmodecode.Browser;
import dev.markdsouza.godmodecode.pattern.JudgedIntegrationTest;
import dev.markdsouza.godmodecode.pattern.PatternActivation;
import dev.markdsouza.godmodecode.pattern.SolveRun;
import dev.markdsouza.godmodecode.pattern.StubJudge;
import dev.markdsouza.godmodecode.profile.PersonalBest;
import dev.markdsouza.godmodecode.profile.Profile;
import dev.markdsouza.godmodecode.typing.Discipline;
import dev.markdsouza.godmodecode.typing.TypingRun;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import javax.crypto.spec.SecretKeySpec;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;

/**
 * Claiming, driven through the HTTP boundary against a real PostgreSQL.
 *
 * The production {@link JwtDecoder} fetches its keys from a real Cognito user
 * pool, which does not exist in this suite. {@link StubIdentityProvider}
 * replaces it with one that trusts a fixed HMAC secret, so a token minted by
 * {@link #tokenFor} is exactly as valid to the application under test as one
 * Cognito would have issued — the endpoint under test never knows the
 * difference.
 */
class ClaimEndpointTest extends JudgedIntegrationTest {

    private static final byte[] SHARED_SECRET =
            "test-only-shared-secret-do-not-reuse-32b".getBytes(StandardCharsets.UTF_8);

    private static final String HASH_MAP = "hash-map-seen-lookup";
    private static final int TESTS = 6;
    private static final String SOLUTION =
            """
                seen = {}
                for index, number in enumerate(numbers):
                    if target - number in seen:
                        return [seen[target - number], index]
                    seen[number] = index
                return []\
            """;

    @TestConfiguration
    static class StubIdentityProvider {
        @Bean
        @Primary
        JwtDecoder testJwtDecoder() {
            return NimbusJwtDecoder.withSecretKey(new SecretKeySpec(SHARED_SECRET, "HmacSHA256"))
                    .build();
        }
    }

    @Autowired
    TestRestTemplate http;

    @Autowired
    JdbcTemplate jdbc;

    @BeforeEach
    void theCatalogueIsActivated() {
        StubJudge.answers(HASH_MAP, "passed", TESTS, TESTS);
        http.postForObject("/api/patterns/activations", null, PatternActivation[].class);
    }

    @Test
    @DisplayName("a first-time Claim preserves the Runs already recorded and retires the generated Handle")
    void firstTimeClaimPreservesRuns() {
        Browser browser = Browser.arrivingAt(http);
        TypingRun run = browser.types(jdbc, Discipline.QUOTES, Duration.ofSeconds(20));

        ResponseEntity<User> response = browser.claims(tokenFor("github|new-player"), "CHOSEN_HANDLE", User.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().id()).isEqualTo(browser.user().id());
        assertThat(response.getBody().handle()).isEqualTo("CHOSEN_HANDLE");
        assertThat(response.getBody().claimed()).isTrue();

        Profile profile = browser.reads("/api/profile", Profile.class).getBody();
        assertThat(profile).isNotNull();
        assertThat(profile.history()).extracting(entry -> entry.runId()).contains(run.id());
    }

    @Test
    @DisplayName("a chosen Handle already held by someone else is refused, same as on arrival")
    void handleUniquenessIsRejected() {
        Browser owner = Browser.arrivingAt(http);
        owner.claims(tokenFor("github|owner"), "ALREADY_TAKEN", User.class);

        Browser challenger = Browser.arrivingAt(http);
        ResponseEntity<User> response =
                challenger.claims(tokenFor("github|challenger"), "ALREADY_TAKEN", User.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        // Refused, not silently suffixed or dropped: the challenger is still
        // Unclaimed and still holds their own generated Handle.
        assertThat(challenger.reads("/api/users/me", User.class).getBody().claimed())
                .isFalse();
    }

    @Test
    @DisplayName("signing in to a User that already exists merges the Unclaimed User's Runs in, silently")
    void signingInMergesRuns() {
        Browser registered = Browser.arrivingAt(http);
        TypingRun oldRun = registered.types(jdbc, Discipline.PROSE, Duration.ofSeconds(30));
        String subject = "github|returning-player";
        registered.claims(tokenFor(subject), "REGISTERED_PLAYER", User.class);

        Browser guestSession = Browser.arrivingAt(http);
        TypingRun newRun = guestSession.types(jdbc, Discipline.QUOTES, Duration.ofSeconds(25));
        var guestId = guestSession.user().id();

        // No prompt, no conflict to resolve: the response is 200, the existing
        // account's Handle wins, and the Handle offered while merging is unused
        // (ADR-0007).
        ResponseEntity<User> merged = guestSession.claims(tokenFor(subject), "OFFERED_BUT_UNUSED", User.class);

        assertThat(merged.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(merged.getBody()).isNotNull();
        assertThat(merged.getBody().id()).isEqualTo(registered.user().id());
        assertThat(merged.getBody().handle()).isEqualTo("REGISTERED_PLAYER");

        // The merge is transactional and leaves nothing behind: no emptied
        // Unclaimed User row, and — since Issues cascade with the User that held
        // them — no orphaned Issue either.
        assertThat(jdbc.queryForObject("SELECT count(*) FROM users WHERE id = ?", Integer.class, guestId))
                .isZero();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM issues WHERE user_id = ?", Integer.class, guestId))
                .isZero();

        // Both histories, reattributed onto the surviving row.
        assertThat(jdbc.queryForObject(
                        "SELECT count(*) FROM typing_runs WHERE user_id = ?",
                        Integer.class,
                        registered.user().id()))
                .isEqualTo(2);

        // Personal Bests reflect the merged history immediately — this browser
        // is now recognised as the merged account (its cookie followed the
        // Set-Cookie, exactly as a real browser's would).
        Profile profile = guestSession.reads("/api/profile", Profile.class).getBody();
        assertThat(profile).isNotNull();
        assertThat(profile.personalBests())
                .containsExactlyInAnyOrder(
                        new PersonalBest(Discipline.PROSE, oldRun.wpm()),
                        new PersonalBest(Discipline.QUOTES, newRun.wpm()));
    }

    @Test
    @DisplayName("a merge reattributes Runs correctly even when both identities already hold one on the same Challenge")
    void mergeReattributesRunsOnTheSameChallenge() {
        Browser registered = Browser.arrivingAt(http);
        SolveRun slowerRun = registered.solves(jdbc, HASH_MAP, SOLUTION, Duration.ofSeconds(40));
        String subject = "github|shared-pattern-player";
        registered.claims(tokenFor(subject), "PATTERN_OWNER", User.class);

        Browser guestSession = Browser.arrivingAt(http);
        SolveRun fasterRun = guestSession.solves(jdbc, HASH_MAP, SOLUTION, Duration.ofSeconds(20));

        ResponseEntity<User> merged = guestSession.claims(tokenFor(subject), "OFFERED_BUT_UNUSED", User.class);
        assertThat(merged.getStatusCode()).isEqualTo(HttpStatus.OK);

        // Two Solve Runs against the same Pattern, both now under the one
        // surviving User — nothing about sharing a Challenge collides.
        assertThat(jdbc.queryForObject(
                        "SELECT count(*) FROM solve_runs WHERE user_id = ?",
                        Integer.class,
                        registered.user().id()))
                .isEqualTo(2);

        Profile profile = guestSession.reads("/api/profile", Profile.class).getBody();
        assertThat(profile).isNotNull();
        assertThat(profile.personalBests()).contains(new PersonalBest(Discipline.CODE, fasterRun.wpm()));
        assertThat(fasterRun.wpm()).isGreaterThan(slowerRun.wpm());
    }

    @Test
    @DisplayName("a browser that has never played has no User here to Claim")
    void aBrowserThatHasNeverPlayedCannotClaim() {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(tokenFor("github|nobody"));
        ResponseEntity<User> response = http.exchange(
                "/api/users/claim",
                HttpMethod.POST,
                new HttpEntity<>(new ClaimRequest("SOME_HANDLE"), headers),
                User.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    @DisplayName("a request with no bearer token is refused before it reaches any Claiming logic")
    void noBearerTokenIsRefused() {
        Browser browser = Browser.arrivingAt(http);

        ResponseEntity<User> response = http.exchange(
                "/api/users/claim",
                HttpMethod.POST,
                new HttpEntity<>(new ClaimRequest("SOME_HANDLE"), new HttpHeaders()),
                User.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(browser.reads("/api/users/me", User.class).getBody().claimed())
                .isFalse();
    }

    /** A token an identity provider would have signed, trusted only because of {@link StubIdentityProvider}. */
    private static String tokenFor(String subject) {
        try {
            JWTClaimsSet claims = new JWTClaimsSet.Builder()
                    .subject(subject)
                    .expirationTime(Date.from(Instant.now().plusSeconds(300)))
                    .build();
            SignedJWT jwt = new SignedJWT(new JWSHeader(JWSAlgorithm.HS256), claims);
            jwt.sign(new MACSigner(SHARED_SECRET));
            return jwt.serialize();
        } catch (Exception e) {
            throw new IllegalStateException("Could not mint a test token", e);
        }
    }
}
