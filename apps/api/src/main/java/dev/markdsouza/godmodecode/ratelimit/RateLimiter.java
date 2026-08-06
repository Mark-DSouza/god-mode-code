package dev.markdsouza.godmodecode.ratelimit;

import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import org.springframework.stereotype.Component;

/**
 * How many times something is allowed to happen, per key, per window.
 *
 * A fixed window counted in memory: this is the entire enforcement point
 * behind Unclaimed User creation, Challenge issuing and Run submission
 * (ADR-0007's "the defence against Handle-farming is rate limiting"). There is
 * exactly one application instance (ADR-0008), so a shared store bought
 * nothing here that a map on the heap does not already give.
 *
 * ponytail: a fixed window lets a caller land up to twice the limit across a
 * window boundary (a burst at 0:59 and another at 1:00). A sliding window or
 * token bucket closes that, and is worth building the day someone actually
 * exploits the boundary rather than the twenty lines above it.
 */
@Component
public class RateLimiter {

    private record Window(Instant startedAt, AtomicInteger count) {}

    private final ConcurrentHashMap<String, Window> windows = new ConcurrentHashMap<>();

    /** Whether one more occurrence of {@code key} is allowed within {@code limit} per {@code window}. */
    public boolean allow(String key, int limit, Duration window) {
        Instant now = Instant.now();
        Window current = windows.compute(key, (ignored, existing) -> {
            if (existing == null || Duration.between(existing.startedAt(), now).compareTo(window) >= 0) {
                return new Window(now, new AtomicInteger(1));
            }
            existing.count().incrementAndGet();
            return existing;
        });
        return current.count().get() <= limit;
    }
}
