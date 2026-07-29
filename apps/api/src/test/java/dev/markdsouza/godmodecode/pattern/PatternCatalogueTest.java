package dev.markdsouza.godmodecode.pattern;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.markdsouza.godmodecode.AbstractIntegrationTest;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Stream;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * The two halves of a Pattern have to say the same thing.
 *
 * A Pattern lives in two places by design: everything a player reads is in this
 * service's database, and the tests that decide a Verdict are compiled into the
 * judge's binary, on a host with no credentials and no egress (ADR-0005). They
 * are deployed separately and nothing at runtime can compare them.
 *
 * The activation gate catches the crude version of that skew — it refuses a
 * Pattern when the judge reports running a different number of tests than the
 * Pattern has. It cannot catch two catalogues that agree on six and disagree
 * about what the six are, and that case matters twice over: the Example Tests
 * shown to the player would be a contract nobody is actually judged against, and
 * a reference solution proven against the judge's copy would prove nothing about
 * the copy the curator wrote.
 *
 * This is where the two are compared, because a build is the only place they are
 * ever in the same room.
 */
class PatternCatalogueTest extends AbstractIntegrationTest {

    /**
     * The judge's own catalogue, relative to the api module — which is the
     * working directory under Surefire.
     */
    private static final Path JUDGE_CATALOGUE =
            Path.of("..", "judge", "internal", "pattern", "catalogue");

    private static final ObjectMapper JSON = new ObjectMapper();

    @Autowired
    JdbcTemplate jdbc;

    @Test
    @DisplayName("every Pattern the judge can judge is one the database ships, and the reverse")
    void theTwoCataloguesHoldTheSamePatterns() throws IOException {
        assertThat(slugsInTheDatabase())
                .as("a Pattern exists in one catalogue and not the other, so it is either unjudgeable "
                        + "or unreachable")
                .containsExactlyInAnyOrderElementsOf(slugsInTheJudge());
    }

    @Test
    @DisplayName("each Pattern's Scaffold and tests are identical on both sides")
    void thePatternsThemselvesAgree() throws IOException {
        for (Path file : judgeCatalogueFiles()) {
            JsonNode judged = JSON.readTree(Files.readString(file));
            String slug = judged.path("id").asText();

            // The Scaffold is half of every program the judge executes: the
            // backend assembles it with the player's lines, and the judge runs
            // the result. Two versions of it means the tests call a signature
            // the player never saw.
            assertThat(scaffoldInTheDatabase(slug))
                    .as("the Scaffold of %s differs between the two catalogues", slug)
                    .isEqualTo(judged.path("scaffold").asText());

            assertThat(testsInTheDatabase(slug, false))
                    .as("the Example Tests of %s differ, so the player is shown a contract "
                            + "nothing judges them against", slug)
                    .isEqualTo(testsIn(judged.path("exampleTests")));

            // Hidden Tests are in the database for exactly one reason: so this
            // comparison and the activation gate's count can be made. Nothing
            // serves them.
            assertThat(testsInTheDatabase(slug, true))
                    .as("the Hidden Tests of %s differ, so the gate proves the reference solution "
                            + "against tests the curator did not write", slug)
                    .isEqualTo(testsIn(judged.path("hiddenTests")));
        }
    }

    // ------------------------------------------------------------- reading ----

    private List<String> slugsInTheDatabase() {
        return jdbc.queryForList("SELECT slug FROM patterns ORDER BY slug", String.class);
    }

    private List<String> slugsInTheJudge() throws IOException {
        List<String> slugs = new ArrayList<>();
        for (Path file : judgeCatalogueFiles()) {
            slugs.add(JSON.readTree(Files.readString(file)).path("id").asText());
        }
        return slugs;
    }

    private List<Path> judgeCatalogueFiles() throws IOException {
        assertThat(JUDGE_CATALOGUE)
                .as("the judge's catalogue is not where this test expects it")
                .isDirectory();
        try (Stream<Path> files = Files.list(JUDGE_CATALOGUE)) {
            List<Path> found = files.filter(path -> path.toString().endsWith(".json"))
                    .sorted()
                    .toList();
            assertThat(found).as("the judge has no Patterns at all").isNotEmpty();
            return found;
        }
    }

    private String scaffoldInTheDatabase(String slug) {
        return jdbc.queryForObject("SELECT scaffold FROM patterns WHERE slug = ?", String.class, slug);
    }

    /**
     * One Pattern's tests, in the order they are shown, as comparable text.
     *
     * Flattened to strings rather than compared field by field so that a
     * mismatch reports both sides in full — an assertion that says "expected
     * [pair_sum([3, 3], 6) -> [0, 1]] but found [pair_sum([3, 3], 6) -> [0, 2]]"
     * is a diff somebody can act on.
     */
    private List<String> testsInTheDatabase(String slug, boolean hidden) {
        return jdbc
                .queryForList(
                        """
                        SELECT t.name, t.call, t.expected
                        FROM pattern_tests t
                        JOIN patterns p ON p.id = t.pattern_id
                        WHERE p.slug = ? AND t.hidden = ?
                        ORDER BY t.ordinal
                        """,
                        slug,
                        hidden)
                .stream()
                .map(row -> describe((String) row.get("name"), (String) row.get("call"), (String) row.get("expected")))
                .toList();
    }

    private static List<String> testsIn(JsonNode tests) {
        List<String> described = new ArrayList<>();
        for (JsonNode test : tests) {
            described.add(describe(
                    test.path("name").asText(), test.path("call").asText(), test.path("expected").asText()));
        }
        return described;
    }

    private static String describe(String name, String call, String expected) {
        return "%s: %s -> %s".formatted(name, call, expected);
    }
}
