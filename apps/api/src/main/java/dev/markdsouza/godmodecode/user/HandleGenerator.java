package dev.markdsouza.godmodecode.user;

import java.util.List;
import java.util.concurrent.ThreadLocalRandom;
import java.util.stream.IntStream;
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
     * Every Handle to try for one arriving visitor, in the order to try them:
     * a freshly drawn {@code GERUND_CREATURE} first, then {@code BASE_2},
     * {@code BASE_3}, up to {@link HandleWords#MAX_SUFFIX}.
     *
     * The whole sequence rather than one Handle at a time, so a single place
     * decides both what a Handle looks like and how far a collision may go. The
     * caller's only job is to stop at the first one the database accepts.
     *
     * Suffixes are dense and ascending rather than random, so the second person
     * to draw a pair gets {@code _2} and not {@code _734}. The cost is one insert
     * per existing holder to get past a popular pair, which is bounded by the
     * length of this list and, with twelve thousand pairs to draw from,
     * vanishingly rare.
     *
     * The draw is not a secure random: a Handle is read by everyone, and predicting the
     * next one buys nothing but knowing which Handle to race for.
     */
    public List<String> candidates() {
        ThreadLocalRandom random = ThreadLocalRandom.current();
        String base = words.anyGerund(random) + "_" + words.anyCreature(random);

        return IntStream.rangeClosed(1, HandleWords.MAX_SUFFIX)
                .mapToObj(attempt -> attempt == 1 ? base : base + "_" + attempt)
                .toList();
    }
}
