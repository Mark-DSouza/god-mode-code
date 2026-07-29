package dev.markdsouza.godmodecode.integrity;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Words per minute, where a word is five characters.
 *
 * Here rather than in either kind of Run because three separate things depend on
 * agreeing about it: a Typing Run scores correct characters this way, a Solve Run
 * scores every character it was handed this way, and a Passage's expiry window is
 * scaled in the same units it will be scored in. Three copies of "divide by five"
 * would be three chances for a Challenge to be timed against one definition and
 * ranked against another.
 */
public final class Wpm {

    /** A word is five characters, everywhere in this codebase. */
    public static final int CHARACTERS_PER_WORD = 5;

    /**
     * The speed past which we stop believing anybody.
     *
     * Competitive typists sustain a little over 200 WPM on prepared text and the
     * recognised records sit around 216. Three hundred is not a threshold anyone
     * honest will ever approach; it is the point at which the number has to have
     * been manufactured. Set generously on purpose — the cost of refusing a real
     * Run is a player who was beaten by their own talent, and the cost of
     * admitting a fake one is one bad Leaderboard row.
     */
    public static final int PLAUSIBLE_CEILING = 300;

    private Wpm() {}

    /** Characters over five, per elapsed minute. */
    public static BigDecimal over(int characters, long elapsedMillis) {
        double minutes = elapsedMillis / 60_000.0;
        return oneDecimal((characters / (double) CHARACTERS_PER_WORD) / minutes);
    }

    /** Whether this reading is past what a human hand produces. */
    public static boolean isImplausible(BigDecimal wpm) {
        return wpm.compareTo(BigDecimal.valueOf(PLAUSIBLE_CEILING)) > 0;
    }

    /**
     * One decimal place, which is what a result screen shows and what the
     * columns hold.
     *
     * BigDecimal rather than double all the way out, so the number in the JSON
     * body is the number in the database — a double serialises as
     * 99.10000000000001 often enough to matter on a screen whose whole purpose
     * is the figure.
     */
    public static BigDecimal oneDecimal(double value) {
        return BigDecimal.valueOf(value).setScale(1, RoundingMode.HALF_UP);
    }
}
