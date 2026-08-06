package dev.markdsouza.godmodecode.typing;

import dev.markdsouza.godmodecode.integrity.Issue;
import dev.markdsouza.godmodecode.integrity.IssueRepository;
import java.time.Duration;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Handing out something to do, and writing down that it went out.
 */
@Service
public class ChallengeService {

    private final PassageRepository passages;
    private final IssueRepository issues;

    ChallengeService(PassageRepository passages, IssueRepository issues) {
        this.passages = passages;
        this.issues = issues;
    }

    /**
     * Issues a Challenge in this Discipline to this User.
     *
     * One transaction, and the order inside it matters. The User's issuing lock
     * comes first so two tabs asking at once queue rather than collide; the
     * previous Challenge is abandoned next, which frees the one-live-Issue slot;
     * only then is the new Issue written. A player therefore holds exactly one
     * Challenge at a time and cannot sit on three and submit whichever went best
     * (ADR-0003).
     *
     * Asking again is how a player skips a Passage they do not want, so it is a
     * normal thing to do and costs them nothing but the Challenge they abandoned.
     *
     * @return empty when the Discipline has no Passages — permanently true of
     *         Code, which is Patterns rather than Passages (ADR-0004).
     */
    @Transactional
    public Optional<Challenge> issueTo(UUID userId, Discipline discipline) {
        Optional<Passage> passage = passages.pickRandomIn(discipline);
        if (passage.isEmpty()) {
            return Optional.empty();
        }

        issues.takeIssuingLockOn(userId);
        issues.supersedeLiveFor(userId);

        Duration window = Expiry.forPassageOf(passage.get().characterCount());
        Issue issue = issues.recordPassage(userId, passage.get().id(), window);

        return Optional.of(new Challenge(issue.id(), passage.get(), issue.expiresAt()));
    }

    /**
     * Gives up whatever Challenge this User is holding, without ever recording a
     * Run against it.
     *
     * The same abandonment {@link #issueTo} already performs before handing out
     * the next Challenge — exposed on its own so a player who leaves mid-Run
     * (the Escape key, ADR-0003) frees the one-live-Issue slot immediately
     * rather than leaving it live until they next ask for something to type.
     * Idempotent: calling this with nothing live to abandon updates no rows.
     *
     * No issuing lock, unlike {@link #issueTo}: that lock exists to serialise
     * the check-then-insert a double-clicked start button could race, and
     * there is no insert here for a second abandon to race — two concurrent
     * abandons are just two updates of the same row, and Postgres already
     * serialises those.
     */
    @Transactional
    public void abandon(UUID userId) {
        issues.supersedeLiveFor(userId);
    }
}
