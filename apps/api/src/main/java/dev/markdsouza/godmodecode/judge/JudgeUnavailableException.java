package dev.markdsouza.godmodecode.judge;

/**
 * The judge could not be asked, or did not answer in time.
 *
 * Distinct from a Verdict of Error on purpose. An Error is a Judging: the judge
 * ran the source and something about it went wrong, and that is a legitimate
 * Solve Run to record. This is the absence of a Judging — the judge was
 * unreachable, wedged, at capacity, or slower than the backend's deadline — and
 * nothing about the player's submitted source can be concluded from it.
 *
 * Failure of the judge degrades the Code Discipline and nothing else. Whatever
 * catches this must not turn it into a site-wide error: Quotes and Prose need no
 * judge, and a Typing Run has no reason to fail because a container host on a
 * routeless subnet is unwell (ADR-0005).
 */
public class JudgeUnavailableException extends RuntimeException {

    private final Reason reason;

    public enum Reason {
        /** The backend's deadline passed before the judge answered. */
        TIMEOUT,
        /** Every worker was taken; the judge refused the work rather than queueing it forever. */
        AT_CAPACITY,
        /** The judge answered, but with something the backend could not use. */
        FAULT,
        /** The judge could not be reached at all. */
        UNREACHABLE
    }

    public JudgeUnavailableException(Reason reason, String message, Throwable cause) {
        super(message, cause);
        this.reason = reason;
    }

    public JudgeUnavailableException(Reason reason, String message) {
        this(reason, message, null);
    }

    public Reason reason() {
        return reason;
    }
}
