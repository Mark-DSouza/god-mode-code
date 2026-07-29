package dev.markdsouza.godmodecode.pattern;

import dev.markdsouza.godmodecode.judge.Judging;
import dev.markdsouza.godmodecode.judge.Verdict;
import java.time.OffsetDateTime;
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
            SolveVerification.Verified verified) {
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
                asRun(pattern.slug()),
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
     * The slug is carried in from the Pattern rather than read back.
     *
     * It is the Pattern's identifier, not the Run's, and a second copy of it on
     * this row would be a column that could disagree with the one that decides
     * it.
     */
    private static RowMapper<SolveRun> asRun(String slug) {
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
                rs.getObject("completed_at", OffsetDateTime.class).toInstant());
    }
}
