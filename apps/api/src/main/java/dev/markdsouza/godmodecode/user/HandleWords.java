package dev.markdsouza.godmodecode.user;

import java.util.List;
import java.util.Set;
import java.util.random.RandomGenerator;
import java.util.regex.Pattern;

/**
 * The two hand-curated word lists a Handle is drawn from, and the length budget
 * that decides how long a word is allowed to be.
 *
 * <h2>Why the words are counted, not just chosen</h2>
 *
 * A Handle has to fit a Leaderboard row on the narrowest supported viewport,
 * which is <b>320 CSS pixels</b> — the width of an iPhone SE and of every device
 * frame in the mockups (322px including the frame chrome). Nothing narrower is
 * supported, and nothing narrower needs to be: below 320 there is no layout that
 * fits a rank, an avatar tile, a Handle and a WPM figure on one line at all.
 *
 * The row at that width spends its 320 pixels like this:
 *
 * <pre>
 *   320  viewport
 *   -32  page gutter, --space-4 either side
 *   -24  panel padding, --space-3 either side
 *   -32  rank column (two digits + gap)
 *   -28  avatar tile (20px) + gap
 *   -48  WPM column, right aligned, + gap
 *   ----
 *   156  left for the Handle
 * </pre>
 *
 * The Handle is set in Share Tech Mono (`--font-display`) at `--text-xs` (12px)
 * with `--tracking-wide` (0.08em). Share Tech Mono advances 0.511em per glyph,
 * so a character costs {@code 12 * (0.511 + 0.08) = 7.09px} and 156px buys
 * {@code 156 / 7.09 = 22} characters.
 *
 * Of those 22, four are reserved for a collision suffix — an underscore and up
 * to three digits — leaving <b>18</b> for {@code GERUND_CREATURE} itself. One of
 * those is the separator, and the canonical example {@code PERCOLATING_FERRET}
 * spends 11 on the gerund, which fixes the two caps: gerunds up to 11
 * characters, creatures up to 6.
 *
 * <p>These are enforced here rather than trusted, because the failure mode of a
 * word one character too long is a Leaderboard row that wraps for one player in
 * a thousand — invisible in review, and impossible to fix afterwards without
 * renaming people.
 */
public record HandleWords(List<String> gerunds, List<String> creatures) {

    /** The narrowest viewport a Leaderboard row is laid out for, in CSS pixels. */
    public static final int NARROWEST_SUPPORTED_WIDTH_PX = 320;

    /** Characters a Handle may occupy in a Leaderboard row at that width. */
    public static final int MAX_HANDLE_LENGTH = 22;

    /** {@code _} plus up to three digits, held back for {@link #MAX_SUFFIX}. */
    public static final int SUFFIX_BUDGET = 4;

    /** Longest {@code GERUND_CREATURE} before any suffix. */
    public static final int MAX_BASE_LENGTH = MAX_HANDLE_LENGTH - SUFFIX_BUDGET;

    public static final int MIN_GERUND_LENGTH = 4;
    public static final int MAX_GERUND_LENGTH = 11;
    public static final int MIN_CREATURE_LENGTH = 3;
    public static final int MAX_CREATURE_LENGTH = 6;

    /**
     * The highest numeric suffix a colliding Handle may reach, and therefore the
     * number of Users a single word pair can hold. With the committed lists that
     * is over a million Handles — far past anything this site will see, and the
     * cap keeps a pathological run of collisions from turning one signup into an
     * unbounded number of inserts.
     */
    public static final int MAX_SUFFIX = 100;

    /**
     * The floor the committed lists must clear, checked where they are loaded
     * rather than here. Below roughly this many pairs the suffix stops being the
     * exception the design calls for.
     *
     * It cannot be an invariant of this record, because the collision tests
     * legitimately construct one holding a single pair. A "unless the list is
     * tiny" escape hatch on the invariant would let a production list truncated
     * to one word start the application and hand every visitor the same Handle,
     * which is the failure it was supposed to catch.
     */
    public static final int MIN_DISTINCT_PAIRS = 2_000;

    private static final Pattern WORD = Pattern.compile("^[A-Z]+$");

    static {
        // The two caps and the budget have to agree, and they are stated
        // separately above so each can be read on its own. This is the line that
        // catches someone raising one of them in isolation.
        int longestBase = MAX_GERUND_LENGTH + 1 + MAX_CREATURE_LENGTH;
        if (longestBase > MAX_BASE_LENGTH) {
            throw new ExceptionInInitializerError("The longest GERUND_CREATURE is " + longestBase
                    + " characters, which does not fit the " + MAX_BASE_LENGTH
                    + " a Leaderboard row leaves once the suffix is reserved");
        }
    }

    public HandleWords {
        gerunds = validated(gerunds, "gerunds", MIN_GERUND_LENGTH, MAX_GERUND_LENGTH);
        creatures = validated(creatures, "creatures", MIN_CREATURE_LENGTH, MAX_CREATURE_LENGTH);
    }

    /** How many distinct suffix-free Handles these lists can produce. */
    public int distinctPairs() {
        return gerunds.size() * creatures.size();
    }

    /**
     * The draw lives here, next to the lists, rather than in the caller — which
     * would have to reach through the record twice to index it, and would be the
     * place a future weighting or exclusion had to be bolted on.
     */
    String anyGerund(RandomGenerator random) {
        return gerunds.get(random.nextInt(gerunds.size()));
    }

    String anyCreature(RandomGenerator random) {
        return creatures.get(random.nextInt(creatures.size()));
    }

    private static List<String> validated(List<String> words, String what, int min, int max) {
        if (words == null || words.isEmpty()) {
            throw new IllegalArgumentException("The " + what + " list is empty");
        }
        for (String word : words) {
            if (!WORD.matcher(word).matches()) {
                throw new IllegalArgumentException(
                        "The " + what + " list contains a non A-Z entry: \"" + word + "\"");
            }
            if (word.length() < min || word.length() > max) {
                throw new IllegalArgumentException("The " + what + " entry \"" + word + "\" is "
                        + word.length() + " characters; " + min + " to " + max
                        + " keeps a Handle inside a Leaderboard row at "
                        + NARROWEST_SUPPORTED_WIDTH_PX + "px");
            }
        }
        if (words.size() != Set.copyOf(words).size()) {
            throw new IllegalArgumentException("The " + what + " list repeats a word");
        }
        return List.copyOf(words);
    }
}
