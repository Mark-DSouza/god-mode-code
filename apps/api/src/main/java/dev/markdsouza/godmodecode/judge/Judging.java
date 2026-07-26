package dev.markdsouza.godmodecode.judge;

/**
 * What the judge reports about executing one submitted source.
 *
 * The response half of the judge's contract, mirroring the Go type of the same
 * name field for field. Counts are populated even when nothing ran, so a player
 * always sees the size of what they were judged against.
 *
 * @param patternId      the Pattern that was answered.
 * @param verdict        the outcome.
 * @param testsPassed    Example Tests and Hidden Tests that were satisfied.
 * @param testsTotal     Example Tests and Hidden Tests together.
 * @param durationMillis how long the judge spent, by its own clock.
 * @param detail         an Example Test's failure or an execution fault. A
 *                       Hidden Test's failure never appears here — it is
 *                       reported only as a count (CONTEXT.md).
 */
public record Judging(
        String patternId, Verdict verdict, int testsPassed, int testsTotal, long durationMillis, String detail) {}
