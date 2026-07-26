package dev.markdsouza.godmodecode.judge;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import java.util.Locale;

/**
 * The outcome of a Solve Run: Passed, Failed, Timeout or Error. Only Passed
 * Solve Runs are ranked (CONTEXT.md).
 *
 * The wire form is lowercase, because that is what the judge emits and the judge
 * owns this vocabulary — it is the only thing that can decide a Verdict.
 */
public enum Verdict {

    /** Every test the Pattern defines was satisfied. */
    PASSED,

    /** The source ran and at least one test was not satisfied. */
    FAILED,

    /**
     * The judge stopped the execution. This is the submitted source running too
     * long, not the backend giving up on the judge — that is {@link #ERROR}, and
     * conflating the two would let an infrastructure outage read as thousands of
     * players writing slow code.
     */
    TIMEOUT,

    /**
     * The source never got as far as being wrong: it did not compile, or it died
     * on a sandbox limit.
     *
     * Note what this is not. A judge that could not be reached produced no
     * Verdict at all, and that is a {@link JudgeUnavailableException} rather
     * than an Error — nothing about the submitted source can be concluded from
     * an outage, and recording one as an Error would blame players for it.
     */
    ERROR;

    @JsonValue
    public String wireName() {
        return name().toLowerCase(Locale.ROOT);
    }

    /**
     * Reads a Verdict the judge sent.
     *
     * An unrecognised value is {@link #ERROR} rather than an exception. A judge
     * running ahead of the backend — which is possible, since they are deployed
     * separately — would otherwise turn every Solve Run into a parse failure at
     * the HTTP layer, which is a worse answer than "something went wrong".
     */
    @JsonCreator
    public static Verdict fromWire(String value) {
        if (value == null) {
            return ERROR;
        }
        for (Verdict verdict : values()) {
            if (verdict.wireName().equalsIgnoreCase(value.trim())) {
                return verdict;
            }
        }
        return ERROR;
    }
}
