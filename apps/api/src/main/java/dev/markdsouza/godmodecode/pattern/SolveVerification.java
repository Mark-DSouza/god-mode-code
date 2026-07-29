package dev.markdsouza.godmodecode.pattern;

import dev.markdsouza.godmodecode.integrity.Issue;
import dev.markdsouza.godmodecode.integrity.RejectionReason;
import dev.markdsouza.godmodecode.integrity.Wpm;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;

/**
 * Recomputing a Solve Run's measurements from raw data, rather than trusting
 * what the client reports.
 *
 * The same job {@code Verification} does for a Typing Run, and deliberately not
 * the same code. What they share is the Issue rules, which live on the Issue
 * itself; what differs is everything else. There is no target text here, so
 * there is no comparison, no correct-character count and no Accuracy — a Solve
 * Run has nothing to be accurate against (ADR-0006). Correctness is a Verdict,
 * it comes from executing the source, and no amount of arithmetic in this file
 * can produce it.
 *
 * Pure, like its counterpart: a function of the server's clock, the Issue and
 * what came back. Every rejection rule for a Solve Run is in this one file and
 * can be exercised without a database or a judge.
 */
sealed interface SolveVerification {

    /** A submission that survived every check, with what the server measured. */
    record Verified(int keystrokes, int elapsedMillis, BigDecimal wpm) implements SolveVerification {}

    /** One that did not, and the one reason that stopped it first. */
    record Rejected(RejectionReason reason) implements SolveVerification {}

    /**
     * Slack on the "the Run cannot be longer than the window it happened in"
     * check. The browser's clock and PostgreSQL's are different clocks, and a
     * Solve Run submitted in the same second the Challenge was issued must not
     * fail on a rounding boundary.
     */
    Duration CLOCK_SLACK = Duration.ofSeconds(1);

    /**
     * Verifies a submission, or reports the first rule it broke.
     *
     * Checked before the judge is asked, and that order is the point: judging
     * costs a container on a 1GB host (ADR-0005), and a submission against an
     * expired Issue is not going to be recorded whatever the Verdict turns out
     * to be. Everything that can be decided without executing anything is
     * decided here.
     *
     * @param now the server's clock, passed in rather than read, so expiry and
     *            duration are testable without waiting.
     */
    static SolveVerification of(Instant now, Issue issue, SolveRunSubmission submission) {
        if (issue.consumedAt() != null) {
            return new Rejected(RejectionReason.ISSUE_ALREADY_USED);
        }
        if (issue.supersededAt() != null) {
            return new Rejected(RejectionReason.ISSUE_SUPERSEDED);
        }
        if (!now.isBefore(issue.expiresAt())) {
            return new Rejected(RejectionReason.ISSUE_EXPIRED);
        }

        // Nobody produces N characters in fewer than N keystrokes. This is not
        // the paste defence — pasting reports honest keystrokes and few of them,
        // which is a comparison for another day — it is the floor that keeps the
        // stored count from being smaller than the source it supposedly typed.
        if (submission.keystrokes() < submission.source().length()) {
            return new Rejected(RejectionReason.IMPLAUSIBLE_KEYSTROKES);
        }

        long elapsedMillis = Duration.between(submission.startedAt(), submission.completedAt())
                .toMillis();
        if (elapsedMillis <= 0) {
            return new Rejected(RejectionReason.IMPOSSIBLE_DURATION);
        }

        // The Solve Run has to fit inside the window the server itself watched
        // go past. However the browser's clock is set, the gap it reports cannot
        // exceed the gap between the Issue going out and now.
        Duration sinceIssued = Duration.between(issue.issuedAt(), now).plus(CLOCK_SLACK);
        if (elapsedMillis > sinceIssued.toMillis()) {
            return new Rejected(RejectionReason.IMPOSSIBLE_DURATION);
        }

        // Every character of the submitted source, where a Typing Run counts
        // only the correct ones (CONTEXT.md). There is no wrong character to
        // exclude: what was written is what was judged, and it either satisfies
        // the tests or it does not.
        BigDecimal wpm = Wpm.over(submission.source().length(), elapsedMillis);
        if (Wpm.isImplausible(wpm)) {
            return new Rejected(RejectionReason.IMPLAUSIBLE_SPEED);
        }

        return new Verified(submission.keystrokes(), Math.toIntExact(elapsedMillis), wpm);
    }
}
