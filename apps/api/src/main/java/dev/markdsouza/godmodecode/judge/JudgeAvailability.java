package dev.markdsouza.godmodecode.judge;

/**
 * What the last probe found.
 *
 * Three states rather than two, because "up" and "can judge" are genuinely
 * different: the judge serves perfectly well without a container runtime and
 * says so, which is exactly what the local containerised stack does on purpose
 * (see compose.e2e.yaml). A backend that collapsed those would report a judge
 * that accepts no Solve Runs as healthy.
 *
 * @param reachable whether the judge answered at all.
 * @param judging   whether it has a container runtime and will accept Solve Runs.
 * @param version   the build it reported, or {@code null} if it did not answer.
 * @param detail    why it could not be reached, or {@code null} if it could.
 */
public record JudgeAvailability(boolean reachable, boolean judging, String version, String detail) {

    public static JudgeAvailability unreachable(String detail) {
        return new JudgeAvailability(false, false, null, detail);
    }

    /** Whether the Code Discipline can be played right now. */
    public boolean canJudge() {
        return reachable && judging;
    }
}
