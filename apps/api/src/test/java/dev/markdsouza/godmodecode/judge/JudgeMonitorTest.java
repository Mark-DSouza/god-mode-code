package dev.markdsouza.godmodecode.judge;

import static org.assertj.core.api.Assertions.assertThat;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * The poller that stands between the judge and everything that asks after it.
 *
 * Driven against a stub judge over a real socket, with a clock the test moves by
 * hand. The clock is the only fake here, and it has to be: the property worth
 * testing is that an observation nobody has refreshed stops being believed, and
 * waiting a minute to see that is not a test anybody will keep.
 */
class JudgeMonitorTest {

    private HttpServer server;
    private final AtomicBoolean answering = new AtomicBoolean(true);
    private final AtomicBoolean judging = new AtomicBoolean(true);

    private MutableClock clock;
    private MeterRegistry registry;
    private JudgeMetricsMirror mirror;
    private JudgeMonitor monitor;

    @BeforeEach
    void setUp() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/health", exchange -> {
            try {
                if (!answering.get()) {
                    respond(exchange, 503, "{}");
                    return;
                }
                respond(
                        exchange,
                        200,
                        "{\"status\":\"UP\",\"version\":\"test\",\"uptimeSeconds\":5,\"judging\":" + judging.get()
                                + "}");
            } finally {
                exchange.close();
            }
        });
        server.createContext("/metrics", exchange -> {
            try {
                respond(exchange, 200, "judge_workers 2\njudge_judgings_total{verdict=\"passed\"} 7\n");
            } finally {
                exchange.close();
            }
        });
        server.start();

        clock = new MutableClock(Instant.parse("2026-07-25T12:00:00Z"));
        registry = new SimpleMeterRegistry();
        mirror = new JudgeMetricsMirror(registry);
        monitor = new JudgeMonitor(clientFor(baseUrl()), mirror, registry, clock, propertiesFor(baseUrl()));
    }

    @AfterEach
    void tearDown() {
        server.stop(0);
    }

    private URI baseUrl() {
        return URI.create("http://127.0.0.1:" + server.getAddress().getPort());
    }

    private static JudgeProperties propertiesFor(URI baseUrl) {
        return new JudgeProperties(
                baseUrl,
                Duration.ofMillis(500),
                Duration.ofSeconds(5),
                Duration.ofSeconds(2),
                Duration.ofSeconds(15),
                Duration.ofSeconds(60));
    }

    private static JudgeClient clientFor(URI baseUrl) {
        JudgeProperties properties = propertiesFor(baseUrl);
        JudgeConfiguration configuration = new JudgeConfiguration();
        var http = configuration.judgeHttpClient(properties);
        return new JudgeClient(
                configuration.judgingRestClient(http, properties),
                configuration.monitoringRestClient(http, properties),
                http,
                properties);
    }

    private static void respond(HttpExchange exchange, int status, String body) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        // The judge always sets this, and without it the client has no converter
        // to read the body with — so omitting it here would make every probe
        // fail for a reason production never sees.
        exchange.getResponseHeaders().add("Content-Type", "application/json");
        exchange.sendResponseHeaders(status, bytes.length);
        exchange.getResponseBody().write(bytes);
    }

    @Test
    @DisplayName("nothing is assumed about a judge that has not been probed")
    void startsPessimistic() {
        assertThat(monitor.availability().reachable()).isFalse();
        assertThat(monitor.availability().canJudge()).isFalse();
    }

    @Test
    @DisplayName("one poll both probes and scrapes, so the judge's metrics get out")
    void pollProbesAndScrapes() {
        monitor.poll();

        assertThat(monitor.availability().canJudge()).isTrue();
        assertThat(monitor.availability().version()).isEqualTo("test");
        // The scrape is the judge's only route to an observability sink: it has
        // no egress and cannot push anywhere itself (ADR-0005, ADR-0008).
        assertThat(registry.get("judge_workers").gauge().value()).isEqualTo(2.0);
        assertThat(registry.get("judge_judgings_total").tag("verdict", "passed").gauge().value())
                .isEqualTo(7.0);
    }

    @Test
    @DisplayName("a judge that stops answering marks its mirrored metrics unknown")
    void unreachableJudgeMarksMetricsUnknown() {
        monitor.poll();
        answering.set(false);

        monitor.poll();

        assertThat(monitor.availability().reachable()).isFalse();
        assertThat(registry.get("judge_workers").gauge().value()).isNaN();
        assertThat(registry.get("judge_reachable").gauge().value()).isZero();
    }

    @Test
    @DisplayName("a judge with no container runtime is reachable and cannot judge")
    void reachableButNotJudging() {
        judging.set(false);

        monitor.poll();

        assertThat(monitor.availability().reachable()).isTrue();
        assertThat(monitor.availability().canJudge()).isFalse();
        assertThat(registry.get("judge_reachable").gauge().value()).isEqualTo(1.0);
        assertThat(registry.get("judge_can_judge").gauge().value()).isZero();
    }

    @Test
    @DisplayName("an observation nobody has refreshed stops being believed")
    void staleObservationsAreNotGoodNews() {
        monitor.poll();
        assertThat(monitor.availability().canJudge()).isTrue();

        // The poller is wedged, or its thread is gone. Either way nobody knows
        // anything about the judge any more, and for a dependency that is the
        // same as bad news — optimism here would keep the Code Discipline
        // looking healthy indefinitely.
        clock.advance(Duration.ofSeconds(61));

        assertThat(monitor.availability().reachable()).isFalse();
        assertThat(monitor.availability().detail()).contains("has not been probed since");
    }

    /** A clock the test moves, so staleness can be tested without waiting for it. */
    private static final class MutableClock extends Clock {

        private volatile Instant now;

        private MutableClock(Instant now) {
            this.now = now;
        }

        void advance(Duration by) {
            now = now.plus(by);
        }

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return now;
        }
    }
}
