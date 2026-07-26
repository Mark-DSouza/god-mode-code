package dev.markdsouza.godmodecode.judge;

import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Tag;
import io.micrometer.core.instrument.Tags;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicReference;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Re-publishes what the judge measures into the backend's own meter registry.
 *
 * The judge cannot ship telemetry. It has no egress, so there is no sink it can
 * push to and no name it could resolve if there were, and the interface
 * endpoints that would fix that cost more per month than the instance does
 * (ADR-0005). So it exposes a scrape endpoint on the private link instead and
 * the backend pulls it — after which the judge's numbers ride out on the
 * backend's existing path to Grafana Cloud (ADR-0008). Without this class, every
 * counter the judge keeps is visible only to somebody standing at the console of
 * a host nobody can log in to.
 *
 * <h2>Everything is mirrored as a gauge</h2>
 *
 * Including the judge's counters. A mirrored counter is a snapshot of somebody
 * else's total, and feeding it into a Micrometer counter would mean computing
 * deltas and inventing a reset policy for the case where the judge restarts —
 * which it does, on every replacement of an instance that holds no state.
 * Publishing the observed value as a gauge keeps the arithmetic where it belongs,
 * in whatever queries the dashboards run.
 *
 * <h2>The payload is not trusted</h2>
 *
 * This is the one response in the system that comes from the host running code
 * nobody vetted. So the parser accepts only the judge's own metric names, caps
 * how many distinct series it will ever register, and ignores anything it does
 * not understand. An unbounded mirror would let a compromised judge exhaust the
 * backend's memory through the meter registry — a cardinality bomb aimed at the
 * one component that can reach the internet.
 */
@Component
public class JudgeMetricsMirror {

    private static final Logger log = LoggerFactory.getLogger(JudgeMetricsMirror.class);

    /** Only the judge's own names. Anything else in that payload is not ours to publish. */
    private static final String ACCEPTED_PREFIX = "judge_";

    /**
     * Names the backend keeps for itself, whatever the judge calls its own
     * metrics.
     *
     * These two are the backend's view of the judge rather than the judge's view
     * of itself — they are what distinguishes "the judge is down" from "nothing
     * is scraping". A compromised judge that emitted them would be claiming to
     * be reachable in the one series that exists to say otherwise, and
     * Micrometer would silently drop the second registration, leaving the real
     * gauge intact but the mirror updating a holder nobody reads.
     */
    private static final Set<String> RESERVED = Set.of("judge_reachable", "judge_can_judge");

    /**
     * The judge exposes nine series. This is generous room for it to grow and a
     * hard stop well before a registry full of invented ones costs anything.
     */
    private static final int MAX_SERIES = 64;

    private final MeterRegistry registry;

    /** One holder per series, registered once and updated in place on every scrape. */
    private final Map<Series, AtomicReference<Double>> values = new ConcurrentHashMap<>();

    JudgeMetricsMirror(MeterRegistry registry) {
        this.registry = registry;
    }

    /**
     * Publishes one scrape.
     *
     * @param exposition Prometheus text format, or {@code null} if the scrape
     *                   failed — in which case every mirrored series is marked
     *                   unknown rather than left at its last value.
     */
    public void publish(String exposition) {
        if (exposition == null) {
            markUnknown();
            return;
        }
        for (String line : exposition.split("\n")) {
            Sample sample = parse(line);
            if (sample != null) {
                record(sample);
            }
        }
    }

    /**
     * Marks every mirrored series unknown, because the judge could not be read.
     *
     * NaN rather than zero, and rather than leaving the last value in place. A
     * stale value is the worst of the three: a dashboard showing the judgings
     * counter frozen at yesterday's total looks like a quiet day rather than an
     * unreachable host, and NaN is the one value that renders as the gap it is.
     */
    public void markUnknown() {
        values.values().forEach(holder -> holder.set(Double.NaN));
    }

    private void record(Sample sample) {
        AtomicReference<Double> holder = values.get(sample.series());
        if (holder != null) {
            holder.set(sample.value());
            return;
        }
        if (values.size() >= MAX_SERIES) {
            // Logged once per over-limit sample would be a log flood of its own,
            // so this is DEBUG. The cap being hit at all is visible as series
            // that stop updating, and a judge inventing metric names is a
            // compromised judge, which the backend cannot fix from here anyway.
            log.debug("Ignoring judge series beyond the mirror's cap name={}", sample.series().name());
            return;
        }
        AtomicReference<Double> created = new AtomicReference<>(sample.value());
        // computeIfAbsent, so two scrapes racing register the gauge once. A
        // second registration for the same name and tags would be silently
        // ignored by Micrometer and leave the loser's holder orphaned, updating
        // a gauge nobody reads.
        AtomicReference<Double> current = values.computeIfAbsent(sample.series(), series -> {
            Gauge.builder(series.name(), created, AtomicReference::get)
                    .tags(series.tags())
                    .description("Mirrored from the judge, which cannot ship its own telemetry")
                    .register(registry);
            return created;
        });
        current.set(sample.value());
    }

    /**
     * Reads one line of Prometheus text exposition.
     *
     * A deliberately small parser rather than a dependency. The only producer is
     * the judge's own hand-written exposition, whose format is fixed a few
     * hundred lines away in {@code apps/judge/internal/metrics}, and a library
     * for reading nine lines of {@code name{label="value"} number} would be more
     * code to audit than the parser is.
     *
     * @return the sample, or {@code null} for a comment, a blank line, or
     *         anything that does not parse — which is exactly what a scraper
     *         should do with a line it does not understand.
     */
    private static Sample parse(String rawLine) {
        String line = rawLine.trim();
        if (line.isEmpty() || line.startsWith("#")) {
            return null;
        }

        int valueSeparator = line.lastIndexOf(' ');
        if (valueSeparator < 0) {
            return null;
        }
        String identifier = line.substring(0, valueSeparator).trim();
        double value;
        try {
            value = Double.parseDouble(line.substring(valueSeparator + 1).trim());
        } catch (NumberFormatException e) {
            return null;
        }

        String name = identifier;
        Tags tags = Tags.empty();
        int labelsStart = identifier.indexOf('{');
        if (labelsStart >= 0) {
            if (!identifier.endsWith("}")) {
                return null;
            }
            name = identifier.substring(0, labelsStart).trim();
            tags = parseTags(identifier.substring(labelsStart + 1, identifier.length() - 1));
        }

        if (!name.startsWith(ACCEPTED_PREFIX) || RESERVED.contains(name)) {
            return null;
        }
        return new Sample(new Series(name, tags), value);
    }

    private static Tags parseTags(String labels) {
        List<Tag> parsed = new ArrayList<>();
        for (String label : labels.split(",")) {
            String[] halves = label.split("=", 2);
            if (halves.length != 2) {
                continue;
            }
            String key = halves[0].trim();
            String value = halves[1].trim();
            if (value.length() >= 2 && value.startsWith("\"") && value.endsWith("\"")) {
                value = value.substring(1, value.length() - 1);
            }
            if (!key.isEmpty()) {
                parsed.add(Tag.of(key, value));
            }
        }
        return Tags.of(parsed);
    }

    /** A metric name and its labels: the identity of one mirrored series. */
    private record Series(String name, Tags tags) {}

    private record Sample(Series series, double value) {}
}
