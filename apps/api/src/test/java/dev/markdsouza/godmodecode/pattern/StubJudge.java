package dev.markdsouza.godmodecode.pattern;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicReference;

/**
 * A judge, stubbed at its HTTP boundary rather than mocked in Java.
 *
 * The backend's own {@code JudgeClient} does the talking — the real RestClient,
 * the real deadline, the real JSON. What is replaced is the thing on the far end
 * of the socket, which is the only part of a judging these tests have no
 * business running: judging for real needs a container runtime, Python and ten
 * seconds, and none of that is what a Solve Run endpoint is being asked about.
 *
 * One server for the whole suite, on an ephemeral port, wired in by
 * {@link JudgedIntegrationTest}. Behaviour is programmed per Pattern so a test
 * can have one Pattern's reference solution fail while the rest of the catalogue
 * passes, which is exactly what the activation gate has to be shown doing.
 *
 * Public because the profile suite needs a User with Runs of both kinds, and a
 * Solve Run cannot be had without something answering as a judge. It records
 * them through the same endpoint a player uses rather than writing rows by hand,
 * which is the only way a profile test can prove the two aggregates really do
 * interleave.
 */
public final class StubJudge {

    private static final ObjectMapper JSON = new ObjectMapper();

    private static final Map<String, String> ANSWERS = new ConcurrentHashMap<>();

    /** What the judge does when it has no answer programmed for a Pattern. */
    private static final AtomicReference<Behaviour> FALLBACK = new AtomicReference<>(Behaviour.NOT_FOUND);

    /** The last program the judge was sent, so a test can assert on the assembly. */
    private static final AtomicReference<String> LAST_SOURCE = new AtomicReference<>();

    enum Behaviour {
        /** 404: the judge has never heard of this Pattern. */
        NOT_FOUND,
        /** 503: at capacity, which the backend reads as no Verdict to be had. */
        UNAVAILABLE
    }

    private static final HttpServer SERVER = start();

    private StubJudge() {}

    public static String baseUrl() {
        return "http://127.0.0.1:" + SERVER.getAddress().getPort();
    }

    /** Programs the Verdict this Pattern's next judging comes back with. */
    public static void answers(String patternId, String verdict, int passed, int total) {
        ANSWERS.put(
                patternId,
                """
                {"patternId":"%s","verdict":"%s","testsPassed":%d,"testsTotal":%d,"durationMillis":120}
                """
                        .formatted(patternId, verdict, passed, total));
    }

    /** Programs everything not named to fail this way. */
    static void otherwise(Behaviour behaviour) {
        FALLBACK.set(behaviour);
    }

    /** Forgets every programmed answer, so one test cannot set up the next one. */
    static void reset() {
        ANSWERS.clear();
        FALLBACK.set(Behaviour.NOT_FOUND);
        LAST_SOURCE.set(null);
    }

    /** The whole program the judge was last handed: Scaffold and written lines together. */
    static String lastSource() {
        return LAST_SOURCE.get();
    }

    private static HttpServer start() {
        try {
            HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
            server.createContext("/health", exchange -> respond(exchange, 200, """
                    {"status":"UP","version":"stub","uptimeSeconds":1,"judging":true}
                    """));
            server.createContext("/metrics", exchange -> respond(exchange, 200, ""));
            server.createContext("/judgings", StubJudge::judge);
            server.start();
            return server;
        } catch (IOException e) {
            throw new UncheckedIOException("could not start the stub judge", e);
        }
    }

    private static void judge(HttpExchange exchange) throws IOException {
        JsonNode request = JSON.readTree(exchange.getRequestBody().readAllBytes());
        String patternId = request.path("patternId").asText();
        LAST_SOURCE.set(request.path("source").asText());

        String answer = ANSWERS.get(patternId);
        if (answer != null) {
            respond(exchange, 200, answer);
            return;
        }
        switch (FALLBACK.get()) {
            case UNAVAILABLE -> respond(exchange, 503, "{\"error\":\"the judge is at capacity\"}");
            case NOT_FOUND -> respond(exchange, 404, "{\"error\":\"no such Pattern\"}");
        }
    }

    private static void respond(HttpExchange exchange, int status, String body) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json");
        exchange.sendResponseHeaders(status, bytes.length);
        try (exchange) {
            exchange.getResponseBody().write(bytes);
        }
    }
}
