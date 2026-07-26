package dev.markdsouza.godmodecode.judge;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.InputStream;
import java.net.InetSocketAddress;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * The backend's half of the private link, driven against a real socket.
 *
 * A stub HTTP server rather than a mocked {@code RestClient}, because most of
 * what is worth testing here is not in the Java at all: it is whether the
 * deadline is actually enforced on the wire, and whether a judge that never
 * answers is abandoned rather than waited on. A mock cannot be slow in the way
 * that matters.
 *
 * The clients are built by {@link JudgeConfiguration} itself rather than
 * assembled here. A test that constructs its own {@code RestClient} proves the
 * client works and says nothing about the one the application runs.
 */
class JudgeClientTest {

    private HttpServer server;
    private final AtomicReference<Handler> handler = new AtomicReference<>();

    /** What the stub judge does with a request. */
    private interface Handler {
        void handle(HttpExchange exchange) throws IOException;
    }

    @BeforeEach
    void startTheStubJudge() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", exchange -> {
            try {
                handler.get().handle(exchange);
            } finally {
                exchange.close();
            }
        });
        server.start();
    }

    @AfterEach
    void stopTheStubJudge() {
        server.stop(0);
    }

    private JudgeClient clientWith(Duration timeout) {
        return clientFor(URI.create("http://127.0.0.1:" + server.getAddress().getPort()), timeout);
    }

    private static JudgeClient clientFor(URI baseUrl, Duration timeout) {
        JudgeProperties properties = new JudgeProperties(
                baseUrl,
                Duration.ofMillis(500),
                timeout,
                timeout,
                Duration.ofSeconds(15),
                Duration.ofSeconds(60));
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
        exchange.getResponseHeaders().add("Content-Type", "application/json");
        exchange.sendResponseHeaders(status, bytes.length);
        exchange.getResponseBody().write(bytes);
    }

    @Test
    @DisplayName("turns the judge's answer into a Judging")
    void returnsAVerdict() {
        handler.set(exchange -> respond(
                exchange,
                200,
                """
                {"patternId":"hash-map-seen-lookup","verdict":"passed","testsPassed":6,
                 "testsTotal":6,"durationMillis":412}
                """));

        Judging judged = clientWith(Duration.ofSeconds(5))
                .judge(new SubmittedSource("hash-map-seen-lookup", "def solve(nums): ..."));

        assertThat(judged.verdict()).isEqualTo(Verdict.PASSED);
        assertThat(judged.testsPassed()).isEqualTo(6);
        assertThat(judged.testsTotal()).isEqualTo(6);
        assertThat(judged.durationMillis()).isEqualTo(412);
    }

    @Test
    @DisplayName("sends the Pattern and the submitted source in the shape the judge parses")
    void sendsTheSubmittedSource() throws Exception {
        AtomicReference<String> received = new AtomicReference<>();
        handler.set(exchange -> {
            try (InputStream body = exchange.getRequestBody()) {
                received.set(new String(body.readAllBytes(), StandardCharsets.UTF_8));
            }
            respond(exchange, 200, "{\"patternId\":\"p\",\"verdict\":\"failed\",\"testsPassed\":1,\"testsTotal\":3}");
        });

        clientWith(Duration.ofSeconds(5)).judge(new SubmittedSource("p", "print(1)"));

        // The judge rejects unknown fields outright, so the field names here are
        // a contract rather than a convenience.
        assertThat(received.get()).contains("\"patternId\":\"p\"").contains("\"source\":\"print(1)\"");
    }

    @Test
    @DisplayName("gives up at the deadline rather than waiting on a wedged judge")
    void enforcesAHardDeadline() {
        handler.set(exchange -> {
            // Never answers, for ten times the deadline under test. A judge
            // whose supervisor has wedged looks exactly like this from the
            // outside, and the whole point of the deadline is that the backend
            // does not wait to find out. Kept short because the suite waits for
            // this handler to finish before tearing the stub down.
            try {
                Thread.sleep(Duration.ofSeconds(3));
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        });

        long startedAt = System.nanoTime();
        assertThatThrownBy(() ->
                        clientWith(Duration.ofMillis(300)).judge(new SubmittedSource("p", "while True: pass")))
                .isInstanceOf(JudgeUnavailableException.class)
                .extracting(e -> ((JudgeUnavailableException) e).reason())
                .isEqualTo(JudgeUnavailableException.Reason.TIMEOUT);

        assertThat(Duration.ofNanos(System.nanoTime() - startedAt))
                .as("the deadline is the deadline; a client that merely eventually gives up is not one")
                .isLessThan(Duration.ofSeconds(5));
    }

    @Test
    @DisplayName("reports a judge at capacity as unavailable rather than as a Verdict")
    void reportsCapacity() {
        handler.set(exchange -> {
            exchange.getResponseHeaders().add("Retry-After", "1");
            respond(exchange, 503, "{\"error\":\"the judge is at capacity\"}");
        });

        assertThatThrownBy(() -> clientWith(Duration.ofSeconds(5)).judge(new SubmittedSource("p", "x")))
                .isInstanceOf(JudgeUnavailableException.class)
                .extracting(e -> ((JudgeUnavailableException) e).reason())
                .isEqualTo(JudgeUnavailableException.Reason.AT_CAPACITY);
    }

    @Test
    @DisplayName("an unknown Pattern is the judge working, not the judge failing")
    void reportsUnknownPattern() {
        handler.set(exchange -> respond(exchange, 404, "{\"error\":\"no such Pattern\"}"));

        assertThatThrownBy(() -> clientWith(Duration.ofSeconds(5)).judge(new SubmittedSource("nope", "x")))
                .isInstanceOf(UnknownPatternException.class)
                .hasMessageContaining("nope");
    }

    @Test
    @DisplayName("a judge that is not there is unreachable, not a timeout")
    void reportsUnreachable() {
        // Port 1 is reserved and refuses immediately. The distinction matters at
        // three in the morning: one of these says the judge is overwhelmed and
        // the other says it is gone.
        JudgeClient client = clientFor(URI.create("http://127.0.0.1:1"), Duration.ofSeconds(2));

        assertThatThrownBy(() -> client.judge(new SubmittedSource("p", "x")))
                .isInstanceOf(JudgeUnavailableException.class)
                .extracting(e -> ((JudgeUnavailableException) e).reason())
                .isEqualTo(JudgeUnavailableException.Reason.UNREACHABLE);
    }

    @Test
    @DisplayName("a judge with no container runtime is up and unable to judge, and says both")
    void probeSeparatesUpFromAbleToJudge() {
        handler.set(exchange ->
                respond(exchange, 200, "{\"status\":\"DEGRADED\",\"version\":\"e2e\",\"uptimeSeconds\":12,\"judging\":false}"));

        JudgeAvailability availability = clientWith(Duration.ofSeconds(5)).probe();

        assertThat(availability.reachable()).isTrue();
        assertThat(availability.judging()).isFalse();
        assertThat(availability.canJudge()).isFalse();
        assertThat(availability.version()).isEqualTo("e2e");
    }

    @Test
    @DisplayName("a probe of a judge that is not there answers rather than throwing")
    void probeNeverThrows() {
        JudgeAvailability availability =
                clientFor(URI.create("http://127.0.0.1:1"), Duration.ofSeconds(2)).probe();

        assertThat(availability.reachable()).isFalse();
        assertThat(availability.canJudge()).isFalse();
        assertThat(availability.detail()).isNotBlank();
    }

    @Test
    @DisplayName("scrapes the metrics the judge cannot ship itself")
    void scrapesMetrics() {
        handler.set(exchange -> {
            byte[] body = "judge_workers 2\n".getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
        });

        assertThat(clientWith(Duration.ofSeconds(5)).scrapeMetrics()).contains("judge_workers 2");
    }

    @Test
    @DisplayName("gives up on a scrape that trickles rather than holding the poller open")
    void boundsTheScrapeInTime() {
        handler.set(exchange -> {
            exchange.getResponseHeaders().add("Content-Type", "text/plain");
            exchange.sendResponseHeaders(200, 0);
            // Headers, then a byte at a time, forever. This is under the size
            // cap and answers within the request timeout, so neither of those
            // stops it — and a poller held open here never polls again, which
            // would report the judge degraded permanently. A compromised judge
            // must not be able to switch the Code Discipline off by being slow.
            try {
                for (int i = 0; i < 200; i++) {
                    exchange.getResponseBody().write('x');
                    exchange.getResponseBody().flush();
                    Thread.sleep(50);
                }
            } catch (IOException | InterruptedException expected) {
                Thread.currentThread().interrupt();
            }
        });

        long startedAt = System.nanoTime();
        String scraped = clientWith(Duration.ofMillis(300)).scrapeMetrics();

        assertThat(scraped).isNull();
        assertThat(Duration.ofNanos(System.nanoTime() - startedAt)).isLessThan(Duration.ofSeconds(5));
    }

    @Test
    @DisplayName("stops reading a scrape that will not stop arriving")
    void boundsTheScrape() {
        handler.set(exchange -> {
            exchange.getResponseHeaders().add("Content-Type", "text/plain");
            // Chunked, and far past the cap. The judge is the one host running
            // code nobody vetted, so a response from it that never ends must
            // not become the backend's heap.
            exchange.sendResponseHeaders(200, 0);
            byte[] chunk = "judge_padding_bytes 1\n".repeat(1000).getBytes(StandardCharsets.UTF_8);
            try {
                for (int written = 0; written < 4 * 1024 * 1024; written += chunk.length) {
                    exchange.getResponseBody().write(chunk);
                }
            } catch (IOException expected) {
                // The client closed on us, which is the behaviour under test.
            }
        });

        String scraped = clientWith(Duration.ofSeconds(10)).scrapeMetrics();

        assertThat(scraped).isNotNull();
        assertThat(scraped.getBytes(StandardCharsets.UTF_8).length).isLessThanOrEqualTo(256 * 1024);
    }
}
