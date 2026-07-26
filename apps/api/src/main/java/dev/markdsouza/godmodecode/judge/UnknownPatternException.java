package dev.markdsouza.godmodecode.judge;

/**
 * The judge has no Pattern with that identifier.
 *
 * Not a {@link JudgeUnavailableException}: the judge is working perfectly and is
 * telling us we asked for something that does not exist. In practice it means
 * the backend and the judge disagree about the catalogue — the judge compiles
 * its Patterns in, so this is a deploy skew, not a player's mistake.
 */
public class UnknownPatternException extends RuntimeException {

    public UnknownPatternException(String patternId) {
        super("The judge has no Pattern with id " + patternId);
    }
}
