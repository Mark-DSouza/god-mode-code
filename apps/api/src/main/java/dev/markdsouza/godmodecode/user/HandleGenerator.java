package dev.markdsouza.godmodecode.user;

import java.util.concurrent.ThreadLocalRandom;
import org.springframework.stereotype.Component;

/**
 * Produces {@code GERUND_CREATURE} Handles, and suffixes one when it is taken.
 *
 * The suffix is applied to the same base rather than re-rolling the words. A
 * re-roll would also satisfy "only on collision", but it makes the outcome of a
 * collision unobservable — you cannot tell a suffix that was needed from a
 * second draw that happened to be free — and it turns a rare, cheap retry into
 * an unbounded one.
 */
@Component
public class HandleGenerator {

    private final HandleWords words;

    HandleGenerator(HandleWords words) {
        this.words = words;
    }

    /**
     * A fresh {@code GERUND_CREATURE}, with no suffix.
     *
     * Not a secure random: a Handle is a public display name, and the only thing
     * predicting the next one buys is knowing which Handle to race for.
     */
    public String generateBase() {
        ThreadLocalRandom random = ThreadLocalRandom.current();
        String gerund = words.gerunds().get(random.nextInt(words.gerunds().size()));
        String creature = words.creatures().get(random.nextInt(words.creatures().size()));
        return gerund + "_" + creature;
    }

    /**
     * The Handle to try on a given attempt: the bare base first, then
     * {@code BASE_2}, {@code BASE_3} and so on.
     *
     * Dense and ascending rather than random, so the second person to draw a pair
     * gets {@code _2} and not {@code _734}. The cost is that a popular pair takes
     * one insert per existing holder to get past, which at
     * {@link HandleWords#MAX_SUFFIX} attempts is bounded and, with twelve
     * thousand pairs to draw from, vanishingly rare.
     *
     * @param attempt 1-based.
     */
    public String forAttempt(String base, int attempt) {
        if (attempt < 1 || attempt > HandleWords.MAX_SUFFIX) {
            throw new IllegalArgumentException(
                    "Attempt " + attempt + " is outside 1.." + HandleWords.MAX_SUFFIX);
        }
        return attempt == 1 ? base : base + "_" + attempt;
    }
}
