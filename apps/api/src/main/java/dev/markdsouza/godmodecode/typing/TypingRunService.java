package dev.markdsouza.godmodecode.typing;

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

    /** Either a Run was recorded, or it was refused for exactly one reason. */
    public sealed interface Outcome {
        record Recorded(TypingRun run) implements Outcome {}

        record Refused(RejectionReason reason) implements Outcome {}
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
    public Outcome submit(UUID userId, TypingRunSubmission submission) {
        Optional<Issue> issue = issues.findLockedFor(submission.issueId(), userId);
        if (issue.isEmpty()) {
            // Deliberately the same answer for "no such Issue" and "somebody
            // else's Issue": the query is scoped by User, so this method cannot
            // tell them apart and nothing is leaked about ids that exist.
            return new Outcome.Refused(RejectionReason.NO_SUCH_ISSUE);
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
            case Verification.Rejected rejected -> new Outcome.Refused(rejected.reason());
            case Verification.Verified verified -> {
                issues.markConsumed(issue.get().id());
                yield new Outcome.Recorded(runs.insert(userId, passage, issue.get().id(), verified));
            }
        };
    }
}
