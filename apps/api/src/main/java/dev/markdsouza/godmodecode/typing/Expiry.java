package dev.markdsouza.godmodecode.typing;

import dev.markdsouza.godmodecode.integrity.Wpm;
import java.time.Duration;

/**
 * How long a Challenge stays available once it has been handed out.
 *
 * The window exists to bound a Run from above. A server-recorded issue time
 * alone says only that a Run cannot have started earlier; without an upper
 * bound a player can request a Passage, rehearse it in a text editor for an
 * hour and then type it flawlessly, and every measurable signal still looks
 * legitimate (ADR-0003).
 *
 * The numbers below are chosen to be embarrassingly generous, because the cost
 * of the two failure modes is not symmetric. An expiry that is too long lets
 * somebody cheat at a typing test. An expiry that is too short throws away the
 * Run of a slow typist who was playing honestly, after they have finished it —
 * which ADR-0003 calls a bug report rather than a security control.
 */
final class Expiry {

    /**
     * The speed the window is scaled against: twenty words per minute.
     *
     * Roughly half of what an unpractised adult types, and a third of what
     * anyone who plays this site twice will. It is a floor on human slowness,
     * not an estimate of anybody's speed.
     */
    private static final double SLOWEST_PLAUSIBLE_WPM = 20;

    /**
     * Added on top of the scaled time, for reading the Passage, the countdown,
     * a glance at the attribution, and the mistyped word that gets backspaced.
     */
    private static final Duration GRACE = Duration.ofMinutes(2);

    /**
     * No Challenge expires in under ten minutes, however short the Passage
     * (ADR-0003). At the floor speed a 150-character quotation scales to under
     * two minutes, which would be a stopwatch rather than a security control.
     */
    private static final Duration MINIMUM = Duration.ofMinutes(10);

    private Expiry() {}

    /** How long a Challenge over a Passage of this length stays available. */
    static Duration forPassageOf(int characterCount) {
        // The same five characters a word is worth when a Run is measured. The
        // window has to be scaled in the units the result will be reported in,
        // or a Passage could be timed against one definition and scored against
        // another.
        double words = (double) characterCount / Wpm.CHARACTERS_PER_WORD;
        Duration atTheSlowestPlausibleSpeed =
                Duration.ofMillis(Math.round(words / SLOWEST_PLAUSIBLE_WPM * 60_000));

        Duration scaled = atTheSlowestPlausibleSpeed.plus(GRACE);
        return scaled.compareTo(MINIMUM) > 0 ? scaled : MINIMUM;
    }
}
