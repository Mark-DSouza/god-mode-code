package dev.markdsouza.godmodecode.profile;

import static org.assertj.core.api.Assertions.assertThat;

import dev.markdsouza.godmodecode.Browser;
import dev.markdsouza.godmodecode.judge.Verdict;
import dev.markdsouza.godmodecode.pattern.JudgedIntegrationTest;
import dev.markdsouza.godmodecode.pattern.PatternActivation;
import dev.markdsouza.godmodecode.pattern.SolveRun;
import dev.markdsouza.godmodecode.pattern.StubJudge;
import dev.markdsouza.godmodecode.typing.Discipline;
import dev.markdsouza.godmodecode.typing.TypingRun;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
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
 * A profile, driven through the HTTP boundary against a real PostgreSQL, with
 * the Runs behind it recorded through the endpoints a player would use.
 *
 * Nothing here inserts a Run by hand. A profile is entirely derived — every
 * figure on it is a query over Runs and none of it is stored — so a test that
 * wrote the rows itself would be checking arithmetic against numbers it had
 * chosen, rather than against what playing actually produces.
 */
class ProfileEndpointTest extends JudgedIntegrationTest {

    private static final String HASH_MAP = "hash-map-seen-lookup";
    private static final int TESTS = 6;

    /** Six lines in the shape ADR-0004 designs a Pattern around. */
    private static final String SOLUTION =
            """
                seen = {}
                for index, number in enumerate(numbers):
                    if target - number in seen:
                        return [seen[target - number], index]
                    seen[number] = index
                return []\
            """;

    @Autowired
    TestRestTemplate http;

    @Autowired
    JdbcTemplate jdbc;

    @BeforeEach
    void theCatalogueIsActivated() {
        StubJudge.answers(HASH_MAP, "passed", TESTS, TESTS);
        StubJudge.answers("sliding-window-longest-unique", "passed", TESTS, TESTS);
        http.postForObject("/api/patterns/activations", null, PatternActivation[].class);
    }

    @Test
    @DisplayName("a Personal Best is the highest WPM within each Discipline, derived from the Runs")
    void aPersonalBestIsTheHighestWpmWithinEachDiscipline() {
        Browser browser = Browser.arrivingAt(http);

        TypingRun slowQuote = browser.types(jdbc, Discipline.QUOTES, Duration.ofSeconds(45));
        TypingRun fastQuote = browser.types(jdbc, Discipline.QUOTES, Duration.ofSeconds(20));
        TypingRun prose = browser.types(jdbc, Discipline.PROSE, Duration.ofSeconds(50));
        SolveRun solved = solves(browser, Duration.ofSeconds(40));

        Profile profile = profileOf(browser);

        assertThat(fastQuote.wpm())
                .as("the shorter Run should have been the faster one")
                .isGreaterThan(slowQuote.wpm());

        // One per Discipline played, and each one is that Discipline's own
        // ceiling. Never mixed: a Prose Run does not raise a Quotes best, and
        // the Code Discipline is ranked against Solve Runs alone (ADR-0006).
        assertThat(profile.personalBests())
                .containsExactlyInAnyOrder(
                        new PersonalBest(Discipline.QUOTES, fastQuote.wpm()),
                        new PersonalBest(Discipline.PROSE, prose.wpm()),
                        new PersonalBest(Discipline.CODE, solved.wpm()));

        // Derived, never stored (CONTEXT.md). Nothing anywhere holds a Personal
        // Best — the profile is a query over the same rows the Runs went into.
        assertThat(jdbc.queryForObject(
                        """
                        SELECT count(*) FROM information_schema.columns
                        WHERE table_schema = 'public'
                          AND (column_name LIKE '%personal_best%' OR table_name LIKE '%personal_best%')
                        """,
                        Integer.class))
                .as("a Personal Best is derived from Runs, so there is nowhere for one to be written")
                .isZero();
    }

    @Test
    @DisplayName("a later, slower Run does not lower the Personal Best it failed to beat")
    void aSlowerRunDoesNotLowerThePersonalBest() {
        Browser browser = Browser.arrivingAt(http);

        TypingRun best = browser.types(jdbc, Discipline.QUOTES, Duration.ofSeconds(20));
        TypingRun andThenAnOffDay = browser.types(jdbc, Discipline.QUOTES, Duration.ofSeconds(50));

        assertThat(andThenAnOffDay.personalBest()).isFalse();
        assertThat(profileOf(browser).personalBests()).containsExactly(new PersonalBest(Discipline.QUOTES, best.wpm()));
    }

    @Test
    @DisplayName("only Passed Solve Runs are ranked, though a failure is still history")
    void onlyPassedSolveRunsAreRanked() {
        Browser browser = Browser.arrivingAt(http);
        StubJudge.answers(HASH_MAP, "failed", 2, TESTS);

        SolveRun failed = solves(browser, Duration.ofSeconds(15));

        Profile profile = profileOf(browser);

        assertThat(failed.verdict()).isEqualTo(Verdict.FAILED);
        assertThat(failed.personalBest())
                .as("a program that does not work is not a best at anything")
                .isFalse();
        assertThat(profile.personalBests()).isEmpty();
        // It happened, so it is in the history — carrying the Verdict that says
        // what it was, rather than being quietly dropped or silently counted.
        assertThat(profile.history()).singleElement().satisfies(entry -> {
            assertThat(entry.runId()).isEqualTo(failed.id());
            assertThat(entry.discipline()).isEqualTo(Discipline.CODE);
            assertThat(entry.verdict()).isEqualTo(Verdict.FAILED);
        });
    }

    @Test
    @DisplayName("history interleaves Typing Runs and Solve Runs chronologically, newest first")
    void historyInterleavesBothKindsOfRun() {
        Browser browser = Browser.arrivingAt(http);

        // Alternating, so an implementation that concatenated the two queries
        // instead of merging them would come out in an order this cannot miss.
        UUID first = browser.types(jdbc, Discipline.QUOTES, Duration.ofSeconds(30)).id();
        UUID second = solves(browser, Duration.ofSeconds(30)).id();
        UUID third = browser.types(jdbc, Discipline.PROSE, Duration.ofSeconds(30)).id();
        UUID fourth = solves(browser, Duration.ofSeconds(25)).id();

        Profile profile = profileOf(browser);

        assertThat(profile.history()).extracting(HistoryEntry::runId).containsExactly(fourth, third, second, first);
        assertThat(profile.history())
                .extracting(HistoryEntry::discipline)
                .containsExactly(Discipline.CODE, Discipline.PROSE, Discipline.CODE, Discipline.QUOTES);

        // Where they are lately: the mean of exactly the Runs above, so the
        // figure and the chart drawn from the same list cannot disagree.
        BigDecimal expected = profile.history().stream()
                .map(HistoryEntry::wpm)
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .divide(BigDecimal.valueOf(profile.history().size()), 1, RoundingMode.HALF_UP);
        assertThat(profile.recentAverageWpm()).isEqualByComparingTo(expected);
    }

    @Test
    @DisplayName("a User who has never played gets an empty profile, not a missing one")
    void aUserWhoHasNeverPlayedGetsAnEmptyProfile() {
        Browser browser = Browser.arrivingAt(http);

        ResponseEntity<Profile> response = browser.reads("/api/profile", Profile.class);

        // 200 and empty, not 404. They exist and have simply not started — the
        // screen has a beginning to show for that, and a not-found would read as
        // a fault.
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        Profile profile = response.getBody();
        assertThat(profile).isNotNull();
        assertThat(profile.user().handle()).isEqualTo(browser.user().handle());
        assertThat(profile.personalBests()).isEmpty();
        assertThat(profile.history()).isEmpty();
        // Null rather than zero. A best Accuracy of 0% and an average of 0 WPM
        // are claims about somebody's typing, and both would be false.
        assertThat(profile.bestAccuracy()).isNull();
        assertThat(profile.recentAverageWpm()).isNull();
    }

    @Test
    @DisplayName("best Accuracy comes from Typing Runs, which are the only Runs that have one")
    void bestAccuracyComesFromTypingRuns() {
        Browser browser = Browser.arrivingAt(http);

        TypingRun clean = browser.types(jdbc, Discipline.QUOTES, Duration.ofSeconds(30));
        solves(browser, Duration.ofSeconds(30));

        assertThat(clean.accuracy()).isEqualByComparingTo("100.0");
        assertThat(profileOf(browser).bestAccuracy()).isEqualByComparingTo(clean.accuracy());
    }

    @Test
    @DisplayName("a browser that is nobody has no profile to read")
    void aBrowserThatIsNobodyHasNoProfile() {
        assertThat(http.getForEntity("/api/profile", Profile.class).getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    /** Writes the one working solution this suite uses, over the given time. */
    private SolveRun solves(Browser browser, Duration took) {
        return browser.solves(jdbc, HASH_MAP, SOLUTION, took);
    }

    private Profile profileOf(Browser browser) {
        Profile profile = browser.reads("/api/profile", Profile.class).getBody();
        assertThat(profile).as("no profile came back").isNotNull();
        return profile;
    }
}
