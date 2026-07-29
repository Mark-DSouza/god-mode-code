package dev.markdsouza.godmodecode.pattern;

import dev.markdsouza.godmodecode.integrity.Issue;
import dev.markdsouza.godmodecode.integrity.IssueRepository;
import java.time.Duration;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Handing out a Pattern, and writing down that it went out.
 */
@Service
public class SolveChallengeService {

    /**
     * How long a Pattern stays answerable once it has been handed out.
     *
     * Flat, where a Passage's window scales with its length. A Passage is timed
     * against how long it takes to type, which is a function of how many
     * characters it has; a Pattern is four to eight lines whatever it asks, and
     * the time it takes is thinking time. Scaling this by the size of the
     * Scaffold would give the longest window to the Pattern with the wordiest
     * signature, which is not a difficulty measure at all.
     *
     * Twenty minutes for a puzzle whose answer is thirty to ninety seconds of
     * typing (ADR-0004). The window exists to bound rehearsal from above
     * (ADR-0003), not to hurry anybody: reading the prompt, reading the Example
     * Tests, thinking, and getting it wrong once first all happen inside it. The
     * asymmetry that decides the number is the same one as for a Passage — an
     * expiry that is too long lets somebody look up an answer they were going to
     * look up anyway, and an expiry that is too short throws away the Solve Run
     * of a player who was thinking honestly.
     */
    static final Duration WINDOW = Duration.ofMinutes(20);

    private final PatternRepository patterns;
    private final IssueRepository issues;

    SolveChallengeService(PatternRepository patterns, IssueRepository issues) {
        this.patterns = patterns;
        this.issues = issues;
    }

    /**
     * Issues this Pattern to this User.
     *
     * The same three steps in the same order as a Passage, against the same
     * table, for the same reasons: the User's issuing lock first so two tabs
     * queue rather than collide, then the previous Challenge is abandoned to
     * free the one-live-Issue slot, then the new Issue is written. A player
     * holds exactly one Challenge at a time across both Disciplines — starting a
     * Pattern abandons the Passage you were holding, which is correct, because
     * you were not going to type it (ADR-0003).
     *
     * @return empty when there is no activated Pattern with that slug. An
     *         inactive one answers the same way: nobody has proved its tests are
     *         correct, so as far as a player is concerned it does not exist.
     */
    @Transactional
    public Optional<SolveChallenge> issueTo(UUID userId, String slug) {
        Optional<Pattern> pattern = patterns.findActiveBySlug(slug);
        if (pattern.isEmpty()) {
            return Optional.empty();
        }

        issues.takeIssuingLockOn(userId);
        issues.supersedeLiveFor(userId);

        Issue issue = issues.recordPattern(userId, pattern.get().id(), WINDOW);
        return Optional.of(new SolveChallenge(issue.id(), pattern.get(), issue.expiresAt()));
    }
}
