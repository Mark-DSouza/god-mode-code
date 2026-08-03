package dev.markdsouza.godmodecode.leaderboard;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;

/**
 * Deciding what of a ranking is worth showing, and to whom.
 *
 * The ordering is the database's, which is where it belongs. What is left here
 * is the one judgement the query cannot make: whether this Challenge has been
 * attempted by enough people for a ranking of it to mean anything.
 */
@Service
public class LeaderboardService {

    /**
     * How many distinct Users have to have attempted a Challenge before its
     * Leaderboard is shown at all.
     *
     * A ranking of two is not a ranking, it is a coin toss with a table around
     * it — and being told you are second of two is worse than being told
     * nothing. Below this the screen falls back to the Discipline, where the
     * population is every Passage's players at once and is never this thin.
     *
     * Five, which is the same figure a Discipline Ranking demands of a User's
     * distinct Challenges (CONTEXT.md). The two rules are not the same rule and
     * do not have to agree, but "five is where a handful becomes a sample" is
     * one judgement, and making it twice with different numbers would invite the
     * question of which one was thought about.
     */
    public static final int MINIMUM_PARTICIPANTS = 5;

    /**
     * How much of the ranking is published.
     *
     * The top ten, because that is the thing a per-Challenge Leaderboard is for
     * — the acceptance criterion this exists to satisfy talks about one fast
     * typist occupying "the whole top ten", and a board deeper than the one
     * people care about is paging nobody asked for. Anybody outside it still
     * sees where they stand: their own row comes back regardless.
     */
    static final int PUBLISHED = 10;

    private final LeaderboardRepository rankings;

    LeaderboardService(LeaderboardRepository rankings) {
        this.rankings = rankings;
    }

    /**
     * The Leaderboard for one Passage, as the given User should see it.
     *
     * @param viewerId the User asking, or null for a browser that is nobody yet.
     * @return empty when there is no such Passage, which is a 404 and not an
     *         empty board — a Challenge that does not exist and a Challenge
     *         nobody has attempted are different answers to different mistakes.
     */
    public Optional<Leaderboard> forPassage(UUID passageId, UUID viewerId) {
        return rankings.forPassage(passageId, viewerId, PUBLISHED).map(ranking -> {
            // Withheld, not truncated: below the threshold the top is not shown
            // to anybody, including the two people on it. Publishing it to its
            // own participants and hiding it from everyone else would be a
            // ranking that says something different depending on who asks.
            boolean worthShowing = ranking.participants() >= MINIMUM_PARTICIPANTS;

            List<LeaderboardEntry> top = worthShowing
                    ? ranking.entries().stream()
                            .filter(entry -> entry.position() <= PUBLISHED)
                            .toList()
                    : List.of();

            return new Leaderboard(
                    passageId,
                    ranking.discipline(),
                    top,
                    // Their own row survives the threshold. It is a fact about
                    // the asker's own Run rather than a claim about a
                    // population, and a player who has just typed something is
                    // owed the number they earned even when there is nobody to
                    // compare it against yet.
                    viewerId == null ? null : ownRow(ranking, viewerId),
                    ranking.participants(),
                    MINIMUM_PARTICIPANTS);
        });
    }

    /**
     * The asker's row, picked out of the rows the query already returned.
     *
     * The query asks for the top and for this User in one pass, so when they are
     * both, this finds the same object twice and the payload carries it twice
     * — once in the list and once pinned. That repetition is the point: a screen
     * showing five of ten rows cannot know whether the sixth is the asker's, and
     * making it work that out from the list is how a row goes missing.
     */
    private static LeaderboardEntry ownRow(LeaderboardRepository.Ranking ranking, UUID viewerId) {
        return ranking.entries().stream()
                .filter(entry -> entry.user().id().equals(viewerId))
                .findFirst()
                .orElse(null);
    }
}
