package dev.markdsouza.godmodecode.pattern;

import dev.markdsouza.godmodecode.integrity.Issue;
import dev.markdsouza.godmodecode.integrity.IssueRepository;
import dev.markdsouza.godmodecode.integrity.RejectionReason;
import dev.markdsouza.godmodecode.judge.JudgeClient;
import dev.markdsouza.godmodecode.judge.JudgeUnavailableException;
import dev.markdsouza.godmodecode.judge.Judging;
import dev.markdsouza.godmodecode.judge.SubmittedSource;
import dev.markdsouza.godmodecode.judge.UnknownPatternException;
import dev.markdsouza.godmodecode.judge.Verdict;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Turning a finished Solve Run into a record, refusing to, or failing to reach
 * the judge.
 *
 * <h2>The judge is called outside a transaction, deliberately</h2>
 *
 * A judging takes up to 45 seconds by design — a container starts, code that
 * nobody vetted runs, and the deadline is set above the judge's own queue wait
 * (ADR-0005). Holding a database connection across that would let a dozen slow
 * Solve Runs drain the pool, and a drained pool is a site-wide outage: Quotes,
 * Prose, health checks and all. A judge on a routeless subnet must degrade the
 * Code Discipline and nothing else, so the connection is given back before the
 * judge is asked and taken again to write the result.
 *
 * <h2>What that costs, and why it is affordable</h2>
 *
 * The Issue is not spent until the Solve Run is written, so two replays sent at
 * once can both reach the judge. The unique constraint on
 * {@code solve_runs.issue_id} is what decides between them, and the loser is
 * told the Issue was already used. That costs one wasted container on a
 * deliberate replay, and it buys the thing that matters more: a Solve Run that
 * could not be judged leaves the player holding a live Challenge instead of
 * having spent it on an outage.
 */
@Service
public class SolveRunService {

    /** What became of a submitted Solve Run. */
    public sealed interface Submitted {

        /** Judged and recorded — including a Failed Verdict, which is a Run. */
        record Recorded(SolveRun run) implements Submitted {}

        /** Not recorded, for exactly one reason the client can act on. */
        record Refused(RejectionReason reason) implements Submitted {}

        /**
         * There is no Verdict to be had, and nothing about the submitted source
         * can be concluded from that.
         *
         * Not a Refusal and not a Verdict of Error. The Issue is untouched, so
         * the player still holds their Challenge and can send the same lines
         * again once the judge is back.
         */
        record NotJudged(String explanation) implements Submitted {}
    }

    /** What survived the checks that do not need a judge. */
    private sealed interface Prepared {
        record Ready(Pattern pattern, UUID issueId, SolveVerification.Verified verified) implements Prepared {}

        record Refused(RejectionReason reason) implements Prepared {}
    }

    private final IssueRepository issues;
    private final PatternRepository patterns;
    private final SolveRunRepository runs;
    private final JudgeClient judge;
    private final TransactionTemplate transactions;

    SolveRunService(
            IssueRepository issues,
            PatternRepository patterns,
            SolveRunRepository runs,
            JudgeClient judge,
            TransactionTemplate transactions) {
        this.issues = issues;
        this.patterns = patterns;
        this.runs = runs;
        this.judge = judge;
        this.transactions = transactions;
    }

    /**
     * Verifies a submission, has it judged, and records the Solve Run.
     *
     * Three steps in that order, and the ordering is what keeps the judge from
     * being asked about work that was never going to count: an expired Issue or
     * a replay is refused before a container is started for it.
     */
    public Submitted submit(UUID userId, SolveRunSubmission submission) {
        Prepared prepared = transactions.execute(status -> prepare(userId, submission));

        Prepared.Ready ready;
        switch (prepared) {
            case Prepared.Refused refused -> {
                return new Submitted.Refused(refused.reason());
            }
            case Prepared.Ready readied -> ready = readied;
            // `execute` is declared nullable because a callback may return
            // nothing; this one always returns. Saying so out loud beats a cast
            // that would meet a null as a ClassCastException three lines later.
            case null -> throw new IllegalStateException("the preparing transaction returned nothing");
        }

        Judging judged;
        try {
            judged = judge.judge(new SubmittedSource(
                    ready.pattern().slug(),
                    SubmittedProgram.assemble(ready.pattern().scaffold(), submission.source())));
        } catch (UnknownPatternException e) {
            // The judge is working and says it has never heard of this Pattern,
            // which means the catalogues have skewed since activation. Nothing
            // the player did, and nothing they can fix.
            return new Submitted.NotJudged("This Pattern cannot be judged right now.");
        } catch (JudgeUnavailableException e) {
            return new Submitted.NotJudged("The judge could not be reached. Your Challenge is still yours.");
        }

        try {
            return transactions.execute(status -> {
                issues.markConsumed(ready.issueId());

                // Read before the Run is written, so it is the best this one had
                // to beat rather than the best including it. Only a Passed Solve
                // Run can beat anything — a Failed Run that was typed quickly is
                // still a Run that does not work (CONTEXT.md).
                BigDecimal previousBest = runs.bestWpm(userId).orElse(null);
                boolean personalBest = judged.verdict() == Verdict.PASSED
                        && (previousBest == null
                                || ready.verified().wpm().compareTo(previousBest) > 0);

                return new Submitted.Recorded(runs.insert(
                        userId,
                        ready.pattern(),
                        ready.issueId(),
                        judged,
                        submission.source(),
                        ready.verified(),
                        personalBest,
                        personalBest ? previousBest : null));
            });
        } catch (DuplicateKeyException e) {
            // A replay that raced this one to the judge and got here first. The
            // constraint is the arbiter precisely because the check and the
            // write are not in one transaction.
            return new Submitted.Refused(RejectionReason.ISSUE_ALREADY_USED);
        }
    }

    /**
     * Everything that can be decided without executing anything.
     *
     * Runs inside a short transaction. The row lock it takes is released the
     * moment this returns — it is here so that reading the Issue and reading the
     * Pattern it points at see one consistent state, not to hold anything across
     * the judging.
     */
    private Prepared prepare(UUID userId, SolveRunSubmission submission) {
        Optional<Issue> issue = issues.findLockedFor(submission.issueId(), userId);
        if (issue.isEmpty()) {
            // The same answer for "no such Issue" and "somebody else's Issue":
            // the query is scoped by User, so this cannot tell them apart and
            // nothing is leaked about ids that exist.
            return new Prepared.Refused(RejectionReason.NO_SUCH_ISSUE);
        }
        if (issue.get().patternId() == null) {
            // A Passage Challenge submitted as a Solve Run. There is no Pattern
            // to judge against, and the Issue is somebody's real Challenge, so
            // it is left alone rather than spent.
            return new Prepared.Refused(RejectionReason.NO_SUCH_ISSUE);
        }

        // The Pattern is read from the Issue, never from the submission. A
        // client that could name the Pattern it is judged against could name an
        // easier one.
        Pattern pattern = patterns
                .findById(issue.get().patternId())
                .orElseThrow(() -> new IllegalStateException(
                        "Issue " + issue.get().id() + " references a Pattern that is not there"));

        // The server's clock, read once and passed in, which is what keeps
        // every expiry and duration rule testable without waiting.
        return switch (SolveVerification.of(Instant.now(), issue.get(), submission)) {
            case SolveVerification.Rejected rejected -> new Prepared.Refused(rejected.reason());
            case SolveVerification.Verified verified ->
                new Prepared.Ready(pattern, issue.get().id(), verified);
        };
    }

    /**
     * Moves every Solve Run from one User to another, for Claiming's merge
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
