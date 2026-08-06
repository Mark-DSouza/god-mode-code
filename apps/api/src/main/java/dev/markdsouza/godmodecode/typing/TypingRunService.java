package dev.markdsouza.godmodecode.typing;

import dev.markdsouza.godmodecode.integrity.Issue;
import dev.markdsouza.godmodecode.integrity.IssueRepository;
import dev.markdsouza.godmodecode.integrity.RejectionReason;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Turning a finished Run into a record, or refusing to.
 *
 * The arithmetic and every rejection rule live in {@link Verification}, which is
 * pure. What is left here is the part that needs a database: holding the Issue
 * still while it is checked and spent, and writing the row.
 */
@Service
public class TypingRunService {

    /**
     * Either a Run was recorded, or it was refused for exactly one reason.
     *
     * Not named for the outcome of anything: "outcome" is the word CONTEXT.md
     * reserves against Verdict, and a Typing Run has no Verdict — it cannot fail,
     * only be recorded or never have happened (ADR-0006). What varies here is
     * what became of the submission, so that is what it is called.
     */
    public sealed interface Submitted {
        record Recorded(TypingRun run) implements Submitted {}

        record Refused(RejectionReason reason) implements Submitted {}
    }

    private final IssueRepository issues;
    private final PassageRepository passages;
    private final TypingRunRepository runs;

    TypingRunService(IssueRepository issues, PassageRepository passages, TypingRunRepository runs) {
        this.issues = issues;
        this.passages = passages;
        this.runs = runs;
    }

    /**
     * Verifies a submission and, if it survives, records the Run.
     *
     * The whole thing is one transaction because reading the Issue, deciding it
     * is still live and marking it consumed have to be indivisible — a replay
     * arriving in the same millisecond must find the Issue already spent, not
     * find it unspent for the same instant the first request did. The row lock
     * taken by the read is what enforces that; the unique constraint on
     * {@code typing_runs.issue_id} is what would catch it if this method were
     * ever refactored into something that does not.
     */
    @Transactional
    public Submitted submit(UUID userId, TypingRunSubmission submission) {
        Optional<Issue> issue = issues.findLockedFor(submission.issueId(), userId);
        if (issue.isEmpty()) {
            // Deliberately the same answer for "no such Issue" and "somebody
            // else's Issue": the query is scoped by User, so this method cannot
            // tell them apart and nothing is leaked about ids that exist.
            return new Submitted.Refused(RejectionReason.NO_SUCH_ISSUE);
        }

        // The Passage is read from the Issue, never from the submission. A
        // client that could name the Passage it was verified against could name
        // a shorter one.
        Passage passage = passages
                .findById(issue.get().passageId())
                .orElseThrow(() -> new IllegalStateException(
                        "Issue " + issue.get().id() + " references a Passage that is not there"));

        // The server's clock, read once. Verification takes it as an argument
        // rather than reading it itself, which is what keeps every expiry and
        // duration rule testable without waiting for time to pass.
        return switch (Verification.of(Instant.now(), issue.get(), passage, submission)) {
            case Verification.Rejected rejected -> new Submitted.Refused(rejected.reason());
            case Verification.Verified verified -> {
                issues.markConsumed(issue.get().id());

                // Read before the Run is written, which is what makes it the
                // *previous* best rather than this one. Nothing else of this
                // User's can land in between: a User holds one live Issue at a
                // time, enforced by a partial unique index, so there is no
                // second Run of theirs in flight to race this one.
                BigDecimal previousBest =
                        runs.bestWpmIn(userId, passage.discipline()).orElse(null);
                boolean personalBest =
                        previousBest == null || verified.wpm().compareTo(previousBest) > 0;

                yield new Submitted.Recorded(runs.insert(
                        userId,
                        passage,
                        issue.get().id(),
                        verified,
                        personalBest,
                        // Only quoted when it was actually beaten: a Run that
                        // fell short has no delta to announce.
                        personalBest ? previousBest : null));
            }
        };
    }

    /**
     * Moves every Typing Run from one User to another, for Claiming's merge
     * (ADR-0007).
     *
     * The only write this aggregate exposes across a User boundary — everything
     * else is scoped to the User submitting a Run. Kept here rather than left to
     * a repository call from the {@code user} package, so this aggregate decides
     * for itself what "reattribute my Runs" means.
     */
    public void reattributeUser(UUID from, UUID to) {
        runs.reattributeUser(from, to);
    }
}
