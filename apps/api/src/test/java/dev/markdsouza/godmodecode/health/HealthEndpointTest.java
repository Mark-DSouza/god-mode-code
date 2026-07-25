package dev.markdsouza.godmodecode.health;

import static org.assertj.core.api.Assertions.assertThat;

import dev.markdsouza.godmodecode.AbstractIntegrationTest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * The backend test seam: a real HTTP request over a real socket, served by the
 * real application, talking to a real PostgreSQL.
 */
class HealthEndpointTest extends AbstractIntegrationTest {

    @Autowired
    TestRestTemplate http;

    @Autowired
    JdbcTemplate jdbc;

    @Test
    @DisplayName("reports UP over HTTP when the database is reachable")
    void reportsUp() {
        ResponseEntity<HealthStatus> response = http.getForEntity("/api/health", HealthStatus.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().status()).isEqualTo(HealthStatus.Status.UP);
        assertThat(response.getBody().database()).isEqualTo(HealthStatus.Status.UP);
        assertThat(response.getBody().version()).isEqualTo("test");
    }

    @Test
    @DisplayName("is served under /api, so the proxy needs no per-endpoint rules")
    void isServedUnderApiPrefix() {
        // Caddy routes on the /api prefix alone (ADR-0002). An endpoint that
        // escaped the prefix would 404 in production while passing every test
        // that used a direct port.
        assertThat(http.getForEntity("/health", String.class).getStatusCode())
                .isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    @DisplayName("talks to a database that migrations have actually been applied to")
    void migrationsRanOnStartup() {
        Integer applied = jdbc.queryForObject(
                "SELECT count(*) FROM flyway_schema_history WHERE success = true", Integer.class);
        assertThat(applied).isNotNull().isPositive();

        // Proves it is PostgreSQL with the baseline applied, rather than
        // something that merely accepted the connection: citext is created by
        // V1 and does not exist in a stock database.
        Boolean citext = jdbc.queryForObject(
                "SELECT exists(SELECT 1 FROM pg_extension WHERE extname = 'citext')", Boolean.class);
        assertThat(citext).isTrue();
    }
}
