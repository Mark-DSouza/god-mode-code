package dev.markdsouza.godmodecode.judge;

import static org.assertj.core.api.Assertions.assertThat;

import dev.markdsouza.godmodecode.AbstractIntegrationTest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.actuate.observability.AutoConfigureObservability;
import org.springframework.boot.test.web.client.TestRestTemplate;

/**
 * The last leg of the judge's telemetry.
 *
 * Scraping the judge is only useful if what comes back leaves the building
 * again. The judge has no egress at all, so this endpoint is the entire route
 * its numbers have to Grafana Cloud (ADR-0005, ADR-0008): backend pulls across
 * the private link, backend re-exposes, the agent scrapes the backend.
 *
 * Worth an integration test rather than a unit one, because every way this
 * breaks is a wiring problem — a missing registry on the classpath, an endpoint
 * not exposed — and none of those are visible from inside the mirror.
 */
// Spring Boot switches metrics export off inside @SpringBootTest, on the sound
// assumption that most tests do not want a registry shipping anywhere. This one
// does: the whole point is that the endpoint production scrapes actually exists
// and actually contains the judge's numbers.
@AutoConfigureObservability(tracing = false)
class JudgeMetricsExpositionTest extends AbstractIntegrationTest {

    @Autowired
    TestRestTemplate http;

    @Autowired
    JudgeMetricsMirror mirror;

    @Test
    @DisplayName("re-exposes the judge's metrics on the backend's own scrape endpoint")
    void reExposesTheJudgesMetrics() {
        mirror.publish("""
                judge_workers 2
                judge_judgings_total{verdict="passed"} 7
                """);

        String exposition = http.getForObject("/actuator/prometheus", String.class);

        assertThat(exposition).isNotNull();
        assertThat(exposition).contains("judge_workers");
        assertThat(exposition).contains("verdict=\"passed\"");
    }

    @Test
    @DisplayName("reports whether the backend can see the judge at all")
    void reportsReachability() {
        // Distinguishes "the judge is down" from "nothing is scraping". The
        // mirrored series alone cannot: they simply stop arriving in both cases.
        String exposition = http.getForObject("/actuator/prometheus", String.class);

        assertThat(exposition).contains("judge_reachable");
        assertThat(exposition).contains("judge_can_judge");
    }
}
