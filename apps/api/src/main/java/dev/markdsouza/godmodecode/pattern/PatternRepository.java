package dev.markdsouza.godmodecode.pattern;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.ResultSetExtractor;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

@Repository
class PatternRepository {

    /**
     * A Pattern and its Example Tests, in one query.
     *
     * The alternative — a query for the Patterns and then one per Pattern for
     * its tests — reads fine at two Patterns and is the reason the browse screen
     * is slow at two hundred. Grouping a join in Java costs a dozen lines and
     * does not have that second act.
     *
     * The join is filtered to unhidden rows, which is the only place in the
     * backend that reads the distinction. Hidden Tests are in this table so
     * activation can notice the judge disagreeing about how many tests a Pattern
     * has (see {@link PatternActivationService}); nothing serves them.
     */
    private static final String SELECT =
            """
            SELECT p.id, p.slug, p.name, p.family, p.seniority, p.prompt, p.scaffold,
                   t.name AS test_name, t.call AS test_call, t.expected AS test_expected
            FROM patterns p
            LEFT JOIN pattern_tests t ON t.pattern_id = p.id AND t.hidden = false
            WHERE
            """;

    /**
     * Family, then difficulty, then name — and Junior before Senior before
     * Principal, which is the order alphabetical sorting gets wrong in exactly
     * the middle. The tests within a Pattern keep the order they were written
     * in: two Example Tests that read as a sequence are a worse contract
     * shuffled.
     */
    private static final String ORDER =
            """
            ORDER BY p.family,
                     CASE p.seniority WHEN 'JUNIOR' THEN 1 WHEN 'SENIOR' THEN 2 ELSE 3 END,
                     p.name, t.ordinal
            """;

    private final JdbcTemplate jdbc;

    PatternRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * The activated Patterns, optionally narrowed.
     *
     * Inactive Patterns are invisible rather than shown as unavailable. A
     * Pattern is inactive because nobody has yet proved its tests are correct,
     * and offering one would be offering a Challenge that may be unwinnable.
     *
     * @param family    the Family to browse, or null for all of them.
     * @param seniority the band to filter to, or null for all of them.
     */
    List<Pattern> browse(Family family, Seniority seniority) {
        String familyName = family == null ? null : family.name();
        String seniorityName = seniority == null ? null : seniority.name();
        // The parameter appears twice in each pair because a null filter has to
        // be recognised as "no filter" before it is compared to anything. The
        // casts are what let PostgreSQL type an untyped null at all.
        return select(
                """
                p.activated_at IS NOT NULL
                  AND (CAST(? AS text) IS NULL OR p.family = CAST(? AS text))
                  AND (CAST(? AS text) IS NULL OR p.seniority = CAST(? AS text))
                """,
                familyName,
                familyName,
                seniorityName,
                seniorityName);
    }

    /** One activated Pattern, as the player is shown it. */
    Optional<Pattern> findActiveBySlug(String slug) {
        return select("p.activated_at IS NOT NULL AND p.slug = ?", slug).stream().findFirst();
    }

    /**
     * The Pattern an Issue was recorded against.
     *
     * Not filtered by activation. A Pattern deactivated after a Challenge went
     * out must not turn a Solve Run somebody is halfway through into a Run
     * against nothing: the Issue is the record of what was handed over, and it
     * is the record that decides.
     */
    Optional<Pattern> findById(UUID id) {
        return select("p.id = ?", id).stream().findFirst();
    }

    /**
     * The newline is load-bearing: a one-line WHERE fragment would otherwise run
     * straight into ORDER BY and PostgreSQL would report trailing junk after a
     * parameter.
     */
    private List<Pattern> select(String where, Object... arguments) {
        return jdbc.query(SELECT + where + "\n" + ORDER, GROUPED, arguments);
    }

    /**
     * Everything activation needs about one Pattern: the answer, the lines it is
     * assembled with, and how many tests it is supposed to have.
     *
     * @param testCount Example Tests and Hidden Tests together, which is what
     *                  the judge reports back as its total.
     */
    record Candidate(UUID id, String slug, String scaffold, String referenceSolution, int testCount) {}

    private static final RowMapper<Candidate> AS_CANDIDATE = (rs, rowNum) -> new Candidate(
            rs.getObject("id", UUID.class),
            rs.getString("slug"),
            rs.getString("scaffold"),
            rs.getString("reference_solution"),
            rs.getInt("test_count"));

    private static final String CANDIDATE =
            """
            SELECT p.id, p.slug, p.scaffold, p.reference_solution,
                   (SELECT count(*) FROM pattern_tests t WHERE t.pattern_id = p.id) AS test_count
            FROM patterns p
            WHERE
            """;

    /** The Patterns that have not passed the activation gate yet. */
    List<Candidate> awaitingActivation() {
        return jdbc.query(CANDIDATE + "p.activated_at IS NULL ORDER BY p.slug", AS_CANDIDATE);
    }

    /**
     * Marks a Pattern playable.
     *
     * Only ever called after the reference solution has been executed against
     * every one of the Pattern's own tests and passed them all. Nothing else in
     * the application writes this column, which is what makes the gate a gate
     * rather than a convention.
     */
    void activate(UUID id) {
        jdbc.update("UPDATE patterns SET activated_at = now() WHERE id = ? AND activated_at IS NULL", id);
    }

    /**
     * Folds the joined rows back into one Pattern per id, tests in order.
     *
     * A {@code LinkedHashMap} because the query's ordering is the answer's
     * ordering, and a plain HashMap would hand back the catalogue shuffled.
     */
    private static final ResultSetExtractor<List<Pattern>> GROUPED = PatternRepository::group;

    private static List<Pattern> group(ResultSet rs) throws SQLException {
        Map<UUID, Pattern> byId = new LinkedHashMap<>();
        Map<UUID, List<ExampleTest>> testsById = new LinkedHashMap<>();

        while (rs.next()) {
            UUID id = rs.getObject("id", UUID.class);
            List<ExampleTest> tests = testsById.computeIfAbsent(id, key -> new ArrayList<>());

            if (!byId.containsKey(id)) {
                // The list is handed to the record before it is filled. That is
                // the point: every row of this Pattern appends to the same list,
                // and the record is holding it rather than a copy of it.
                byId.put(
                        id,
                        new Pattern(
                                id,
                                rs.getString("slug"),
                                rs.getString("name"),
                                Family.valueOf(rs.getString("family")),
                                Seniority.valueOf(rs.getString("seniority")),
                                rs.getString("prompt"),
                                rs.getString("scaffold"),
                                tests));
            }

            // Null when the LEFT JOIN found no Example Tests. That Pattern will
            // never activate — the gate counts its tests against the judge's —
            // but browsing it is a rendering problem, not a crash.
            String testName = rs.getString("test_name");
            if (testName != null) {
                tests.add(new ExampleTest(testName, rs.getString("test_call"), rs.getString("test_expected")));
            }
        }

        return List.copyOf(byId.values());
    }
}
