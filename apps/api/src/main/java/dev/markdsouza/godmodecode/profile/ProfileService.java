package dev.markdsouza.godmodecode.profile;

import dev.markdsouza.godmodecode.typing.Discipline;
import dev.markdsouza.godmodecode.user.User;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import org.springframework.stereotype.Service;

/**
 * Assembling a profile out of two aggregates that share nothing but a User and a
 * timestamp.
 *
 * This is the price ADR-0006 named: the timeline issues two queries and
 * interleaves them here rather than reading one polymorphic table. It is about
 * fifteen lines, written once, and it buys a schema where every column is
 * required for the row it is on.
 */
@Service
public class ProfileService {

    /**
     * How many recent Runs the profile carries.
     *
     * Fourteen because that is what the chart draws, and the chart is the only
     * thing that reads the list. A number chosen for the screen rather than for
     * the database is the right way round here: the query is an index seek
     * either way, and a window nobody can see is a window nobody can check.
     */
    static final int RECENT_RUNS = 14;

    private final ProfileRepository profiles;

    ProfileService(ProfileRepository profiles) {
        this.profiles = profiles;
    }

    public Profile of(User user) {
        List<HistoryEntry> history = recentHistory(user);

        return new Profile(
                user,
                personalBests(user),
                profiles.bestAccuracy(user.id()).orElse(null),
                averageWpm(history),
                history);
    }

    /**
     * One Personal Best per Discipline the User has a ranked Run in.
     *
     * Typing's come back grouped by the database, because the two typed
     * Disciplines are two values in one column. Code's is a separate query
     * against a separate table, which is the whole of ADR-0006 in two lines.
     */
    private List<PersonalBest> personalBests(User user) {
        List<PersonalBest> bests = new ArrayList<>(profiles.typingBests(user.id()));
        profiles.codeBest(user.id()).map(wpm -> new PersonalBest(Discipline.CODE, wpm)).ifPresent(bests::add);
        return List.copyOf(bests);
    }

    /**
     * The most recent Runs of both kinds, newest first.
     *
     * Both queries ask for the full window and the merge throws away whatever
     * does not fit, because neither half knows how much of it it is. A player
     * who has only ever typed gets fourteen Typing Runs; one who alternates gets
     * whichever fourteen actually happened last.
     */
    private List<HistoryEntry> recentHistory(User user) {
        List<HistoryEntry> merged = new ArrayList<>(profiles.recentTypingRuns(user.id(), RECENT_RUNS));
        merged.addAll(profiles.recentSolveRuns(user.id(), RECENT_RUNS));
        merged.sort(Comparator.comparing(HistoryEntry::completedAt).reversed());
        return List.copyOf(merged.subList(0, Math.min(RECENT_RUNS, merged.size())));
    }

    /**
     * Where the User is lately: the mean of exactly the Runs above.
     *
     * Including the Solve Runs that failed. Their WPM is a real reading of what
     * was typed — a Verdict says whether the program worked, not whether the
     * keystrokes happened — and dropping them would make this figure disagree
     * with the chart drawn from the same list.
     */
    private static BigDecimal averageWpm(List<HistoryEntry> history) {
        if (history.isEmpty()) {
            return null;
        }
        return history.stream()
                .map(HistoryEntry::wpm)
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .divide(BigDecimal.valueOf(history.size()), 1, RoundingMode.HALF_UP);
    }
}
