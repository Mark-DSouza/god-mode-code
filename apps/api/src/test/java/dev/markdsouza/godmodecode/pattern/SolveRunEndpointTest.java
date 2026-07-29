package dev.markdsouza.godmodecode.pattern;

import static org.assertj.core.api.Assertions.assertThat;

import dev.markdsouza.godmodecode.Browser;
import dev.markdsouza.godmodecode.integrity.Rejection;
import dev.markdsouza.godmodecode.integrity.RejectionReason;
import dev.markdsouza.godmodecode.judge.Verdict;
import dev.markdsouza.godmodecode.typing.Challenge;
import dev.markdsouza.godmodecode.typing.Discipline;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * A Solve Run, driven through the HTTP boundary with the judge stubbed at its
 * own.
 *
 * Every claim here is about what the server does with a submission it did not
 * compute anything for: which Verdict it believes (the judge's, and only the
 * judge's), which numbers it recomputes, and which submissions never become a
 * Run at all.
 */
class SolveRunEndpointTest extends JudgedIntegrationTest {

    private static final String HASH_MAP = "hash-map-seen-lookup";
    private static final int TESTS = 6;

    /**
     * A plausible answer: six lines, the shape ADR-0004 designs a Pattern
     * around.
     *
     * The closing delimiter sits one level out from the content on purpose, so
     * the block keeps the four spaces that make it a function body. Python is
     * indentation-sensitive and this is the string the judge would really be
     * sent.
     */
    private static final String SOLUTION =
            """
                seen = {}
                for index, number in enumerate(numbers):
                    if target - number in seen:
                        return [seen[target - number], index]
                    seen[number] = index
                return []\
            """;

    /** Long enough to be real thinking, short enough to fit the window it is rewound by. */
    private static final Duration A_MINUTE = Duration.ofMinutes(1);

    @Autowired
    TestRestTemplate http;

    @Autowired
    JdbcTemplate jdbc;

    @BeforeEach
    void theCatalogueIsActivated() {
        // Both shipped Patterns, so a run of this class does not leave one of
        // them still awaiting a gate that never comes.
        StubJudge.answers(HASH_MAP, "passed", TESTS, TESTS);
        StubJudge.answers("sliding-window-longest-unique", "passed", TESTS, TESTS);
        http.postForObject("/api/patterns/activations", null, PatternActivation[].class);
    }

    @Test
    @DisplayName("a judged Solve Run is recorded, attributed, and spends its Issue")
    void aJudgedSolveRunIsRecorded() {
        Browser browser = Browser.arrivingAt(http);
        SolveChallenge challenge = browser.isHanded(HASH_MAP);
        Browser.rewind(jdbc, challenge, Duration.ofMinutes(2));
        StubJudge.answers(HASH_MAP, "passed", TESTS, TESTS);

        ResponseEntity<SolveRun> response =
                browser.submits(Browser.wrote(challenge, SOLUTION, A_MINUTE), SolveRun.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        SolveRun run = response.getBody();
        assertThat(run).isNotNull();
        assertThat(run.verdict()).isEqualTo(Verdict.PASSED);
        assertThat(run.testsPassed()).isEqualTo(TESTS);
        assertThat(run.testsTotal()).isEqualTo(TESTS);
        assertThat(run.patternSlug()).isEqualTo(HASH_MAP);
        // Every submitted character over five, per minute — the secondary
        // reading, computed by the server from the raw submission.
        assertThat(run.wpm())
                .isEqualByComparingTo(
                        java.math.BigDecimal.valueOf(SOLUTION.length() / 5.0)
                                .setScale(1, java.math.RoundingMode.HALF_UP));

        assertThat(jdbc.queryForObject("SELECT user_id FROM solve_runs WHERE id = ?", UUID.class, run.id()))
                .isEqualTo(browser.user().id());
        // The Scaffold is not stored on the Run: it belongs to the Pattern and
        // is the same on every Run of it.
        assertThat(jdbc.queryForObject("SELECT source FROM solve_runs WHERE id = ?", String.class, run.id()))
                .isEqualTo(SOLUTION)
                .doesNotContain("def pair_sum");

        assertThat(jdbc.queryForObject(
                        "SELECT consumed_at IS NOT NULL FROM issues WHERE id = ?", Boolean.class, challenge.issueId()))
                .as("the Issue was not spent")
                .isTrue();
    }

    @Test
    @DisplayName("the judge is sent the Scaffold and the written lines assembled into one program")
    void theJudgeIsSentTheAssembledProgram() {
        Browser browser = Browser.arrivingAt(http);
        SolveChallenge challenge = browser.isHanded(HASH_MAP);
        Browser.rewind(jdbc, challenge, Duration.ofMinutes(2));
        StubJudge.answers(HASH_MAP, "passed", TESTS, TESTS);

        browser.submits(Browser.wrote(challenge, SOLUTION, A_MINUTE), SolveRun.class);

        // The browser never sends the Scaffold back, so the server puts it
        // there — and puts it there exactly once, above lines whose indentation
        // nothing has touched.
        assertThat(StubJudge.lastSource()).isEqualTo("def pair_sum(numbers, target):\n" + SOLUTION);
    }

    @Test
    @DisplayName("a Failed Verdict is a recorded Solve Run, not a refusal")
    void aFailedVerdictIsStillARun() {
        Browser browser = Browser.arrivingAt(http);
        SolveChallenge challenge = browser.isHanded(HASH_MAP);
        Browser.rewind(jdbc, challenge, Duration.ofMinutes(2));
        StubJudge.answers(HASH_MAP, "failed", 2, TESTS);

        ResponseEntity<SolveRun> response =
                browser.submits(Browser.wrote(challenge, SOLUTION, A_MINUTE), SolveRun.class);

        // A Solve Run can fail, and a failure belongs to the player exactly as
        // much as a pass does (ADR-0006). Two of six is what they were told,
        // and which four is not.
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().verdict()).isEqualTo(Verdict.FAILED);
        assertThat(response.getBody().testsPassed()).isEqualTo(2);
        assertThat(jdbc.queryForObject(
                        "SELECT count(*) FROM solve_runs WHERE issue_id = ?", Integer.class, challenge.issueId()))
                .isOne();
    }

    @Test
    @DisplayName("a judge that cannot answer leaves the Challenge live and records nothing")
    void anUnreachableJudgeLeavesTheChallengeLive() {
        Browser browser = Browser.arrivingAt(http);
        SolveChallenge challenge = browser.isHanded(HASH_MAP);
        Browser.rewind(jdbc, challenge, Duration.ofMinutes(2));
        StubJudge.reset();
        StubJudge.otherwise(StubJudge.Behaviour.UNAVAILABLE);

        ResponseEntity<Unjudged> response =
                browser.submits(Browser.wrote(challenge, SOLUTION, A_MINUTE), Unjudged.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().explanation()).contains("still yours");

        // Nothing about the submitted source can be concluded from an outage, so
        // no Run is recorded and nothing is spent. The same lines can be sent
        // again once the judge is back.
        assertThat(jdbc.queryForObject(
                        "SELECT count(*) FROM solve_runs WHERE issue_id = ?", Integer.class, challenge.issueId()))
                .isZero();
        assertThat(jdbc.queryForObject(
                        "SELECT consumed_at IS NULL FROM issues WHERE id = ?", Boolean.class, challenge.issueId()))
                .isTrue();
    }

    @Test
    @DisplayName("a replayed submission finds the Issue already spent")
    void aReplayedSubmissionIsRefused() {
        Browser browser = Browser.arrivingAt(http);
        SolveChallenge challenge = browser.isHanded(HASH_MAP);
        Browser.rewind(jdbc, challenge, Duration.ofMinutes(2));
        StubJudge.answers(HASH_MAP, "passed", TESTS, TESTS);
        SolveRunSubmission submission = Browser.wrote(challenge, SOLUTION, A_MINUTE);

        browser.submits(submission, SolveRun.class);
        ResponseEntity<Rejection> replay = browser.submits(submission, Rejection.class);

        assertThat(replay.getStatusCode()).isEqualTo(HttpStatus.UNPROCESSABLE_ENTITY);
        assertThat(replay.getBody()).isNotNull();
        assertThat(replay.getBody().reason()).isEqualTo(RejectionReason.ISSUE_ALREADY_USED);
    }

    @Test
    @DisplayName("a Challenge answered too long after it went out is refused")
    void anExpiredChallengeIsRefused() {
        Browser browser = Browser.arrivingAt(http);
        SolveChallenge challenge = browser.isHanded(HASH_MAP);
        // Past the twenty-minute window, which the client is expected to have
        // noticed first — this is the server refusing to be the last line.
        Browser.rewind(jdbc, challenge, Duration.ofMinutes(25));
        StubJudge.answers(HASH_MAP, "passed", TESTS, TESTS);

        ResponseEntity<Rejection> response =
                browser.submits(Browser.wrote(challenge, SOLUTION, A_MINUTE), Rejection.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNPROCESSABLE_ENTITY);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().reason()).isEqualTo(RejectionReason.ISSUE_EXPIRED);
        // Refused before a container was started for it.
        assertThat(StubJudge.lastSource()).isNull();
    }

    @Test
    @DisplayName("fewer keystrokes than characters written is refused")
    void fewerKeystrokesThanCharactersIsRefused() {
        Browser browser = Browser.arrivingAt(http);
        SolveChallenge challenge = browser.isHanded(HASH_MAP);
        Browser.rewind(jdbc, challenge, Duration.ofMinutes(2));
        StubJudge.answers(HASH_MAP, "passed", TESTS, TESTS);

        Instant completedAt = Instant.now();
        ResponseEntity<Rejection> response = browser.submits(
                new SolveRunSubmission(
                        challenge.issueId(), SOLUTION, SOLUTION.length() - 1, completedAt.minus(A_MINUTE), completedAt),
                Rejection.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNPROCESSABLE_ENTITY);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().reason()).isEqualTo(RejectionReason.IMPLAUSIBLE_KEYSTROKES);
    }

    @Test
    @DisplayName("only a Passed Solve Run can be a Personal Best, and it says what it beat")
    void onlyAPassedSolveRunCanBeAPersonalBest() {
        Browser browser = Browser.arrivingAt(http);

        SolveRun first = solvesIn(browser, Duration.ofSeconds(50));
        assertThat(first.personalBest()).isTrue();
        assertThat(first.previousBestWpm()).as("there was nothing to beat").isNull();

        // Written faster than the best, and it does not work. Only Passed Solve
        // Runs are ranked (CONTEXT.md), so this sets nothing however quick it
        // was — the alternative is a best held by a program that fails.
        StubJudge.answers(HASH_MAP, "failed", 2, TESTS);
        SolveRun quickAndWrong = solvesIn(browser, Duration.ofSeconds(10));
        assertThat(quickAndWrong.wpm()).isGreaterThan(first.wpm());
        assertThat(quickAndWrong.personalBest()).isFalse();

        StubJudge.answers(HASH_MAP, "passed", TESTS, TESTS);
        SolveRun quickAndRight = solvesIn(browser, Duration.ofSeconds(20));
        assertThat(quickAndRight.personalBest()).isTrue();
        // The best it beat, not the faster failure in between.
        assertThat(quickAndRight.previousBestWpm()).isEqualByComparingTo(first.wpm());
    }

    /** Writes the same working solution over the given time, against a fresh Challenge. */
    private SolveRun solvesIn(Browser browser, Duration took) {
        SolveChallenge challenge = browser.isHanded(HASH_MAP);
        Browser.rewind(jdbc, challenge, Duration.ofMinutes(2));
        SolveRun run = browser.submits(Browser.wrote(challenge, SOLUTION, took), SolveRun.class)
                .getBody();
        assertThat(run).as("the Solve Run was not recorded").isNotNull();
        return run;
    }

    @Test
    @DisplayName("a Passage Challenge cannot be answered with source")
    void aPassageChallengeCannotBeAnsweredWithSource() {
        Browser browser = Browser.arrivingAt(http);
        Challenge passage = browser.isHanded(Discipline.QUOTES);

        ResponseEntity<Rejection> response = browser.submits(
                new SolveRunSubmission(
                        passage.issueId(),
                        SOLUTION,
                        SOLUTION.length(),
                        Instant.now().minus(A_MINUTE),
                        Instant.now()),
                Rejection.class);

        // Told only that there is no such Issue. It is a real Issue and it is
        // theirs, but it is not a Pattern Challenge, and it is left unspent for
        // the Typing Run it was actually handed out for.
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNPROCESSABLE_ENTITY);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().reason()).isEqualTo(RejectionReason.NO_SUCH_ISSUE);
        assertThat(jdbc.queryForObject(
                        "SELECT consumed_at IS NULL FROM issues WHERE id = ?", Boolean.class, passage.issueId()))
                .isTrue();
    }
}
