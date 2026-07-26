package dev.markdsouza.godmodecode.typing;

import static org.assertj.core.api.Assertions.assertThat;

import dev.markdsouza.godmodecode.user.RecognitionCookie;
import dev.markdsouza.godmodecode.user.User;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * A browser that has already become someone, and the two requests it can make.
 *
 * TestRestTemplate keeps no cookie jar, so every request has to carry the
 * Recognition Key explicitly. Wrapping that here keeps the tests reading as
 * what a player did rather than as which header went where.
 */
final class Browser {

    private final TestRestTemplate http;
    private final String recognitionKey;
    private final User user;

    private Browser(TestRestTemplate http, String recognitionKey, User user) {
        this.http = http;
        this.recognitionKey = recognitionKey;
        this.user = user;
    }

    /** Arrives, becomes an Unclaimed User, and holds on to the cookie it was given. */
    static Browser arrivingAt(TestRestTemplate http) {
        ResponseEntity<User> created = http.postForEntity("/api/users", null, User.class);
        String setCookie = created.getHeaders().getFirst(HttpHeaders.SET_COOKIE);
        assertThat(setCookie).as("arriving did not set a Recognition Key").isNotNull();

        return new Browser(
                http,
                setCookie.substring(setCookie.indexOf('=') + 1, setCookie.indexOf(';')),
                created.getBody());
    }

    User user() {
        return user;
    }

    ResponseEntity<Challenge> asksFor(Discipline discipline) {
        return send("/api/challenges", new ChallengeRequest(discipline), Challenge.class);
    }

    /** Asks for a Challenge and insists on getting one. */
    Challenge isHanded(Discipline discipline) {
        ResponseEntity<Challenge> response = asksFor(discipline);
        assertThat(response.getBody()).as("no Challenge was issued").isNotNull();
        return response.getBody();
    }

    <T> ResponseEntity<T> submits(TypingRunSubmission submission, Class<T> as) {
        return send("/api/typing-runs", submission, as);
    }

    /**
     * Submits a body the typed record cannot express.
     *
     * Needed for exactly one thing: proving that a client which reports its own
     * WPM is ignored rather than believed. {@link TypingRunSubmission} has
     * nowhere to put such a field, which is the design — so the only way to send
     * one is to write the JSON by hand.
     */
    <T> ResponseEntity<T> submitsRaw(String json, Class<T> as) {
        return send("/api/typing-runs", json, as);
    }

    private <T> ResponseEntity<T> send(String path, Object body, Class<T> as) {
        HttpHeaders headers = new HttpHeaders();
        headers.put(HttpHeaders.COOKIE, List.of(RecognitionCookie.NAME + "=" + recognitionKey));
        headers.setContentType(MediaType.APPLICATION_JSON);
        return http.exchange(path, HttpMethod.POST, new HttpEntity<>(body, headers), as);
    }

    /**
     * Rewinds an Issue so that it was handed out this long ago.
     *
     * Every duration rule is measured against the server's own record of when
     * the Challenge went out (ADR-0003), and inside a test suite that record is
     * always a few milliseconds old — so a Run that claims to have taken thirty
     * seconds is correctly refused as impossible. Moving the Issue backwards is
     * how a test gets to be a player who read the Passage for a while, without
     * the suite having to wait for the clock.
     *
     * Both timestamps move together, because they are one window: the expiry is
     * defined relative to the issue time, and dragging only one of them would
     * make the row describe a state the application cannot produce.
     */
    static void rewind(JdbcTemplate jdbc, Challenge challenge, Duration held) {
        jdbc.update(
                """
                UPDATE issues
                SET issued_at = issued_at - (? * interval '1 millisecond'),
                    expires_at = expires_at - (? * interval '1 millisecond')
                WHERE id = ?
                """,
                (double) held.toMillis(),
                (double) held.toMillis(),
                challenge.issueId());
    }

    /**
     * A submission that transcribes the Passage exactly, over a given duration,
     * with no mistakes along the way.
     *
     * The timestamps are the client's own clock, which is the only thing a
     * browser has. Only the gap between them is meaningful to the server.
     */
    static TypingRunSubmission perfectRun(Challenge challenge, Duration took) {
        Instant completedAt = Instant.now();
        return new TypingRunSubmission(
                challenge.issueId(),
                challenge.passage().text(),
                challenge.passage().characterCount(),
                completedAt.minus(took),
                completedAt);
    }
}
