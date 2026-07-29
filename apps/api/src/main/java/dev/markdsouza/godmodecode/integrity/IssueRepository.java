package dev.markdsouza.godmodecode.integrity;

import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

@Repository
public class IssueRepository {

    private static final RowMapper<Issue> AS_ISSUE = (rs, rowNum) -> new Issue(
            rs.getObject("id", UUID.class),
            rs.getObject("user_id", UUID.class),
            rs.getObject("passage_id", UUID.class),
            rs.getObject("pattern_id", UUID.class),
            instant(rs.getObject("issued_at", OffsetDateTime.class)),
            instant(rs.getObject("expires_at", OffsetDateTime.class)),
            instant(rs.getObject("consumed_at", OffsetDateTime.class)),
            instant(rs.getObject("superseded_at", OffsetDateTime.class)));

    private static final String COLUMNS =
            "id, user_id, passage_id, pattern_id, issued_at, expires_at, consumed_at, superseded_at";

    private final JdbcTemplate jdbc;

    IssueRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * Serialises this User's issuing against itself, for the length of the
     * transaction.
     *
     * The partial unique index on live Issues is what actually guarantees there
     * is only ever one; this lock is what stops a double-clicked start button
     * from meeting it. Without it, two requests both find nothing live, both
     * insert, and the second comes back as a constraint violation the player
     * did nothing to deserve. Taking the User's row first turns that race into a
     * queue of one.
     */
    public void takeIssuingLockOn(UUID userId) {
        jdbc.queryForList("SELECT id FROM users WHERE id = ? FOR UPDATE", UUID.class, userId);
    }

    /**
     * Abandons whatever Challenge this User is still holding.
     *
     * Unconsumed rather than unexpired: an Issue that has already expired still
     * occupies the one-live-Issue slot, and clearing it here is what lets the
     * next request take that slot in the same transaction.
     */
    public void supersedeLiveFor(UUID userId) {
        jdbc.update(
                """
                UPDATE issues SET superseded_at = now()
                WHERE user_id = ? AND consumed_at IS NULL AND superseded_at IS NULL
                """,
                userId);
    }

    /**
     * Records that this Passage went to this User, now.
     *
     * Both timestamps come from the database rather than the application: the
     * issue time is the anchor every later duration is checked against, and it
     * has to be one clock's reading, not whichever application instance happened
     * to serve the request. Because {@code now()} is fixed for the transaction,
     * {@code expires_at} lands exactly {@code window} after {@code issued_at}.
     */
    public Issue recordPassage(UUID userId, UUID passageId, Duration window) {
        return record("passage_id", userId, passageId, window);
    }

    /**
     * Records that this Pattern went to this User, now.
     *
     * The same act as {@link #recordPassage}, against the other kind of
     * Challenge. Which column is set is the only difference, and the database
     * insists exactly one of them is.
     */
    public Issue recordPattern(UUID userId, UUID patternId, Duration window) {
        return record("pattern_id", userId, patternId, window);
    }

    private Issue record(String challengeColumn, UUID userId, UUID challengeId, Duration window) {
        // The column name is interpolated and the values are not. It comes from
        // the two callers above and never from a request, which is what keeps
        // this from being the thing it looks like.
        return jdbc.queryForObject(
                """
                INSERT INTO issues (user_id, %s, expires_at)
                VALUES (?, ?, now() + (? * interval '1 millisecond'))
                RETURNING %s
                """
                        .formatted(challengeColumn, COLUMNS),
                AS_ISSUE,
                userId,
                challengeId,
                (double) window.toMillis());
    }

    /**
     * This User's Issue, held for the rest of the transaction.
     *
     * {@code FOR UPDATE} is what makes "check it is unconsumed, then consume it"
     * one decision rather than two. Two replays of the same submission arriving
     * together would otherwise both read an unconsumed row.
     *
     * Scoped to the User in the query rather than compared afterwards, so a
     * caller cannot forget to check whose Issue this was.
     */
    public Optional<Issue> findLockedFor(UUID issueId, UUID userId) {
        return jdbc
                .query(
                        "SELECT " + COLUMNS + " FROM issues WHERE id = ? AND user_id = ? FOR UPDATE",
                        AS_ISSUE,
                        issueId,
                        userId)
                .stream()
                .findFirst();
    }

    /** Spends the Issue. Single use is the whole reason it exists (ADR-0003). */
    public void markConsumed(UUID issueId) {
        jdbc.update("UPDATE issues SET consumed_at = now() WHERE id = ?", issueId);
    }

    /**
     * PostgreSQL hands back a {@code timestamptz} as an offset date-time; the
     * domain only ever wants the instant, and null stays null.
     */
    private static Instant instant(OffsetDateTime value) {
        return value == null ? null : value.toInstant();
    }
}
