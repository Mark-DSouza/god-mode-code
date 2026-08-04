package dev.markdsouza.godmodecode;

import static org.assertj.core.api.Assertions.assertThat;

import dev.markdsouza.godmodecode.pattern.SolveChallenge;
import dev.markdsouza.godmodecode.pattern.SolveRun;
import dev.markdsouza.godmodecode.pattern.SolveRunSubmission;
import dev.markdsouza.godmodecode.typing.Challenge;
import dev.markdsouza.godmodecode.typing.ChallengeRequest;
import dev.markdsouza.godmodecode.typing.Discipline;
import dev.markdsouza.godmodecode.typing.TypingRun;
import dev.markdsouza.godmodecode.typing.TypingRunSubmission;
import dev.markdsouza.godmodecode.user.ClaimRequest;
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
 * A browser that has already become someone, and the requests it can make.
 *
 * TestRestTemplate keeps no cookie jar, so every request has to carry the
 * Recognition Key explicitly. Wrapping that here keeps the tests reading as
 * what somebody did rather than as which header went where.
 *
 * One of these rather than one per Discipline, because there is one of these in
 * reality: the same browser, holding the same Recognition Key, can be handed a
 * Passage or a Pattern, and it holds exactly one Challenge across both
 * (ADR-0003). A second helper for the Code Discipline would have been the same
 * cookie plumbing written twice — and the only test that can prove the
 * one-live-Issue rule spans both kinds needs one object that can ask for both.
 */
public final class Browser {

    /**
     * How far back {@link #types} and {@link #solves} rewind the Challenge they
     * were handed.
     *
     * A Run cannot be longer than the window the server itself watched go past,
     * and inside a test suite that window is a few milliseconds old. Two minutes
     * is longer than any Run a test has reason to describe and well inside the
     * ten a Challenge is live for.
     */
    private static final Duration HELD = Duration.ofMinutes(2);

    private final TestRestTemplate http;
    // Not final: a real browser overwrites its cookie the moment a response
    // carries a new one, and Claiming's merge does exactly that (ADR-0007) — a
    // Browser that could not follow it would be testing a browser that forgets.
    private String recognitionKey;
    private final User user;

    private Browser(TestRestTemplate http, String recognitionKey, User user) {
        this.http = http;
        this.recognitionKey = recognitionKey;
        this.user = user;
    }

    /** Arrives, becomes an Unclaimed User, and holds on to the cookie it was given. */
    public static Browser arrivingAt(TestRestTemplate http) {
        ResponseEntity<User> created = http.postForEntity("/api/users", null, User.class);
        String setCookie = created.getHeaders().getFirst(HttpHeaders.SET_COOKIE);
        assertThat(setCookie).as("arriving did not set a Recognition Key").isNotNull();

        return new Browser(
                http,
                setCookie.substring(setCookie.indexOf('=') + 1, setCookie.indexOf(';')),
                created.getBody());
    }

    public User user() {
        return user;
    }

    public ResponseEntity<Challenge> asksFor(Discipline discipline) {
        return send("/api/challenges", new ChallengeRequest(discipline), Challenge.class);
    }

    /** Asks for a Challenge and insists on getting one. */
    public Challenge isHanded(Discipline discipline) {
        ResponseEntity<Challenge> response = asksFor(discipline);
        assertThat(response.getBody()).as("no Challenge was issued").isNotNull();
        return response.getBody();
    }

    public <T> ResponseEntity<T> submits(TypingRunSubmission submission, Class<T> as) {
        return send("/api/typing-runs", submission, as);
    }

    /**
     * Plays one Typing Run: asks for a Passage in this Discipline, takes this
     * long over it, and transcribes it perfectly.
     *
     * Here rather than in each test class because three of them wanted it and
     * none of them wanted the plumbing — the interesting part of such a test is
     * how fast the Run was and in which Discipline, not the rewind that makes
     * the duration believable.
     */
    public TypingRun types(JdbcTemplate jdbc, Discipline discipline, Duration took) {
        Challenge challenge = isHanded(discipline);
        rewind(jdbc, challenge, HELD);
        TypingRun run = submits(perfectRun(challenge, took), TypingRun.class).getBody();
        assertThat(run).as("the Run was not recorded").isNotNull();
        return run;
    }

    /**
     * Plays one Solve Run: asks for this Pattern, and writes this source over
     * this long.
     *
     * The Verdict is the judge's, so a caller that cares about it programs the
     * judge before calling — this only gets as far as having something judged.
     */
    public SolveRun solves(JdbcTemplate jdbc, String slug, String source, Duration took) {
        SolveChallenge challenge = isHanded(slug);
        rewind(jdbc, challenge, HELD);
        SolveRun run = submits(wrote(challenge, source, took), SolveRun.class).getBody();
        assertThat(run).as("the Solve Run was not recorded").isNotNull();
        return run;
    }

    /**
     * Claims this browser's User with the given bearer token and chosen Handle,
     * following whatever Recognition Key the response hands back — the same way
     * a real browser would overwrite its cookie on {@code Set-Cookie}.
     */
    public <T> ResponseEntity<T> claims(String bearerToken, String handle, Class<T> as) {
        HttpHeaders headers = new HttpHeaders();
        headers.put(HttpHeaders.COOKIE, List.of(RecognitionCookie.NAME + "=" + recognitionKey));
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(bearerToken);
        ResponseEntity<T> response = http.exchange(
                "/api/users/claim", HttpMethod.POST, new HttpEntity<>(new ClaimRequest(handle), headers), as);

        String setCookie = response.getHeaders().getFirst(HttpHeaders.SET_COOKIE);
        if (setCookie != null) {
            recognitionKey = setCookie.substring(setCookie.indexOf('=') + 1, setCookie.indexOf(';'));
        }
        return response;
    }

    /** Reads a path as whoever this browser is, carrying its Recognition Key. */
    public <T> ResponseEntity<T> reads(String path, Class<T> as) {
        HttpHeaders headers = new HttpHeaders();
        headers.put(HttpHeaders.COOKIE, List.of(RecognitionCookie.NAME + "=" + recognitionKey));
        headers.setAccept(List.of(MediaType.APPLICATION_JSON));
        return http.exchange(path, HttpMethod.GET, new HttpEntity<>(headers), as);
    }

    /**
     * Submits a body the typed record cannot express.
     *
     * Needed for exactly one thing: proving that a client which reports its own
     * WPM is ignored rather than believed. {@link TypingRunSubmission} has
     * nowhere to put such a field, which is the design — so the only way to send
     * one is to write the JSON by hand.
     */
    /** Asks to be handed one named Pattern. */
    public <T> ResponseEntity<T> asksFor(String slug, Class<T> as) {
        return send("/api/patterns/" + slug + "/challenges", null, as);
    }

    /** Asks for a Pattern and insists on being handed it. */
    public SolveChallenge isHanded(String slug) {
        ResponseEntity<SolveChallenge> response = asksFor(slug, SolveChallenge.class);
        // The status, not just the body: an error document deserialises into a
        // record of nulls perfectly happily, and a test that accepted one would
        // fail three assertions later somewhere unrelated.
        assertThat(response.getStatusCode())
                .as("no Challenge was issued for " + slug)
                .isEqualTo(HttpStatus.CREATED);
        return response.getBody();
    }

    public <T> ResponseEntity<T> submits(SolveRunSubmission submission, Class<T> as) {
        return send("/api/solve-runs", submission, as);
    }

    /**
     * A submission that wrote this source over this long, without ever deleting
     * anything.
     *
     * The counterpart to {@link #perfectRun}: there is no perfect source, only
     * source, because a Solve Run is judged by executing it rather than compared
     * against a target.
     */
    public static SolveRunSubmission wrote(SolveChallenge challenge, String source, Duration took) {
        Instant completedAt = Instant.now();
        return new SolveRunSubmission(
                challenge.issueId(), source, source.length(), completedAt.minus(took), completedAt);
    }

    public <T> ResponseEntity<T> submitsRaw(String json, Class<T> as) {
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
    public static void rewind(JdbcTemplate jdbc, Challenge challenge, Duration held) {
        rewindIssue(jdbc, challenge.issueId(), held);
    }

    /** The same rewind, against a Pattern Challenge. */
    public static void rewind(JdbcTemplate jdbc, SolveChallenge challenge, Duration held) {
        rewindIssue(jdbc, challenge.issueId(), held);
    }

    private static void rewindIssue(JdbcTemplate jdbc, java.util.UUID issueId, Duration held) {
        jdbc.update(
                """
                UPDATE issues
                SET issued_at = issued_at - (? * interval '1 millisecond'),
                    expires_at = expires_at - (? * interval '1 millisecond')
                WHERE id = ?
                """,
                (double) held.toMillis(),
                (double) held.toMillis(),
                issueId);
    }

    /**
     * A submission that transcribes the Passage exactly, over a given duration,
     * with no mistakes along the way.
     *
     * The timestamps are the client's own clock, which is the only thing a
     * browser has. Only the gap between them is meaningful to the server.
     */
    public static TypingRunSubmission perfectRun(Challenge challenge, Duration took) {
        Instant completedAt = Instant.now();
        return new TypingRunSubmission(
                challenge.issueId(),
                challenge.passage().text(),
                challenge.passage().characterCount(),
                completedAt.minus(took),
                completedAt);
    }
}
