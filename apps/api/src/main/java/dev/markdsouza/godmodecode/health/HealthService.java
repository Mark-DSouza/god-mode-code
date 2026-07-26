package dev.markdsouza.godmodecode.health;

import dev.markdsouza.godmodecode.judge.JudgeMonitor;
import java.sql.Connection;
import java.sql.SQLException;
import javax.sql.DataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Answers whether the backend can actually do its job right now.
 *
 * Deliberately checks the database with a real round trip rather than asking the
 * connection pool whether it believes it is healthy. A pool holding stale
 * connections to a database that has gone away reports itself fine, which is
 * exactly the failure a health check exists to catch.
 */
@Service
public class HealthService {

    private static final Logger log = LoggerFactory.getLogger(HealthService.class);

    /** Long enough to survive a slow query, short enough that a wedged database fails fast. */
    private static final int VALIDATION_TIMEOUT_SECONDS = 2;

    private final DataSource dataSource;
    private final JudgeMonitor judge;
    private final String version;

    HealthService(DataSource dataSource, JudgeMonitor judge, @Value("${gmc.version:unknown}") String version) {
        this.dataSource = dataSource;
        this.judge = judge;
        this.version = version;
    }

    public HealthStatus check() {
        // The judge's state is read from the poller rather than probed here. It
        // sits on a routeless subnet, and this endpoint is hit by the uptime
        // monitor, the deploy script and the container runtime; opening a socket
        // to the judge on each of those would make the whole site's health wait
        // on the one dependency that is allowed to be unwell on its own
        // (ADR-0005).
        return HealthStatus.of(databaseReachable(), judge.availability().canJudge(), version);
    }

    private boolean databaseReachable() {
        try (Connection connection = dataSource.getConnection()) {
            return connection.isValid(VALIDATION_TIMEOUT_SECONDS);
        } catch (SQLException e) {
            // Logged at warn rather than error: the health endpoint reporting a
            // database outage is the system working, and this fires on every
            // poll for as long as the outage lasts.
            log.warn("Health check could not reach the database", e);
            return false;
        }
    }
}
