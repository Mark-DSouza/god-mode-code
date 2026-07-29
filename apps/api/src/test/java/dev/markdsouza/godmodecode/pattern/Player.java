package dev.markdsouza.godmodecode.pattern;

import static org.assertj.core.api.Assertions.assertThat;

import dev.markdsouza.godmodecode.typing.Challenge;
import dev.markdsouza.godmodecode.typing.ChallengeRequest;
import dev.markdsouza.godmodecode.typing.Discipline;
import dev.markdsouza.godmodecode.user.RecognitionCookie;
import dev.markdsouza.godmodecode.user.User;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Somebody who has been here before, and the requests the Code Discipline gives
 * them.
 *
 * TestRestTemplate keeps no cookie jar, so the Recognition Key has to travel on
 * every request explicitly. Wrapping that here keeps each test reading as what a
 * player did rather than as which header went where.
 */
final class Player {

    private final TestRestTemplate http;
    private final String recognitionKey;
    private final User user;

    private Player(TestRestTemplate http, String recognitionKey, User user) {
        this.http = http;
        this.recognitionKey = recognitionKey;
        this.user = user;
    }

    /** Arrives, becomes an Unclaimed User, and holds on to the cookie it was given. */
    static Player arrivingAt(TestRestTemplate http) {
        ResponseEntity<User> created = http.postForEntity("/api/users", null, User.class);
        String setCookie = created.getHeaders().getFirst(HttpHeaders.SET_COOKIE);
        assertThat(setCookie).as("arriving did not set a Recognition Key").isNotNull();

        return new Player(
                http,
                setCookie.substring(setCookie.indexOf('=') + 1, setCookie.indexOf(';')),
                created.getBody());
    }

    User user() {
        return user;
    }

    <T> ResponseEntity<T> asksFor(String slug, Class<T> as) {
        return send(HttpMethod.POST, "/api/patterns/" + slug + "/challenges", null, as);
    }

    /** Asks for a Pattern and insists on being handed it. */
    SolveChallenge isHanded(String slug) {
        ResponseEntity<SolveChallenge> response = asksFor(slug, SolveChallenge.class);
        // The status, not just the body: an error document deserialises into a
        // record of nulls perfectly happily, and a test that accepted one would
        // fail three assertions later somewhere unrelated.
        assertThat(response.getStatusCode()).as("no Challenge was issued for " + slug).isEqualTo(HttpStatus.CREATED);
        return response.getBody();
    }

    /**
     * Asks for a Passage instead, which is the other kind of Challenge against
     * the same Issue machinery.
     *
     * Here so a test can prove the two do not cross: a Passage Challenge
     * answered with source is not a Solve Run, and must not spend the Issue
     * somebody is still going to type against.
     */
    Challenge isHandedAPassage() {
        ResponseEntity<Challenge> response =
                send(HttpMethod.POST, "/api/challenges", new ChallengeRequest(Discipline.QUOTES), Challenge.class);
        assertThat(response.getStatusCode()).as("no Passage Challenge was issued").isEqualTo(HttpStatus.CREATED);
        return response.getBody();
    }

    <T> ResponseEntity<T> submits(SolveRunSubmission submission, Class<T> as) {
        return send(HttpMethod.POST, "/api/solve-runs", submission, as);
    }

    private <T> ResponseEntity<T> send(HttpMethod method, String path, Object body, Class<T> as) {
        HttpHeaders headers = new HttpHeaders();
        headers.put(HttpHeaders.COOKIE, List.of(RecognitionCookie.NAME + "=" + recognitionKey));
        headers.setContentType(MediaType.APPLICATION_JSON);
        return http.exchange(path, method, new HttpEntity<>(body, headers), as);
    }

    /**
     * A submission that wrote this source over this long, without ever deleting
     * anything.
     *
     * The timestamps are the client's own clock, which is all a browser has.
     * Only the gap between them means anything to the server.
     */
    static SolveRunSubmission wrote(SolveChallenge challenge, String source, Duration took) {
        Instant completedAt = Instant.now();
        return new SolveRunSubmission(
                challenge.issueId(), source, source.length(), completedAt.minus(took), completedAt);
    }

    /**
     * Rewinds an Issue so that it was handed out this long ago.
     *
     * Every duration rule is measured against the server's own record of when the
     * Challenge went out (ADR-0003), and inside a test suite that record is
     * always a few milliseconds old — so a Solve Run that claims to have taken a
     * minute is correctly refused as impossible. Moving the Issue backwards is
     * how a test gets to be a player who sat and thought for a while.
     */
    static void rewind(JdbcTemplate jdbc, SolveChallenge challenge, Duration held) {
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
}
