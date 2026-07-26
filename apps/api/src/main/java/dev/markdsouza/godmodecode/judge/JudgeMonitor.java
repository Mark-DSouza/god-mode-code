package dev.markdsouza.godmodecode.judge;

import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Watches the judge, on a schedule, so nothing else has to.
 *
 * One poller rather than a probe on every request. The health endpoint is hit by
 * the external uptime monitor, by the deploy script and by the container
 * runtime, and having each of those open a socket to a host on a routeless
 * subnet would make the backend's health depend on the judge's — which is the
 * exact coupling the Code Discipline degrading alone is supposed to avoid.
 *
 * What it does on each tick is deliberately ordered: probe first, and scrape
 * only if the probe answered. A scrape against a dead host is a second timeout
 * for no information.
 */
@Component
public class JudgeMonitor {

    private static final Logger log = LoggerFactory.getLogger(JudgeMonitor.class);

    private final JudgeClient client;
    private final JudgeMetricsMirror mirror;
    private final Clock clock;
    private final Duration staleAfter;

    /**
     * Volatile rather than synchronised: one scheduler thread writes it and
     * every request thread reads it, and a reader that sees the previous
     * observation for a few nanoseconds has lost nothing worth locking for.
     */
    private volatile Observation last;

    JudgeMonitor(JudgeClient client, JudgeMetricsMirror mirror, MeterRegistry registry, Clock clock,
            JudgeProperties properties) {
        this.client = client;
        this.mirror = mirror;
        this.clock = clock;
        this.staleAfter = properties.staleAfter();
        // Not yet probed is not the same as reachable, and starting optimistic
        // would mean the window between startup and the first poll reports a
        // judge that has never been spoken to as healthy.
        this.last = new Observation(Instant.MIN, JudgeAvailability.unreachable("the judge has not been probed yet"));

        // The backend's own view, not the judge's. This is what distinguishes
        // "the judge is down" from "nothing is scraping", which every mirrored
        // series alone cannot: they simply stop arriving in both cases.
        Gauge.builder("judge_reachable", this, monitor -> monitor.availability().reachable() ? 1 : 0)
                .description("Whether the backend's last probe reached the judge")
                .register(registry);
        Gauge.builder("judge_can_judge", this, monitor -> monitor.availability().canJudge() ? 1 : 0)
                .description("Whether the judge reported that it can accept Solve Runs")
                .register(registry);
    }

    /**
     * Probes the judge and mirrors its metrics.
     *
     * {@code fixedDelay}, not {@code fixedRate}: the interval is measured from
     * the end of the previous poll, so a judge that is timing out cannot make
     * the polls pile up on top of each other.
     */
    @Scheduled(fixedDelayString = "${gmc.judge.poll-interval}")
    public void poll() {
        JudgeAvailability availability = client.probe();
        if (availability.reachable()) {
            mirror.publish(client.scrapeMetrics());
        } else {
            mirror.markUnknown();
        }

        JudgeAvailability previous = last.availability();
        last = new Observation(clock.instant(), availability);

        // Transitions only. The judge is polled every fifteen seconds, and an
        // outage that logged on every tick would bury its own beginning.
        if (previous.canJudge() != availability.canJudge()) {
            if (availability.canJudge()) {
                log.info("The judge is accepting Solve Runs version={}", availability.version());
            } else {
                log.warn(
                        "The judge cannot judge; the Code Discipline is degraded reachable={} detail={}",
                        availability.reachable(),
                        availability.detail());
            }
        }
    }

    /**
     * The judge's availability as last observed.
     *
     * An observation older than {@code staleAfter} is reported as unreachable
     * rather than returned. The scheduler could be wedged, the poll could be
     * blocked on a socket that will never answer, and in both cases the honest
     * answer is that nobody knows — which for a dependency is the same as bad
     * news. Optimism here would let a stuck monitor keep the Code Discipline
     * looking healthy indefinitely.
     */
    public JudgeAvailability availability() {
        Observation observation = last;
        if (observation.at().isBefore(clock.instant().minus(staleAfter))) {
            return JudgeAvailability.unreachable("the judge has not been probed since " + observation.at());
        }
        return observation.availability();
    }

    private record Observation(Instant at, JudgeAvailability availability) {}
}
