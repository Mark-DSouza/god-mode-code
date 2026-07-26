package dev.markdsouza.godmodecode.judge;

import static org.assertj.core.api.Assertions.assertThat;

import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * Mirroring the judge's metrics into the backend's registry.
 *
 * The exposition used here is the judge's own, copied from what
 * {@code apps/judge/internal/metrics} writes. If that ever stops being true this
 * test keeps passing while production stops reporting, which is the failure mode
 * worth knowing about: there is no compiler between these two services, only a
 * format.
 */
class JudgeMetricsMirrorTest {

    private static final String EXPOSITION =
            """
            # HELP judge_judgings_total Judgings completed, by Verdict.
            # TYPE judge_judgings_total counter
            judge_judgings_total{verdict="error"} 1
            judge_judgings_total{verdict="failed"} 4
            judge_judgings_total{verdict="passed"} 12
            judge_judgings_total{verdict="timeout"} 2
            # HELP judge_judgings_rejected_total Requests refused before reaching a worker.
            # TYPE judge_judgings_rejected_total counter
            judge_judgings_rejected_total 3
            # HELP judge_executions_in_flight Sandbox containers running right now.
            # TYPE judge_executions_in_flight gauge
            judge_executions_in_flight 1
            # HELP judge_workers Worker pool bound: the most containers that can run at once.
            # TYPE judge_workers gauge
            judge_workers 2
            # HELP judge_judging_duration_seconds Wall-clock time spent judging.
            # TYPE judge_judging_duration_seconds summary
            judge_judging_duration_seconds_sum 8.25
            judge_judging_duration_seconds_count 19
            # HELP judge_build_info The running build, always 1.
            # TYPE judge_build_info gauge
            judge_build_info{version="abc123"} 1
            """;

    private MeterRegistry registry;
    private JudgeMetricsMirror mirror;

    @BeforeEach
    void setUp() {
        registry = new SimpleMeterRegistry();
        mirror = new JudgeMetricsMirror(registry);
    }

    @Test
    @DisplayName("publishes the judge's series, labels and all")
    void publishesSeries() {
        mirror.publish(EXPOSITION);

        assertThat(gauge("judge_workers")).isEqualTo(2.0);
        assertThat(gauge("judge_judgings_rejected_total")).isEqualTo(3.0);
        assertThat(gauge("judge_judging_duration_seconds_sum")).isEqualTo(8.25);

        // The label is what makes this worth mirroring at all: a total with no
        // Verdict on it cannot answer the only question anyone asks of it.
        assertThat(registry.get("judge_judgings_total").tag("verdict", "passed").gauge().value())
                .isEqualTo(12.0);
        assertThat(registry.get("judge_judgings_total").tag("verdict", "timeout").gauge().value())
                .isEqualTo(2.0);
        assertThat(registry.get("judge_build_info").tag("version", "abc123").gauge().value())
                .isEqualTo(1.0);
    }

    @Test
    @DisplayName("updates in place rather than registering a series twice")
    void updatesInPlace() {
        mirror.publish(EXPOSITION);
        mirror.publish(EXPOSITION.replace("judge_workers 2", "judge_workers 4"));

        assertThat(registry.find("judge_workers").gauges()).hasSize(1);
        assertThat(gauge("judge_workers")).isEqualTo(4.0);
    }

    @Test
    @DisplayName("a failed scrape reads as unknown, not as the last good value")
    void failedScrapeIsUnknown() {
        mirror.publish(EXPOSITION);

        mirror.publish(null);

        // NaN renders as a gap. Leaving 12 in place would show a quiet afternoon
        // where there was actually an unreachable host, which is the more
        // dangerous of the two to be wrong about.
        assertThat(registry.get("judge_judgings_total").tag("verdict", "passed").gauge().value())
                .isNaN();
        assertThat(gauge("judge_workers")).isNaN();
    }

    @Test
    @DisplayName("publishes nothing the judge did not name as its own")
    void ignoresForeignSeries() {
        // The judge runs code nobody vetted. A compromised one answering a
        // scrape with somebody else's metric names must not get them into the
        // backend's registry, where they would be indistinguishable from the
        // backend's own.
        mirror.publish("""
                process_cpu_seconds_total 99
                http_server_requests_seconds_count{uri="/api/health"} 4
                judge_workers 2
                """);

        assertThat(registry.find("process_cpu_seconds_total").gauge()).isNull();
        assertThat(registry.find("http_server_requests_seconds_count").gauge()).isNull();
        assertThat(gauge("judge_workers")).isEqualTo(2.0);
    }

    @Test
    @DisplayName("stops registering series long before a cardinality bomb lands")
    void capsCardinality() {
        StringBuilder flood = new StringBuilder();
        for (int i = 0; i < 500; i++) {
            flood.append("judge_invented_total{n=\"").append(i).append("\"} 1\n");
        }

        mirror.publish(flood.toString());

        assertThat(registry.find("judge_invented_total").gauges()).hasSizeLessThanOrEqualTo(64);
    }

    @Test
    @DisplayName("skips lines it cannot read instead of dropping the scrape")
    void skipsUnreadableLines() {
        mirror.publish("""
                judge_workers not-a-number
                judge_broken{unterminated="x" 1
                judge_workers 2
                """);

        assertThat(gauge("judge_workers")).isEqualTo(2.0);
        assertThat(registry.find("judge_broken").gauge()).isNull();
    }

    private double gauge(String name) {
        Gauge gauge = registry.find(name).gauge();
        assertThat(gauge).as("gauge %s", name).isNotNull();
        return gauge.value();
    }
}
