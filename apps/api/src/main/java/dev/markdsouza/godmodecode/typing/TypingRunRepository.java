package dev.markdsouza.godmodecode.typing;

import java.time.OffsetDateTime;
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
    TypingRun insert(UUID userId, Passage passage, UUID issueId, Verification.Verified verified) {
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
                asRun(passage.discipline()),
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
     * The Discipline is carried in from the Passage rather than read back.
     *
     * A Run's Discipline is the Discipline of the Passage it was against, and
     * storing a second copy of it on the Run would be a column that could
     * disagree with the one that decides it.
     */
    private static RowMapper<TypingRun> asRun(Discipline discipline) {
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
                rs.getObject("completed_at", OffsetDateTime.class).toInstant());
    }
}
