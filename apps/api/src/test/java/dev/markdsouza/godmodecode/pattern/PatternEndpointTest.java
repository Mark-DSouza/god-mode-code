package dev.markdsouza.godmodecode.pattern;

import static org.assertj.core.api.Assertions.assertThat;

import dev.markdsouza.godmodecode.Browser;
import java.time.Duration;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * The catalogue, driven through the HTTP boundary against a real PostgreSQL and
 * a judge stubbed at its own.
 *
 * The claims here are about what a player can see and be given: that a Pattern
 * nobody has proved is invisible, that the contract they are judged against is
 * shown to them, and that the two things they must never receive — the answer
 * and the Hidden Tests — are not in the response.
 */
class PatternEndpointTest extends JudgedIntegrationTest {

    private static final String HASH_MAP = "hash-map-seen-lookup";
    private static final String SLIDING_WINDOW = "sliding-window-longest-unique";

    /** Both shipped Patterns have two Example Tests and four Hidden ones. */
    private static final int TESTS_PER_SHIPPED_PATTERN = 6;

    @Autowired
    TestRestTemplate http;

    @Autowired
    JdbcTemplate jdbc;

    /**
     * Patterns invented by a test are cleared up; the shipped catalogue is left
     * activated, because activation is a one-way door in the application too.
     */
    @AfterEach
    void removeInventedPatterns() {
        jdbc.update("DELETE FROM pattern_tests WHERE pattern_id IN (SELECT id FROM patterns WHERE slug LIKE 'test-%')");
        jdbc.update("DELETE FROM patterns WHERE slug LIKE 'test-%'");
    }

    @Test
    @DisplayName("a Pattern whose reference solution fails is not activated and cannot be seen")
    void aPatternWhoseReferenceSolutionFailsIsNotActivated() {
        invent("test-broken-tests", 3);
        // The judge ran the reference solution and it did not satisfy the
        // tests. Either the answer is wrong or a test is — and since nobody
        // ever sees a Hidden Test, the second is the case this gate exists for.
        StubJudge.answers("test-broken-tests", "failed", 1, 3);

        PatternActivation activation = activate("test-broken-tests");

        assertThat(activation.activated()).isFalse();
        assertThat(activation.explanation()).contains("did not pass").contains("1 of 3");

        assertThat(jdbc.queryForObject(
                        "SELECT activated_at IS NULL FROM patterns WHERE slug = 'test-broken-tests'", Boolean.class))
                .as("the gate let a Pattern with failing tests through")
                .isTrue();
        assertThat(slugsOf(browse(""))).doesNotContain("test-broken-tests");
    }

    @Test
    @DisplayName("a judge running a different number of tests is a skew, not an activation")
    void aJudgeRunningADifferentNumberOfTestsIsRefused() {
        invent("test-skewed", 4);
        // Passed, honestly, against a stale copy of the Pattern with one test in
        // it. The Verdict is true and says nothing about the four tests the
        // curator wrote.
        StubJudge.answers("test-skewed", "passed", 1, 1);

        PatternActivation activation = activate("test-skewed");

        assertThat(activation.activated()).isFalse();
        assertThat(activation.explanation()).contains("ran 1 tests and this Pattern has 4");
        assertThat(slugsOf(browse(""))).doesNotContain("test-skewed");
    }

    @Test
    @DisplayName("the shipped catalogue is browsable by Family and filterable by Seniority once activated")
    void theCatalogueIsBrowsableAndFilterable() {
        activateTheShippedCatalogue();

        assertThat(slugsOf(browse(""))).contains(HASH_MAP, SLIDING_WINDOW);
        assertThat(slugsOf(browse("?family=SLIDING_WINDOW"))).containsExactly(SLIDING_WINDOW);
        assertThat(slugsOf(browse("?seniority=JUNIOR"))).containsExactly(HASH_MAP);
        // The two narrowings compose, and a Family with nothing at that
        // Seniority is empty rather than an error.
        assertThat(browse("?family=SLIDING_WINDOW&seniority=JUNIOR")).isEmpty();
    }

    @Test
    @DisplayName("the prompt and Example Tests are shown, and the answer and Hidden Tests are not")
    void theContractIsShownAndTheAnswerIsNot() {
        activateTheShippedCatalogue();

        Pattern pattern = Arrays.stream(browse(""))
                .filter(candidate -> candidate.slug().equals(HASH_MAP))
                .findFirst()
                .orElseThrow();

        assertThat(pattern.prompt()).isNotBlank();
        assertThat(pattern.scaffold()).isEqualTo("def pair_sum(numbers, target):");
        assertThat(pattern.exampleTests()).hasSize(2);
        assertThat(pattern.exampleTests().getFirst().call()).isEqualTo("pair_sum([2, 7, 11, 15], 9)");

        // Against the raw body, not the record. A record cannot hold a field it
        // does not declare, so asserting on it would prove nothing about what
        // was serialised — and it is the bytes on the wire that leak.
        String body = http.getForObject("/api/patterns", String.class);
        assertThat(body)
                .as("a Hidden Test reached the browser")
                .doesNotContain("pair_sum([3, 2, 4], 6)")
                .doesNotContain("longest_unique('dvdf')");
        assertThat(body).as("the reference solution reached the browser").doesNotContain("seen[number] = index");
    }

    @Test
    @DisplayName("being handed a Pattern records an Issue with a window for thinking in")
    void beingHandedAPatternRecordsAnIssue() {
        activateTheShippedCatalogue();
        Browser browser = Browser.arrivingAt(http);

        ResponseEntity<SolveChallenge> response = browser.asksFor(HASH_MAP, SolveChallenge.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        SolveChallenge challenge = response.getBody();
        assertThat(challenge).isNotNull();
        assertThat(challenge.pattern().slug()).isEqualTo(HASH_MAP);

        // Flat and generous, where a Passage's window scales with its length. A
        // Pattern is answered by thinking and there is nothing to time by the
        // character (ADR-0003).
        assertThat(challenge.expiresAt())
                .isBetween(Instant.now().plus(Duration.ofMinutes(18)), Instant.now().plus(Duration.ofMinutes(21)));

        assertThat(jdbc.queryForObject(
                        "SELECT pattern_id IS NOT NULL AND passage_id IS NULL FROM issues WHERE id = ?",
                        Boolean.class,
                        challenge.issueId()))
                .as("the Issue does not record a Pattern Challenge")
                .isTrue();
    }

    @Test
    @DisplayName("an unactivated Pattern cannot be asked for, and neither can one that does not exist")
    void anUnactivatedPatternCannotBeAskedFor() {
        invent("test-unproven", 2);
        Browser browser = Browser.arrivingAt(http);

        assertThat(browser.asksFor("test-unproven", String.class).getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(browser.asksFor("no-such-pattern", String.class).getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    // ---------------------------------------------------------------- setup ----

    /** Puts a Pattern in the database, inactive, with this many tests. */
    private void invent(String slug, int tests) {
        UUID id = jdbc.queryForObject(
                """
                INSERT INTO patterns (slug, name, family, seniority, prompt, scaffold, reference_solution)
                VALUES (?, 'An invented Pattern', 'STACK', 'PRINCIPAL', 'Do the thing.', 'def thing():', '    pass')
                RETURNING id
                """,
                UUID.class,
                slug);
        for (int ordinal = 1; ordinal <= tests; ordinal++) {
            jdbc.update(
                    "INSERT INTO pattern_tests (pattern_id, hidden, ordinal, name, call, expected) "
                            + "VALUES (?, ?, ?, ?, 'thing()', 'None')",
                    id,
                    ordinal > 1,
                    ordinal,
                    "case " + ordinal);
        }
    }

    /**
     * Runs the gate and returns what it made of one Pattern.
     *
     * Everything else awaiting activation is told to pass, so the answer is
     * about the Pattern the test is actually asking about rather than about
     * whatever a previous test left behind.
     */
    private PatternActivation activate(String slug) {
        StubJudge.answers(HASH_MAP, "passed", TESTS_PER_SHIPPED_PATTERN, TESTS_PER_SHIPPED_PATTERN);
        StubJudge.answers(SLIDING_WINDOW, "passed", TESTS_PER_SHIPPED_PATTERN, TESTS_PER_SHIPPED_PATTERN);

        PatternActivation[] activations = http.postForObject("/api/patterns/activations", null, PatternActivation[].class);
        return Arrays.stream(activations)
                .filter(activation -> activation.slug().equals(slug))
                .findFirst()
                .orElseThrow(() -> new AssertionError(slug + " was not awaiting activation"));
    }

    private void activateTheShippedCatalogue() {
        StubJudge.answers(HASH_MAP, "passed", TESTS_PER_SHIPPED_PATTERN, TESTS_PER_SHIPPED_PATTERN);
        StubJudge.answers(SLIDING_WINDOW, "passed", TESTS_PER_SHIPPED_PATTERN, TESTS_PER_SHIPPED_PATTERN);
        http.postForObject("/api/patterns/activations", null, PatternActivation[].class);
    }

    private Pattern[] browse(String query) {
        return http.getForObject("/api/patterns" + query, Pattern[].class);
    }

    private static List<String> slugsOf(Pattern[] patterns) {
        return Arrays.stream(patterns).map(Pattern::slug).toList();
    }
}
