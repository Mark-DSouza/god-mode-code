package dev.markdsouza.godmodecode.typing;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.Instant;

/**
 * Recomputing a Run's metrics from raw data, rather than trusting the numbers
 * the client reports.
 *
 * A pure function of the four things that decide the outcome — the server's
 * clock, the Issue it recorded, the Passage it handed out, and what came back —
 * with no repository and no Spring context in sight. Every rejection rule and
 * every arithmetic decision in the site's integrity model is in this one file
 * and can be exercised without a database.
 *
 * Leaderboards are public and shared, which makes a client-reported score worth
 * exactly nothing: anyone with devtools could otherwise post a perfect Run
 * (ADR-0003).
 */
sealed interface Verification {

    /** A Run that survived every check, with the metrics the server computed. */
    record Verified(int keystrokes, int correctCharacters, int elapsedMillis, BigDecimal wpm, BigDecimal accuracy)
            implements Verification {}

    /** A Run that did not, and the one reason that stopped it first. */
    record Rejected(RejectionReason reason) implements Verification {}

    /** A word is five characters, everywhere in this codebase. */
    int CHARACTERS_PER_WORD = 5;

    /**
     * The speed past which we stop believing anybody.
     *
     * Competitive typists sustain a little over 200 WPM on prepared text and
     * the recognised records sit around 216. Three hundred is not a threshold
     * anyone honest will ever approach; it is the point at which the number has
     * to have been manufactured. Set generously on purpose — the cost of
     * refusing a real Run is a player who was beaten by their own talent, and
     * the cost of admitting a fake one is one bad Leaderboard row.
     */
    int PLAUSIBLE_WPM_CEILING = 300;

    /**
     * Slack on the "the Run cannot be longer than the window it happened in"
     * check.
     *
     * The two clocks being compared are different clocks — the browser's, read
     * twice, against PostgreSQL's `now()`. Their difference is meaningful but
     * their edges are not aligned, and a Run that finishes in the same second
     * the Challenge was issued must not fail on a rounding boundary. One second
     * covers that without opening a window anybody can type in.
     */
    Duration CLOCK_SLACK = Duration.ofSeconds(1);

    /**
     * Verifies a submission, or reports the first rule it broke.
     *
     * The order of the checks is the order of increasing cost, and also the
     * order that gives the most honest answer: an Issue that cannot be used is
     * not a Run with bad metrics, and text that is not the Passage is not a Run
     * that was too fast.
     *
     * @param now the server's clock, passed in rather than read, so that expiry
     *            and duration are testable without waiting.
     */
    static Verification of(Instant now, Issue issue, Passage passage, TypingRunSubmission submission) {
        if (issue.consumedAt() != null) {
            return new Rejected(RejectionReason.ISSUE_ALREADY_USED);
        }
        if (issue.supersededAt() != null) {
            return new Rejected(RejectionReason.ISSUE_SUPERSEDED);
        }
        if (!now.isBefore(issue.expiresAt())) {
            return new Rejected(RejectionReason.ISSUE_EXPIRED);
        }

        // Length, not equality: a Run with mistakes in it is a real Run, and
        // rejecting one would mean only flawless typing is ever recorded. What
        // this catches is a submission that did not transcribe *this* Passage —
        // a truncated one, a padded one, or one for a different Challenge
        // entirely. The Run ends on the final character, so a completed Run is
        // exactly as long as what it transcribed.
        if (submission.typedText().length() != passage.text().length()) {
            return new Rejected(RejectionReason.PASSAGE_MISMATCH);
        }

        // Nobody types N characters in fewer than N keystrokes. Under-reporting
        // is the cheap way to inflate Accuracy, since it is the denominator.
        if (submission.keystrokes() < submission.typedText().length()) {
            return new Rejected(RejectionReason.IMPLAUSIBLE_KEYSTROKES);
        }

        long elapsedMillis = Duration.between(submission.startedAt(), submission.completedAt())
                .toMillis();
        if (elapsedMillis <= 0) {
            return new Rejected(RejectionReason.IMPOSSIBLE_DURATION);
        }

        // The Run has to fit inside the window the server itself observed. The
        // client's two timestamps could say anything — this is what makes them
        // safe to use at all, because however the browser's clock is set, the
        // gap it reports cannot exceed the gap we watched go past.
        Duration sinceIssued = Duration.between(issue.issuedAt(), now).plus(CLOCK_SLACK);
        if (elapsedMillis > sinceIssued.toMillis()) {
            return new Rejected(RejectionReason.IMPOSSIBLE_DURATION);
        }

        int correctCharacters = correctCharacters(passage.text(), submission.typedText());
        BigDecimal wpm = wpm(correctCharacters, elapsedMillis);
        if (wpm.compareTo(BigDecimal.valueOf(PLAUSIBLE_WPM_CEILING)) > 0) {
            return new Rejected(RejectionReason.IMPLAUSIBLE_SPEED);
        }

        return new Verified(
                submission.keystrokes(),
                correctCharacters,
                Math.toIntExact(elapsedMillis),
                wpm,
                accuracy(correctCharacters, submission.keystrokes()));
    }

    /**
     * How many of the Passage's characters the final text got right.
     *
     * Position by position, because that is what the player was asked to do.
     * The two strings are the same length by the time this is called.
     */
    private static int correctCharacters(String passage, String typed) {
        int correct = 0;
        for (int i = 0; i < passage.length(); i++) {
            if (passage.charAt(i) == typed.charAt(i)) {
                correct++;
            }
        }
        return correct;
    }

    /**
     * Correct characters only, over elapsed minutes.
     *
     * Correct only, because a Typing Run is transcription: characters that do
     * not match the Passage were not progress through it, and counting them
     * would make hammering the keyboard a strategy.
     */
    private static BigDecimal wpm(int correctCharacters, long elapsedMillis) {
        double minutes = elapsedMillis / 60_000.0;
        return oneDecimal((correctCharacters / (double) CHARACTERS_PER_WORD) / minutes);
    }

    /** Correct keystrokes over total keystrokes, as a percentage. */
    private static BigDecimal accuracy(int correctCharacters, int keystrokes) {
        return oneDecimal(correctCharacters * 100.0 / keystrokes);
    }

    /**
     * Both metrics settle at one decimal place, which is what the result screen
     * shows and what the columns hold.
     *
     * BigDecimal rather than double all the way out, so the number in the JSON
     * body is the number in the database — a double serialises as 99.10000000000001
     * often enough to matter on a screen whose whole purpose is the figure.
     */
    private static BigDecimal oneDecimal(double value) {
        return BigDecimal.valueOf(value).setScale(1, RoundingMode.HALF_UP);
    }
}
