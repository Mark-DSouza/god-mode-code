package dev.markdsouza.godmodecode.pattern;

/**
 * The whole program the judge executes: the Pattern's Scaffold, then the lines
 * the player wrote.
 *
 * One place, used twice — by a Solve Run and by the activation gate — because
 * the gate proves the tests are correct only if it proves them against the same
 * assembly a player's submission gets. Two implementations of "stick these
 * together" that differed by a newline would mean the reference solution passed
 * a program nobody else is ever sent.
 *
 * The browser never sends the Scaffold back. It is read-only on screen, it is
 * the Pattern's rather than the player's, and accepting it from the client would
 * let a submission rewrite the function signature its tests call.
 */
final class SubmittedProgram {

    private SubmittedProgram() {}

    /**
     * Joins the Scaffold to what was written.
     *
     * Trailing whitespace is stripped from the Scaffold and nothing at all is
     * done to the written lines. Python is indentation-sensitive: re-indenting,
     * trimming or normalising what the player typed would change the meaning of
     * their code somewhere between the editor and the Verdict, which is the one
     * thing this must never do. A body that is not indented is a syntax error,
     * and the judge is entitled to say so.
     */
    static String assemble(String scaffold, String written) {
        return scaffold.stripTrailing() + "\n" + written;
    }
}
