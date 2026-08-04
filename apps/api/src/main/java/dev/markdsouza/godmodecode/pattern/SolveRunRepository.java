package dev.markdsouza.godmodecode.pattern;

import dev.markdsouza.godmodecode.judge.Judging;
import dev.markdsouza.godmodecode.judge.Verdict;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

@Repository
class SolveRunRepository {

    private final JdbcTemplate jdbc;

    SolveRunRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * Writes a judged and verified Solve Run.
     *
     * Two sources and no third. The Verdict and the test counts are the judge's,
     * because executing the source is the only thing that can produce them; the
     * duration, the keystrokes and the WPM are the server's own arithmetic over
     * the raw submission. Nothing the client called a result reaches this
     * statement, because nothing the client called a result exists (ADR-0003).
     *
     * The source stored is the player's lines alone, without the Scaffold. The
     * Scaffold is the Pattern's and is identical on every Run of it, so keeping
     * a copy per Run would be storing the same lines a thousand times and
     * inviting them to disagree with the Pattern they came from.
     */
    SolveRun insert(
            UUID userId,
            Pattern pattern,
            UUID issueId,
            Judging judged,
            String source,
            SolveVerification.Verified verified,
            boolean personalBest,
            BigDecimal previousBestWpm) {
        return jdbc.queryForObject(
                """
                INSERT INTO solve_runs (
                    user_id, pattern_id, issue_id,
                    verdict, tests_passed, tests_total,
                    source, keystrokes, elapsed_millis, wpm
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                RETURNING id, pattern_id, verdict, tests_passed, tests_total,
                          keystrokes, elapsed_millis, wpm, completed_at
                """,
                asRun(pattern.slug(), personalBest, previousBestWpm),
                userId,
                pattern.id(),
                issueId,
                judged.verdict().name(),
                judged.testsPassed(),
                judged.testsTotal(),
                source,
                verified.keystrokes(),
                verified.elapsedMillis(),
                verified.wpm());
    }

    /**
     * Reattributes every Solve Run from one User to another, for Claiming's
     * merge (ADR-0007).
     *
     * A plain {@code UPDATE}: {@code solve_runs_one_per_issue} is scoped to the
     * Issue, not the User, so moving rows between Users cannot collide with it.
     */
    void reattributeUser(UUID from, UUID to) {
        jdbc.update("UPDATE solve_runs SET user_id = ? WHERE user_id = ?", to, from);
    }

    /**
     * The standing Personal Best in the Code Discipline, before this request
     * adds to it.
     *
     * Passed Solve Runs only, because only Passed Solve Runs are ranked
     * (CONTEXT.md). Derived on every submission rather than kept anywhere: a
     * stored copy would be one more thing to get wrong when Claiming merges two
     * Users' Runs.
     *
     * @return empty when the User has never had a Solve Run Pass.
     */
    Optional<BigDecimal> bestWpm(UUID userId) {
        return Optional.ofNullable(jdbc.queryForObject(
                "SELECT max(wpm) FROM solve_runs WHERE user_id = ? AND verdict = 'PASSED'",
                BigDecimal.class,
                userId));
    }

    /**
     * The slug is carried in from the Pattern rather than read back.
     *
     * It is the Pattern's identifier, not the Run's, and a second copy of it on
     * this row would be a column that could disagree with the one that decides
     * it. The two Personal Best fields are carried in for a different reason:
     * they are facts about every other Solve Run this User has, and there are
     * deliberately no columns here to read them from.
     */
    private static RowMapper<SolveRun> asRun(String slug, boolean personalBest, BigDecimal previousBestWpm) {
        return (rs, rowNum) -> new SolveRun(
                rs.getObject("id", UUID.class),
                rs.getObject("pattern_id", UUID.class),
                slug,
                Verdict.valueOf(rs.getString("verdict")),
                rs.getInt("tests_passed"),
                rs.getInt("tests_total"),
                rs.getInt("elapsed_millis"),
                rs.getInt("keystrokes"),
                rs.getBigDecimal("wpm"),
                rs.getObject("completed_at", OffsetDateTime.class).toInstant(),
                personalBest,
                previousBestWpm);
    }
}
