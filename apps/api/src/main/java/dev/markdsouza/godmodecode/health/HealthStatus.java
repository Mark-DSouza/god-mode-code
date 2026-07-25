package dev.markdsouza.godmodecode.health;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * What the backend reports about itself.
 *
 * @param status    {@code UP} when everything the backend needs is reachable,
 *                  {@code DEGRADED} otherwise.
 * @param database  status of the PostgreSQL connection.
 * @param version   the running build, so a deploy can be confirmed from outside.
 */
@Schema(description = "The backend's own status and that of its dependencies")
public record HealthStatus(
        @Schema(description = "Overall status", example = "UP", requiredMode = Schema.RequiredMode.REQUIRED)
        Status status,

        @Schema(description = "PostgreSQL connectivity", example = "UP", requiredMode = Schema.RequiredMode.REQUIRED)
        Status database,

        @Schema(description = "Running build version", example = "0.0.1-SNAPSHOT", requiredMode = Schema.RequiredMode.REQUIRED)
        String version) {

    public enum Status {
        UP,
        DEGRADED
    }

    public boolean healthy() {
        return status == Status.UP;
    }

    public static HealthStatus up(String version) {
        return new HealthStatus(Status.UP, Status.UP, version);
    }

    public static HealthStatus databaseDown(String version) {
        return new HealthStatus(Status.DEGRADED, Status.DEGRADED, version);
    }
}
