package dev.markdsouza.godmodecode.leaderboard;

import dev.markdsouza.godmodecode.typing.Discipline;
import dev.markdsouza.godmodecode.user.User;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.ResultSetExtractor;
import org.springframework.stereotype.Repository;

/**
 * The one read a Leaderboard is made of.
 *
 * Its own query rather than the Typing Run repository's, for the reason
 * {@code ProfileRepository} gives: that one is the write side of an aggregate,
 * and this is a read model over it. A ranking has no business being able to
 * insert a Run.
 *
 * One query, deliberately. This endpoint is cached in front of the application,
 * and a cache miss should cost the database a single round trip rather than a
 * lookup, a count and a page. It is the only query here and it answers four
 * questions at once: whether the Passage exists at all, which Discipline it
 * belongs to, how many distinct Users have attempted it, and who is at the top —
 * plus the requesting User's own row, wherever that landed.
 */
@Repository
class LeaderboardRepository {

    /**
     * The board as the database returns it: the Passage's Discipline, the size
     * of the population, and the rows asked for.
     *
     * Not "Ranking". CONTEXT.md gives that word to a Discipline Ranking — a
     * User's standing across at least five distinct Challenges — which is a
     * different question with a different rule, and a type here wearing its
     * name would be the one place the two could be confused.
     *
     * {@code entries} is the top of the ranking <em>and</em> the requesting
     * User's row, which may be the same row or may be hundreds apart. Splitting
     * them is {@link LeaderboardService}'s job — the query returns both in one
     * pass because fetching them separately is the second round trip this class
     * exists to avoid.
     */
    record Board(Discipline discipline, int participants, List<LeaderboardEntry> entries) {}

    private final JdbcTemplate jdbc;

    LeaderboardRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * Best Run per User, ranked, top {@code top} plus the requesting User.
     *
     * Three things are worth reading twice.
     *
     * {@code DISTINCT ON (user_id) ... ORDER BY user_id, wpm DESC} is what makes
     * this a ranking of Users rather than of Runs. Without it a player who typed
     * the same Passage forty times would hold forty of the top rows, and the
     * board would rank persistence rather than speed. {@code
     * typing_runs_by_passage} — (passage_id, wpm DESC) — is the index it reads
     * (V5).
     *
     * {@code rank()} rather than {@code row_number()}, so tied WPMs share a
     * position and the position after a two-way tie is 3 rather than 2. Ties are
     * ordered among themselves by who got there first, which decides the order
     * of the list and never the number printed on it.
     *
     * The join from {@code passages} is what distinguishes a Passage nobody has
     * attempted from a Passage that does not exist. A ranking-only query answers
     * "no rows" to both, and those are a 200 carrying an empty board and a 404
     * respectively. Starting from the Passage means a row always comes back,
     * with nulls where the ranking would have been.
     *
     * @param viewerId the User asking, or null for a browser that is nobody yet.
     *                 A null never matches {@code user_id}, so only the top comes
     *                 back — the correct answer for somebody who has no row.
     * @return empty when there is no such Passage.
     */
    Optional<Board> forPassage(UUID passageId, UUID viewerId, int top) {
        return Optional.ofNullable(jdbc.query(
                """
                WITH best AS (
                    SELECT DISTINCT ON (user_id) user_id, wpm, accuracy, completed_at
                    FROM typing_runs
                    WHERE passage_id = ?
                    ORDER BY user_id, wpm DESC, completed_at
                ),
                ranked AS (
                    SELECT user_id, wpm, accuracy, completed_at,
                           rank() OVER (ORDER BY wpm DESC) AS position,
                           count(*) OVER () AS participants
                    FROM best
                )
                SELECT p.discipline,
                       r.position, r.participants, r.wpm, r.accuracy,
                       u.id AS user_id, u.handle, u.credential_subject IS NOT NULL AS claimed
                FROM passages p
                LEFT JOIN ranked r ON r.position <= ? OR r.user_id = ?
                LEFT JOIN users u ON u.id = r.user_id
                WHERE p.id = ?
                ORDER BY r.position, r.completed_at
                """,
                AS_BOARD,
                passageId,
                top,
                viewerId,
                passageId));
    }

    /**
     * Many rows into one Board.
     *
     * An extractor rather than a row mapper because the answer is one object
     * however many rows arrive — including none, which is the Passage that does
     * not exist, and including one made entirely of nulls, which is the Passage
     * nobody has typed yet. A mapper would have to return something per row and
     * leave the caller to reassemble it.
     *
     * The Discipline and the participant count are a join column and a window
     * function respectively, so both are constant down the result and reading
     * them off the first row reads them off all of them.
     */
    private static final ResultSetExtractor<Board> AS_BOARD = rs -> {
        if (!rs.next()) {
            return null;
        }

        Discipline discipline = Discipline.valueOf(rs.getString("discipline"));
        int participants = rs.getInt("participants");
        List<LeaderboardEntry> entries = new ArrayList<>();

        do {
            // A null position is the LEFT JOIN finding no ranking to attach:
            // the Passage is real and nobody has typed it. The single row it
            // produces carries the Discipline and nothing else, which is
            // precisely the empty board.
            if (rs.getObject("position") == null) {
                continue;
            }
            entries.add(new LeaderboardEntry(
                    rs.getInt("position"),
                    new User(rs.getObject("user_id", UUID.class), rs.getString("handle"), rs.getBoolean("claimed")),
                    rs.getBigDecimal("wpm"),
                    rs.getBigDecimal("accuracy")));
        } while (rs.next());

        return new Board(discipline, participants, List.copyOf(entries));
    };
}
