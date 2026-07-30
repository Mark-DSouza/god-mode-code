package dev.markdsouza.godmodecode.typing;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

@Repository
class TypingRunRepository {

    private final JdbcTemplate jdbc;

    TypingRunRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * Writes a verified Run.
     *
     * Everything stored here came out of {@link Verification}. Nothing the
     * client sent as a metric reaches this statement, because nothing the client
     * sent as a metric exists (ADR-0003).
     *
     * {@code errors} is absent from the column list deliberately — the database
     * derives it from the two counts beside it, and a value supplied here could
     * disagree with them.
     */
    TypingRun insert(
            UUID userId,
            Passage passage,
            UUID issueId,
            Verification.Verified verified,
            boolean personalBest,
            BigDecimal previousBestWpm) {
        return jdbc.queryForObject(
                """
                INSERT INTO typing_runs (
                    user_id, passage_id, issue_id,
                    keystrokes, correct_characters, elapsed_millis,
                    wpm, accuracy
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                RETURNING id, passage_id, keystrokes, correct_characters,
                          elapsed_millis, wpm, accuracy, errors, completed_at
                """,
                asRun(passage.discipline(), personalBest, previousBestWpm),
                userId,
                passage.id(),
                issueId,
                verified.keystrokes(),
                verified.correctCharacters(),
                verified.elapsedMillis(),
                verified.wpm(),
                verified.accuracy());
    }

    /**
     * The standing Personal Best in one Discipline, before this request adds to
     * it.
     *
     * Derived, never stored (CONTEXT.md). The Discipline comes from the Passage
     * each Run was against, for the same reason it is not a column on the Run.
     *
     * @return empty when the User has never completed a Run in this Discipline.
     */
    Optional<BigDecimal> bestWpmIn(UUID userId, Discipline discipline) {
        return Optional.ofNullable(jdbc.queryForObject(
                """
                SELECT max(r.wpm)
                FROM typing_runs r
                JOIN passages p ON p.id = r.passage_id
                WHERE r.user_id = ? AND p.discipline = ?
                """,
                BigDecimal.class,
                userId,
                discipline.name()));
    }

    /**
     * The Discipline is carried in from the Passage rather than read back.
     *
     * A Run's Discipline is the Discipline of the Passage it was against, and
     * storing a second copy of it on the Run would be a column that could
     * disagree with the one that decides it. The two Personal Best fields are
     * carried in for a different reason: they are not facts about this row at
     * all, but about every other Run the User has, and the columns to read them
     * from deliberately do not exist.
     */
    private static RowMapper<TypingRun> asRun(
            Discipline discipline, boolean personalBest, BigDecimal previousBestWpm) {
        return (rs, rowNum) -> new TypingRun(
                rs.getObject("id", UUID.class),
                rs.getObject("passage_id", UUID.class),
                discipline,
                rs.getBigDecimal("wpm"),
                rs.getBigDecimal("accuracy"),
                rs.getInt("elapsed_millis"),
                rs.getInt("keystrokes"),
                rs.getInt("correct_characters"),
                rs.getInt("errors"),
                rs.getObject("completed_at", OffsetDateTime.class).toInstant(),
                personalBest,
                previousBestWpm);
    }
}
