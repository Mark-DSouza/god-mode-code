package dev.markdsouza.godmodecode.judge;

import java.io.ByteArrayOutputStream;
import java.net.ConnectException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpTimeoutException;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Flow;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/**
 * The backend's only door to the judge.
 *
 * Three things cross the private link and all three are here: a Solve Run's
 * submitted source going out, a health probe, and a metric scrape. The judge has
 * no egress and cannot ship telemetry anywhere itself, so the last of those is
 * the only way anything it measures reaches an observability sink at all
 * (ADR-0005, ADR-0008).
 *
 * <h2>Every interaction is logged</h2>
 *
 * Judgings at INFO — the Pattern, the Verdict, the duration and how it ended —
 * because on a private link with no other instrumentation this log is the record
 * of what the judge was asked and what it said. Probes at DEBUG, because one
 * every fifteen seconds at INFO would bury the judgings underneath them; the
 * monitor logs the transitions, which is the part worth reading.
 *
 * <h2>Calls are synchronous, with a hard deadline</h2>
 *
 * Synchronous because a Solve Run has nothing to do until it has a Verdict, and
 * an asynchronous version would only move the waiting somewhere less visible.
 * The deadline is enforced by the HTTP client, not by anything on the judge's
 * side, for the same reason the judge enforces its own wall clock rather than
 * trusting the container: a wedged dependency will not time itself out.
 */
@Component
public class JudgeClient {

    private static final Logger log = LoggerFactory.getLogger(JudgeClient.class);

    /**
     * The most of a metric scrape the backend will read. The judge's exposition
     * is a few hundred bytes; this is three orders of magnitude of slack, and it
     * is a cap rather than a guess because the judge is the one host in this
     * system that runs code nobody vetted.
     */
    private static final int MAX_METRICS_BYTES = 256 * 1024;

    private final RestClient judging;
    private final RestClient monitoring;

    /**
     * The scrape uses the HTTP client directly rather than a {@code RestClient}.
     * It is not really a REST call: it is a bounded read of bytes from a host
     * that is not trusted, and the bounding is the whole point. See
     * {@link #scrapeMetrics()}.
     */
    private final HttpClient http;

    private final URI metricsUrl;
    private final Duration pollTimeout;

    // The RestClients are qualified explicitly. There are two beans and they
    // differ only in their deadline, so injection by parameter name would work
    // right up until somebody renamed a parameter and silently gave every
    // judging a two second timeout.
    JudgeClient(
            @Qualifier("judgingRestClient") RestClient judgingRestClient,
            @Qualifier("monitoringRestClient") RestClient monitoringRestClient,
            HttpClient judgeHttpClient,
            JudgeProperties properties) {
        this.judging = judgingRestClient;
        this.monitoring = monitoringRestClient;
        this.http = judgeHttpClient;
        this.metricsUrl = properties.baseUrl().resolve("/metrics");
        this.pollTimeout = properties.pollTimeout();
    }

    /**
     * Sends one submitted source and waits for a Verdict.
     *
     * @throws UnknownPatternException     if the judge does not have that Pattern.
     * @throws JudgeUnavailableException   if there is no Verdict to be had: the
     *                                     judge was unreachable, at capacity, or
     *                                     slower than the deadline. Callers must
     *                                     degrade the Code Discipline rather than
     *                                     fail the request outright.
     */
    public Judging judge(SubmittedSource submitted) {
        long startedAt = System.nanoTime();
        try {
            Judging judged = judging.post()
                    .uri("/judgings")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(submitted)
                    .retrieve()
                    // 404 is the judge working correctly and telling us the
                    // catalogues have skewed, so it is not an availability
                    // problem and must not be reported as one.
                    .onStatus(status -> status.value() == 404, (request, response) -> {
                        throw new UnknownPatternException(submitted.patternId());
                    })
                    // 503 with Retry-After is the judge refusing work it has no
                    // capacity for. Refusing beats queueing forever, and saying
                    // so beats a timeout that looks identical to a dead host.
                    .onStatus(status -> status.value() == 503, (request, response) -> {
                        throw new JudgeUnavailableException(
                                JudgeUnavailableException.Reason.AT_CAPACITY, "the judge is at capacity");
                    })
                    .onStatus(HttpStatusCode::isError, (request, response) -> {
                        throw new JudgeUnavailableException(
                                JudgeUnavailableException.Reason.FAULT,
                                "the judge answered " + response.getStatusCode());
                    })
                    .body(Judging.class);

            if (judged == null) {
                throw new JudgeUnavailableException(
                        JudgeUnavailableException.Reason.FAULT, "the judge answered with an empty body");
            }

            log.info(
                    "Judged patternId={} verdict={} tests={}/{} judgeDurationMs={} roundTripMs={}",
                    submitted.patternId(),
                    judged.verdict().wireName(),
                    judged.testsPassed(),
                    judged.testsTotal(),
                    judged.durationMillis(),
                    millisSince(startedAt));
            return judged;

        } catch (UnknownPatternException e) {
            log.warn(
                    "Judging refused patternId={} outcome=unknown-pattern roundTripMs={}",
                    submitted.patternId(),
                    millisSince(startedAt));
            throw e;
        } catch (JudgeUnavailableException e) {
            log.warn(
                    "Judging failed patternId={} outcome={} roundTripMs={} reason={}",
                    submitted.patternId(),
                    e.reason().name().toLowerCase(Locale.ROOT),
                    millisSince(startedAt),
                    e.getMessage());
            throw e;
        } catch (RestClientException e) {
            JudgeUnavailableException unavailable = classify(e);
            log.warn(
                    "Judging failed patternId={} outcome={} roundTripMs={} reason={}",
                    submitted.patternId(),
                    unavailable.reason().name().toLowerCase(Locale.ROOT),
                    millisSince(startedAt),
                    e.getMessage());
            throw unavailable;
        }
    }

    /** Asks the judge how it is. Never throws; an unreachable judge is an answer. */
    public JudgeAvailability probe() {
        long startedAt = System.nanoTime();
        try {
            JudgeHealth health = monitoring.get().uri("/health").retrieve().body(JudgeHealth.class);
            if (health == null) {
                return JudgeAvailability.unreachable("the judge answered /health with an empty body");
            }
            log.debug(
                    "Probed the judge status={} judging={} version={} roundTripMs={}",
                    health.status(),
                    health.judging(),
                    health.version(),
                    millisSince(startedAt));
            // `judging` false means the judge is serving without a container
            // runtime — which is exactly what the local containerised stack
            // does on purpose. It is up, and it cannot judge, and reporting
            // only the first of those would be a lie by omission.
            return new JudgeAvailability(true, health.judging(), health.version(), null);
        } catch (RestClientException e) {
            log.debug("Could not probe the judge roundTripMs={} reason={}", millisSince(startedAt), e.getMessage());
            return JudgeAvailability.unreachable(e.getMessage());
        }
    }

    /**
     * Reads the judge's metrics in Prometheus text format.
     *
     * This is the only route the judge's telemetry has out of its subnet. It has
     * no egress, so it cannot push to any sink and cannot even resolve one's
     * name; the backend pulls across the private link and re-exposes what it
     * finds (ADR-0005, ADR-0008).
     *
     * @return the exposition text, or {@code null} if the judge could not be
     *         scraped. A failed scrape is a normal, expected event and not worth
     *         an exception at every call site.
     */
    public String scrapeMetrics() {
        long startedAt = System.nanoTime();
        HttpRequest request = HttpRequest.newBuilder(metricsUrl)
                .timeout(pollTimeout)
                .GET()
                .build();

        // Bounded in bytes *and* in time, and it takes both. A size cap alone
        // does not stop a judge that sends its headers and then trickles one
        // byte a minute — `HttpRequest.timeout` covers only the wait for the
        // response to begin, so such a body streams forever. That would hold
        // this poller's single thread indefinitely, which stops every future
        // poll, which reports the judge degraded permanently. A compromised
        // judge should not be able to switch the Code Discipline off by being
        // slow.
        CompletableFuture<HttpResponse<String>> exchange =
                http.sendAsync(request, info -> new BoundedBody(MAX_METRICS_BYTES));
        try {
            HttpResponse<String> response = exchange.get(pollTimeout.toMillis(), TimeUnit.MILLISECONDS);
            if (response.statusCode() >= 400) {
                log.debug("The judge refused a scrape status={}", response.statusCode());
                return null;
            }
            log.debug(
                    "Scraped the judge bytes={} roundTripMs={}",
                    response.body().length(),
                    millisSince(startedAt));
            return response.body();
        } catch (TimeoutException e) {
            // Cancelling closes the connection, so the read is abandoned rather
            // than left running behind a caller that has given up on it.
            exchange.cancel(true);
            log.debug("The judge did not finish a scrape within {}", pollTimeout);
            return null;
        } catch (ExecutionException e) {
            log.debug("Could not scrape the judge reason={}", e.getCause().getMessage());
            return null;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return null;
        }
    }

    /**
     * Collects at most a fixed number of bytes of a response body, then cancels.
     *
     * The judge is the one host in this system running code nobody vetted, and
     * this is the only response that comes back from it in bulk. Cancelling the
     * subscription is what makes the cap real: reading the whole body and
     * truncating afterwards would already have paid for it in heap. Truncation
     * itself is safe, because the parser discards any line it cannot read —
     * including a partial final one.
     */
    private static final class BoundedBody implements HttpResponse.BodySubscriber<String> {

        private final CompletableFuture<String> body = new CompletableFuture<>();
        private final ByteArrayOutputStream collected = new ByteArrayOutputStream();
        private final int limit;
        private Flow.Subscription subscription;

        private BoundedBody(int limit) {
            this.limit = limit;
        }

        @Override
        public CompletionStage<String> getBody() {
            return body;
        }

        @Override
        public void onSubscribe(Flow.Subscription subscription) {
            this.subscription = subscription;
            subscription.request(Long.MAX_VALUE);
        }

        @Override
        public void onNext(List<ByteBuffer> buffers) {
            for (ByteBuffer buffer : buffers) {
                int room = limit - collected.size();
                if (room <= 0) {
                    break;
                }
                byte[] chunk = new byte[Math.min(room, buffer.remaining())];
                buffer.get(chunk);
                collected.writeBytes(chunk);
            }
            if (collected.size() >= limit) {
                subscription.cancel();
                finish();
            }
        }

        @Override
        public void onError(Throwable error) {
            body.completeExceptionally(error);
        }

        @Override
        public void onComplete() {
            finish();
        }

        private void finish() {
            body.complete(collected.toString(StandardCharsets.UTF_8));
        }
    }

    /**
     * Turns a transport failure into something the caller can act on.
     *
     * The distinction that matters is timeout versus unreachable. Both leave us
     * without a Verdict, but one says the judge is overwhelmed and the other says
     * it is gone, and an operator reading the log at three in the morning should
     * not have to guess which.
     */
    private static JudgeUnavailableException classify(RestClientException e) {
        for (Throwable cause = e; cause != null; cause = cause.getCause()) {
            if (cause instanceof HttpTimeoutException) {
                return new JudgeUnavailableException(
                        JudgeUnavailableException.Reason.TIMEOUT, "the judge did not answer within the deadline", e);
            }
            if (cause instanceof ConnectException) {
                return new JudgeUnavailableException(
                        JudgeUnavailableException.Reason.UNREACHABLE, "the judge could not be reached", e);
            }
        }
        if (e instanceof ResourceAccessException) {
            return new JudgeUnavailableException(
                    JudgeUnavailableException.Reason.UNREACHABLE, "the judge could not be reached", e);
        }
        return new JudgeUnavailableException(JudgeUnavailableException.Reason.FAULT, "the judge could not be used", e);
    }

    private static long millisSince(long startedAtNanos) {
        return Duration.ofNanos(System.nanoTime() - startedAtNanos).toMillis();
    }

    /** The judge's own health document. Mirrors the Go type field for field. */
    record JudgeHealth(String status, String version, long uptimeSeconds, boolean judging) {}
}
