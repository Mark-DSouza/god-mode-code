package dev.markdsouza.godmodecode.observability;

import static org.assertj.core.api.Assertions.assertThat;

import dev.markdsouza.godmodecode.AbstractIntegrationTest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.actuate.observability.AutoConfigureObservability;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

/**
 * The scrape endpoint the collector on the application host reads.
 *
 * Listing `prometheus` under the exposed endpoints is not enough on its own —
 * without a Micrometer registry on the classpath the endpoint simply does not
 * exist, and the configuration looks correct while the collector scrapes a 404.
 * That is the failure this class exists to catch.
 */
// Spring Boot turns metrics export off in tests by default, so without this the
// registry never exists and the endpoint 404s here while working perfectly in
// production — the exact inverse of the failure this class is guarding against,
// and every bit as confusing.
@AutoConfigureObservability
class MetricsEndpointTest extends AbstractIntegrationTest {

    @Autowired
    TestRestTemplate http;

    @Test
    @DisplayName("serves Prometheus exposition, not a 404 from a missing registry")
    void servesExposition() {
        ResponseEntity<String> response = http.getForEntity("/actuator/prometheus", String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody()).contains("# TYPE jvm_memory_used_bytes gauge");
    }

    @Test
    @DisplayName("carries the request timings and connection pool depth the dashboard is built on")
    void carriesTheMetricsTheDashboardNeeds() {
        // Something has to have been served for the timer to exist at all.
        http.getForEntity("/api/health", String.class);

        String body = http.getForEntity("/actuator/prometheus", String.class).getBody();

        assertThat(body).isNotNull();
        // Request rate and latency, per endpoint and status.
        assertThat(body).contains("http_server_requests_seconds_count");
        assertThat(body).contains("uri=\"/api/health\"");
        // Connection pool saturation is one of the conditions that precedes an
        // outage rather than reporting one, which is the point of alarming on it.
        assertThat(body).contains("hikaricp_connections_active");
    }

    @Test
    @DisplayName("tags every meter with the application, environment and version")
    void tagsEveryMeter() {
        String body = http.getForEntity("/actuator/prometheus", String.class).getBody();

        // Without these the api and the judge land in one undifferentiated heap
        // of series, and a dashboard cannot tell a staging spike from a
        // production one.
        assertThat(body).isNotNull();
        assertThat(body).contains("application=\"god-mode-code-api\"");
        assertThat(body).contains("environment=\"test\"");
        assertThat(body).contains("version=\"test\"");
    }

    @Test
    @DisplayName("is not reachable under /api, so the proxy never exposes it publicly")
    void isNotReachableThroughTheProxyPrefix() {
        // Caddy proxies `/api/*` and nothing else (ADR-0002). Actuator sitting
        // outside that prefix is what keeps the metrics endpoint private
        // without needing a rule that somebody has to remember to write.
        assertThat(http.getForEntity("/api/actuator/prometheus", String.class).getStatusCode())
                .isEqualTo(HttpStatus.NOT_FOUND);
    }
}
