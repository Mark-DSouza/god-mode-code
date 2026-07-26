package dev.markdsouza.godmodecode.health;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * What the backend reports about itself.
 *
 * The overall status follows the database and nothing else, and that asymmetry
 * is the whole design. Every Discipline needs the database; only the Code
 * Discipline needs the judge. So a judge on a routeless subnet failing takes
 * Patterns away and leaves Quotes, Prose, Leaderboards and sign-in exactly where
 * they were — and the external uptime monitor, which reads the status code
 * alone, must not be paged for it (ADR-0005).
 *
 * @param status    {@code UP} when the backend can serve, {@code DEGRADED} when
 *                  it cannot.
 * @param database  status of the PostgreSQL connection.
 * @param judge     status of the judge, as last observed across the private
 *                  link. {@code DEGRADED} means the Code Discipline is
 *                  unavailable and the rest of the site is not.
 * @param version   the running build, so a deploy can be confirmed from outside.
 */
@Schema(description = "The backend's own status and that of its dependencies")
public record HealthStatus(
        @Schema(description = "Overall status", example = "UP", requiredMode = Schema.RequiredMode.REQUIRED)
        Status status,

        @Schema(description = "PostgreSQL connectivity", example = "UP", requiredMode = Schema.RequiredMode.REQUIRED)
        Status database,

        @Schema(
                description = "Judge availability. DEGRADED means the Code Discipline is unavailable; "
                        + "the rest of the site is unaffected.",
                example = "UP",
                requiredMode = Schema.RequiredMode.REQUIRED)
        Status judge,

        @Schema(description = "Running build version", example = "0.0.1-SNAPSHOT", requiredMode = Schema.RequiredMode.REQUIRED)
        String version) {

    public enum Status {
        UP,
        DEGRADED
    }

    public boolean healthy() {
        return status == Status.UP;
    }

    /**
     * Assembles a report from what each dependency was found to be.
     *
     * The one place the rule lives: overall follows the database, because that
     * is the dependency without which there is no site.
     */
    public static HealthStatus of(Status database, Status judge, String version) {
        return new HealthStatus(database == Status.UP ? Status.UP : Status.DEGRADED, database, judge, version);
    }
}
