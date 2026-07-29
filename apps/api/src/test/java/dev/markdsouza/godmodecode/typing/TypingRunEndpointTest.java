package dev.markdsouza.godmodecode.typing;

import dev.markdsouza.godmodecode.integrity.Rejection;
import dev.markdsouza.godmodecode.integrity.RejectionReason;
import static org.assertj.core.api.Assertions.assertThat;

import dev.markdsouza.godmodecode.AbstractIntegrationTest;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Verification, driven through the HTTP boundary against a real PostgreSQL.
 *
 * Every one of these is a claim about what the server does with numbers it did
 * not compute, which is the whole of ADR-0003.
 */
class TypingRunEndpointTest extends AbstractIntegrationTest {

    /**
     * Long enough to be a real Run and short enough to stay inside the window
     * the Issue is rewound by.
     */
    private static final Duration HALF_A_MINUTE = Duration.ofSeconds(30);

    @Autowired
    TestRestTemplate http;

    @Autowired
    JdbcTemplate jdbc;

    @Test
    @DisplayName("a verified Run is recorded and attributed to the User")
    void aVerifiedRunIsRecordedAndAttributedToTheUser() {
        Browser browser = Browser.arrivingAt(http);
        Challenge challenge = browser.isHanded(Discipline.QUOTES);
        Browser.rewind(jdbc, challenge, Duration.ofMinutes(1));

        ResponseEntity<TypingRun> response =
                browser.submits(Browser.perfectRun(challenge, HALF_A_MINUTE), TypingRun.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        TypingRun run = response.getBody();
        assertThat(run).isNotNull();
        assertThat(run.passageId()).isEqualTo(challenge.passage().id());
        assertThat(run.discipline()).isEqualTo(Discipline.QUOTES);
        assertThat(run.errors()).isZero();
        assertThat(run.accuracy()).isEqualByComparingTo("100.0");

        // A Typing Run cannot fail: it is either completed and recorded, or it
        // never happened. This one was recorded, against the User who typed it.
        UUID storedUser =
                jdbc.queryForObject("SELECT user_id FROM typing_runs WHERE id = ?", UUID.class, run.id());
        assertThat(storedUser).isEqualTo(browser.user().id());

        // The Issue is spent. Single use is what stops a replay (ADR-0003).
        assertThat(jdbc.queryForObject(
                        "SELECT consumed_at IS NOT NULL FROM issues WHERE id = ?",
                        Boolean.class,
                        challenge.issueId()))
                .isTrue();
    }

    @Test
    @DisplayName("the metrics are the server's arithmetic over the raw data, not the client's")
    void theMetricsAreTheServersArithmetic() {
        Browser browser = Browser.arrivingAt(http);
        Challenge challenge = browser.isHanded(Discipline.PROSE);
        Browser.rewind(jdbc, challenge, Duration.ofMinutes(1));

        int characters = challenge.passage().characterCount();
        // Three mistakes, each noticed and backspaced away, so the final text is
        // perfect and the keystroke count is not. Accuracy is correct keystrokes
        // over total keystrokes — the mistake counts against you even though you
        // fixed it, and the backspace itself does not count twice.
        int keystrokes = characters + 3;
        Instant completedAt = Instant.now();
        TypingRunSubmission submission = new TypingRunSubmission(
                challenge.issueId(),
                challenge.passage().text(),
                keystrokes,
                completedAt.minus(HALF_A_MINUTE),
                completedAt);

        TypingRun run = browser.submits(submission, TypingRun.class).getBody();

        assertThat(run).isNotNull();
        assertThat(run.keystrokes()).isEqualTo(keystrokes);
        assertThat(run.correctCharacters()).isEqualTo(characters);
        // Derived by the database from the two counts beside it, so it cannot
        // disagree with them.
        assertThat(run.errors()).isEqualTo(3);
        assertThat(run.elapsedMillis()).isEqualTo((int) HALF_A_MINUTE.toMillis());

        // Half a minute, so the words typed are half the words per minute. A
        // word is five characters, and only correct characters count.
        assertThat(run.wpm())
                .isEqualByComparingTo(BigDecimal.valueOf(characters / 5.0 * 2).setScale(1, java.math.RoundingMode.HALF_UP));
        assertThat(run.accuracy())
                .isEqualByComparingTo(
                        BigDecimal.valueOf(characters * 100.0 / keystrokes).setScale(1, java.math.RoundingMode.HALF_UP));
    }

    @Test
    @DisplayName("figures the client reports about itself are discarded")
    void clientReportedFiguresAreDiscarded() {
        Browser browser = Browser.arrivingAt(http);
        Challenge challenge = browser.isHanded(Discipline.QUOTES);
        Browser.rewind(jdbc, challenge, Duration.ofMinutes(1));

        Instant completedAt = Instant.now();
        // TypingRunSubmission has no field for either of these, which is the
        // design. Sending them anyway is the only way to prove that a client
        // which tries is ignored rather than believed.
        String withForgedMetrics =
                """
                {
                  "issueId": "%s",
                  "typedText": %s,
                  "keystrokes": %d,
                  "startedAt": "%s",
                  "completedAt": "%s",
                  "wpm": 999.9,
                  "accuracy": 100.0
                }
                """
                        .formatted(
                                challenge.issueId(),
                                asJsonString(challenge.passage().text()),
                                challenge.passage().characterCount(),
                                completedAt.minus(HALF_A_MINUTE),
                                completedAt);

        TypingRun run = browser.submitsRaw(withForgedMetrics, TypingRun.class).getBody();

        assertThat(run).isNotNull();
        assertThat(run.wpm()).isLessThan(BigDecimal.valueOf(999));
        assertThat(jdbc.queryForObject("SELECT wpm FROM typing_runs WHERE id = ?", BigDecimal.class, run.id()))
                .isEqualByComparingTo(run.wpm());
    }

    @Test
    @DisplayName("text that is not the Passage that was issued is refused")
    void textThatIsNotThePassageIsRefused() {
        Browser browser = Browser.arrivingAt(http);
        Challenge challenge = browser.isHanded(Discipline.QUOTES);
        Browser.rewind(jdbc, challenge, Duration.ofMinutes(1));

        Instant completedAt = Instant.now();
        TypingRunSubmission truncated = new TypingRunSubmission(
                challenge.issueId(),
                // A Run ends on the final character, so a completed Run is
                // exactly as long as what it transcribed. This one is not.
                challenge.passage().text().substring(0, 20),
                20,
                completedAt.minus(HALF_A_MINUTE),
                completedAt);

        assertRefused(browser.submits(truncated, Rejection.class), RejectionReason.PASSAGE_MISMATCH);
        assertThat(countRunsAgainst(challenge)).isZero();
    }

    @Test
    @DisplayName("text of the right length that is not the Passage is a Run worth nothing")
    void unrelatedTextOfTheRightLengthIsWorthNothing() {
        Browser browser = Browser.arrivingAt(http);
        Challenge challenge = browser.isHanded(Discipline.QUOTES);
        Browser.rewind(jdbc, challenge, Duration.ofMinutes(1));

        // Every character deliberately wrong, and exactly as many of them as the
        // Passage has.
        String nothingLikeIt = challenge.passage().text().chars()
                .mapToObj(character -> character == 'a' ? "b" : "a")
                .collect(java.util.stream.Collectors.joining());

        Instant completedAt = Instant.now();
        TypingRun run = browser
                .submits(
                        new TypingRunSubmission(
                                challenge.issueId(),
                                nothingLikeIt,
                                nothingLikeIt.length(),
                                completedAt.minus(HALF_A_MINUTE),
                                completedAt),
                        TypingRun.class)
                .getBody();

        // Recorded rather than refused, and that is the deliberate boundary of
        // the correspondence check. Length is the only structural thing a
        // submission can be measured against; any threshold on how *much* of the
        // Passage had to be right would be a number invented here, and it would
        // start refusing the genuinely terrible Run of someone who lost their
        // place. There is nothing to gain by submitting one of these: only
        // correct characters count toward WPM, so a Run that transcribed nothing
        // scores nothing and ranks below every honest attempt.
        assertThat(run).isNotNull();
        assertThat(run.correctCharacters()).isZero();
        assertThat(run.wpm()).isEqualByComparingTo("0.0");
        assertThat(run.accuracy()).isEqualByComparingTo("0.0");
    }

    @Test
    @DisplayName("a duration that does not fit the time since the Challenge went out is refused")
    void anImpossibleDurationIsRefused() {
        Browser browser = Browser.arrivingAt(http);
        Challenge challenge = browser.isHanded(Discipline.QUOTES);

        // The Challenge was handed out moments ago and this Run claims to have
        // taken half an hour. The client's clock can say anything; the gap it
        // reports still cannot exceed the gap the server watched go past.
        assertRefused(
                browser.submits(Browser.perfectRun(challenge, Duration.ofMinutes(30)), Rejection.class),
                RejectionReason.IMPOSSIBLE_DURATION);
        assertThat(countRunsAgainst(challenge)).isZero();
    }

    @Test
    @DisplayName("a Run that finished before it started is refused")
    void aRunThatFinishedBeforeItStartedIsRefused() {
        Browser browser = Browser.arrivingAt(http);
        Challenge challenge = browser.isHanded(Discipline.QUOTES);

        Instant startedAt = Instant.now();
        TypingRunSubmission backwards = new TypingRunSubmission(
                challenge.issueId(),
                challenge.passage().text(),
                challenge.passage().characterCount(),
                startedAt,
                startedAt.minusSeconds(10));

        assertRefused(browser.submits(backwards, Rejection.class), RejectionReason.IMPOSSIBLE_DURATION);
        assertThat(countRunsAgainst(challenge)).isZero();
    }

    @Test
    @DisplayName("a speed beyond a human hand is refused")
    void anImplausibleSpeedIsRefused() {
        Browser browser = Browser.arrivingAt(http);
        Challenge challenge = browser.isHanded(Discipline.QUOTES);
        Browser.rewind(jdbc, challenge, Duration.ofSeconds(10));

        // A whole quotation, correctly, in one second. The duration itself is
        // possible against the issue time; it is the speed it implies that is not.
        assertRefused(
                browser.submits(Browser.perfectRun(challenge, Duration.ofSeconds(1)), Rejection.class),
                RejectionReason.IMPLAUSIBLE_SPEED);
        assertThat(countRunsAgainst(challenge)).isZero();
    }

    @Test
    @DisplayName("fewer keystrokes than characters typed is refused")
    void tooFewKeystrokesIsRefused() {
        Browser browser = Browser.arrivingAt(http);
        Challenge challenge = browser.isHanded(Discipline.QUOTES);
        Browser.rewind(jdbc, challenge, Duration.ofMinutes(1));

        Instant completedAt = Instant.now();
        // Keystrokes are Accuracy's denominator, so under-reporting them is the
        // cheap way to inflate it. Nobody types N characters in fewer than N.
        TypingRunSubmission understated = new TypingRunSubmission(
                challenge.issueId(),
                challenge.passage().text(),
                challenge.passage().characterCount() - 1,
                completedAt.minus(HALF_A_MINUTE),
                completedAt);

        assertRefused(browser.submits(understated, Rejection.class), RejectionReason.IMPLAUSIBLE_KEYSTROKES);
        assertThat(countRunsAgainst(challenge)).isZero();
    }

    @Test
    @DisplayName("submitting the same Run twice records it once")
    void aReplayedSubmissionIsRefused() {
        Browser browser = Browser.arrivingAt(http);
        Challenge challenge = browser.isHanded(Discipline.QUOTES);
        Browser.rewind(jdbc, challenge, Duration.ofMinutes(1));
        TypingRunSubmission submission = Browser.perfectRun(challenge, HALF_A_MINUTE);

        assertThat(browser.submits(submission, TypingRun.class).getStatusCode())
                .isEqualTo(HttpStatus.CREATED);

        assertRefused(browser.submits(submission, Rejection.class), RejectionReason.ISSUE_ALREADY_USED);
        assertThat(countRunsAgainst(challenge)).isEqualTo(1);
    }

    @Test
    @DisplayName("a Challenge answered after it expired is refused")
    void anExpiredChallengeIsRefused() {
        Browser browser = Browser.arrivingAt(http);
        Challenge challenge = browser.isHanded(Discipline.QUOTES);

        // Rewound past its own window. ADR-0003 wants the client to notice this
        // before the player starts typing — the server refusing afterwards is
        // the backstop, not the mechanism.
        Browser.rewind(jdbc, challenge, Duration.ofHours(1));

        assertRefused(
                browser.submits(Browser.perfectRun(challenge, HALF_A_MINUTE), Rejection.class),
                RejectionReason.ISSUE_EXPIRED);
        assertThat(countRunsAgainst(challenge)).isZero();
    }

    @Test
    @DisplayName("a Challenge abandoned for another one cannot be answered")
    void anAbandonedChallengeIsRefused() {
        Browser browser = Browser.arrivingAt(http);
        Challenge abandoned = browser.isHanded(Discipline.QUOTES);
        Browser.rewind(jdbc, abandoned, Duration.ofMinutes(1));

        browser.isHanded(Discipline.PROSE);

        // Holding two Challenges and submitting whichever went better is exactly
        // what one live Issue per User forecloses.
        assertRefused(
                browser.submits(Browser.perfectRun(abandoned, HALF_A_MINUTE), Rejection.class),
                RejectionReason.ISSUE_SUPERSEDED);
        assertThat(countRunsAgainst(abandoned)).isZero();
    }

    @Test
    @DisplayName("somebody else's Challenge is no Challenge at all")
    void anotherUsersChallengeIsRefused() {
        Browser mine = Browser.arrivingAt(http);
        Browser theirs = Browser.arrivingAt(http);
        Challenge theirChallenge = theirs.isHanded(Discipline.QUOTES);
        Browser.rewind(jdbc, theirChallenge, Duration.ofMinutes(1));

        // Told only that there is no such Issue. Whether one exists under that
        // id is not something a guesser is entitled to learn.
        assertRefused(
                mine.submits(Browser.perfectRun(theirChallenge, HALF_A_MINUTE), Rejection.class),
                RejectionReason.NO_SUCH_ISSUE);
        assertThat(countRunsAgainst(theirChallenge)).isZero();
    }

    @Test
    @DisplayName("an Issue nobody was ever handed is no Challenge at all")
    void anInventedIssueIsRefused() {
        Browser browser = Browser.arrivingAt(http);
        Instant completedAt = Instant.now();

        ResponseEntity<Rejection> response = browser.submits(
                new TypingRunSubmission(
                        UUID.randomUUID(),
                        "whatever this is",
                        16,
                        completedAt.minus(HALF_A_MINUTE),
                        completedAt),
                Rejection.class);

        assertRefused(response, RejectionReason.NO_SUCH_ISSUE);
    }

    @Test
    @DisplayName("a browser that is nobody yet cannot record a Run")
    void aBrowserThatIsNobodyCannotRecordARun() {
        Browser browser = Browser.arrivingAt(http);
        Challenge challenge = browser.isHanded(Discipline.QUOTES);

        ResponseEntity<String> response = http.postForEntity(
                "/api/typing-runs", Browser.perfectRun(challenge, HALF_A_MINUTE), String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    private static void assertRefused(ResponseEntity<Rejection> response, RejectionReason expected) {
        // 422 rather than 400: the request was well formed and understood, and
        // it is the Run that did not survive.
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNPROCESSABLE_ENTITY);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().reason()).isEqualTo(expected);
        assertThat(response.getBody().explanation()).isNotBlank();
    }

    /**
     * How many Runs exist against this Challenge.
     *
     * Scoped to the Issue rather than counting the table, because the suite
     * shares one database and other tests are recording Runs in it. Zero here is
     * the claim that matters: a refused Run leaves nothing behind, because a
     * Typing Run is either completed or it never happened.
     */
    private Integer countRunsAgainst(Challenge challenge) {
        return jdbc.queryForObject(
                "SELECT count(*) FROM typing_runs WHERE issue_id = ?", Integer.class, challenge.issueId());
    }

    /** The Passage is full of quotation marks and backslashes are not welcome in JSON. */
    private static String asJsonString(String value) {
        return "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"") + "\"";
    }
}
