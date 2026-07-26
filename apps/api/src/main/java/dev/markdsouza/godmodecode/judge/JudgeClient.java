package dev.markdsouza.godmodecode.judge;

import java.net.ConnectException;
import java.net.http.HttpTimeoutException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Locale;
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

    // Qualified explicitly. There are two RestClient beans and they differ only
    // in their deadline, so injection by parameter name would work right up
    // until somebody renamed a parameter and silently gave every judging a two
    // second timeout.
    JudgeClient(
            @Qualifier("judgingRestClient") RestClient judgingRestClient,
            @Qualifier("monitoringRestClient") RestClient monitoringRestClient) {
        this.judging = judgingRestClient;
        this.monitoring = monitoringRestClient;
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
    public Judging judge(Submission submission) {
        long startedAt = System.nanoTime();
        try {
            Judging judged = judging.post()
                    .uri("/judgings")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(submission)
                    .retrieve()
                    // 404 is the judge working correctly and telling us the
                    // catalogues have skewed, so it is not an availability
                    // problem and must not be reported as one.
                    .onStatus(status -> status.value() == 404, (request, response) -> {
                        throw new UnknownPatternException(submission.patternId());
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
                    submission.patternId(),
                    judged.verdict().wireName(),
                    judged.testsPassed(),
                    judged.testsTotal(),
                    judged.durationMillis(),
                    millisSince(startedAt));
            return judged;

        } catch (UnknownPatternException e) {
            log.warn(
                    "Judging refused patternId={} outcome=unknown-pattern roundTripMs={}",
                    submission.patternId(),
                    millisSince(startedAt));
            throw e;
        } catch (JudgeUnavailableException e) {
            log.warn(
                    "Judging failed patternId={} outcome={} roundTripMs={} reason={}",
                    submission.patternId(),
                    e.reason().name().toLowerCase(Locale.ROOT),
                    millisSince(startedAt),
                    e.getMessage());
            throw e;
        } catch (RestClientException e) {
            JudgeUnavailableException unavailable = classify(e);
            log.warn(
                    "Judging failed patternId={} outcome={} roundTripMs={} reason={}",
                    submission.patternId(),
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
        try {
            return monitoring.get().uri("/metrics").exchange((request, response) -> {
                if (response.getStatusCode().isError()) {
                    return null;
                }
                // Read a bounded number of bytes rather than the whole body.
                // This is the one response in the system that arrives from the
                // host running untrusted code, and a compromised judge that
                // answers a scrape with an endless stream would otherwise take
                // the backend's heap with it. Truncation is safe here: the
                // parser drops the partial final line.
                byte[] body = response.getBody().readNBytes(MAX_METRICS_BYTES);
                return new String(body, StandardCharsets.UTF_8);
            });
        } catch (RestClientException e) {
            log.debug("Could not scrape the judge reason={}", e.getMessage());
            return null;
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
