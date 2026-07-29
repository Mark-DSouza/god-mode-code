package dev.markdsouza.godmodecode.profile;

import dev.markdsouza.godmodecode.judge.Verdict;
import dev.markdsouza.godmodecode.typing.Discipline;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

/**
 * The reads a profile is made of. Nothing here writes, and nothing here is
 * stored.
 *
 * Its own queries rather than the two Runs' repositories, because those are the
 * write sides of two aggregates and this is a read model over both. Reaching
 * across into them would either make them public to a package that has no
 * business inserting Runs, or make one aggregate depend on the other — which is
 * the coupling ADR-0006 exists to avoid.
 *
 * Every query here is an index seek. `typing_runs_by_user` is (user_id, wpm
 * DESC) and `solve_runs_by_user` is (user_id, completed_at DESC), which is why
 * a Personal Best is derived on demand rather than kept in a table that could
 * fall out of step with the Runs it summarises.
 */
@Repository
class ProfileRepository {

    private final JdbcTemplate jdbc;

    ProfileRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * The highest WPM in each Discipline this User has typed in.
     *
     * The Discipline comes from the Passage, because a Typing Run does not carry
     * one — the Passage it was against is what decides it, and a second copy on
     * the Run would be a column that could disagree.
     */
    List<PersonalBest> typingBests(UUID userId) {
        return jdbc.query(
                """
                SELECT p.discipline, max(r.wpm) AS wpm
                FROM typing_runs r
                JOIN passages p ON p.id = r.passage_id
                WHERE r.user_id = ?
                GROUP BY p.discipline
                ORDER BY p.discipline
                """,
                (rs, rowNum) ->
                        new PersonalBest(Discipline.valueOf(rs.getString("discipline")), rs.getBigDecimal("wpm")),
                userId);
    }

    /**
     * The highest WPM among this User's Passed Solve Runs.
     *
     * Passed only. A Failed, Timeout or Error Solve Run is a recorded Run and
     * belongs in the history below, but only Passed Solve Runs are ranked
     * (CONTEXT.md) — a Personal Best set by a program that does not work is not
     * a best at anything.
     */
    Optional<BigDecimal> codeBest(UUID userId) {
        return Optional.ofNullable(jdbc.queryForObject(
                "SELECT max(wpm) FROM solve_runs WHERE user_id = ? AND verdict = 'PASSED'",
                BigDecimal.class,
                userId));
    }

    /** The highest Accuracy of any Typing Run, which is the only kind that has one. */
    Optional<BigDecimal> bestAccuracy(UUID userId) {
        return Optional.ofNullable(
                jdbc.queryForObject("SELECT max(accuracy) FROM typing_runs WHERE user_id = ?", BigDecimal.class, userId));
    }

    /**
     * The most recent Typing Runs, newest first.
     *
     * Asked for the same window as the Solve Runs beside it even though only
     * some of both will survive the merge. Taking fewer would be guessing at the
     * mix, and the guess is wrong for anybody who plays one Discipline
     * exclusively.
     */
    List<HistoryEntry> recentTypingRuns(UUID userId, int limit) {
        return jdbc.query(
                """
                SELECT r.id, p.discipline, r.wpm, r.completed_at
                FROM typing_runs r
                JOIN passages p ON p.id = r.passage_id
                WHERE r.user_id = ?
                ORDER BY r.completed_at DESC
                LIMIT ?
                """,
                (rs, rowNum) -> new HistoryEntry(
                        rs.getObject("id", UUID.class),
                        Discipline.valueOf(rs.getString("discipline")),
                        rs.getBigDecimal("wpm"),
                        // A Typing Run cannot fail, so it has no Verdict to
                        // report — not an unknown one.
                        null,
                        completedAt(rs.getObject("completed_at", OffsetDateTime.class))),
                userId,
                limit);
    }

    /** The most recent Solve Runs, newest first, failures included. */
    List<HistoryEntry> recentSolveRuns(UUID userId, int limit) {
        return jdbc.query(
                """
                SELECT id, wpm, verdict, completed_at
                FROM solve_runs
                WHERE user_id = ?
                ORDER BY completed_at DESC
                LIMIT ?
                """,
                AS_SOLVE_ENTRY,
                userId,
                limit);
    }

    private static final RowMapper<HistoryEntry> AS_SOLVE_ENTRY = (rs, rowNum) -> new HistoryEntry(
            rs.getObject("id", UUID.class),
            // Every Solve Run is in the Code Discipline. It is the Discipline's
            // only kind of Challenge (ADR-0004), so this is read from the table
            // it was found in rather than from a column that could say otherwise.
            Discipline.CODE,
            rs.getBigDecimal("wpm"),
            Verdict.valueOf(rs.getString("verdict")),
            completedAt(rs.getObject("completed_at", OffsetDateTime.class)));

    private static Instant completedAt(OffsetDateTime timestamp) {
        return timestamp.toInstant();
    }
}
