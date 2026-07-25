package dev.markdsouza.godmodecode.migration;

import static org.assertj.core.api.Assertions.assertThat;

import dev.markdsouza.godmodecode.AbstractIntegrationTest;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import javax.sql.DataSource;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * "Gated so only one instance migrates" is the kind of claim that is true right
 * up until a rolling deploy starts two containers in the same second, so it is
 * worth actually racing.
 *
 * Flyway takes a PostgreSQL session-level advisory lock before it touches the
 * schema history table. The instance that loses the race blocks until the
 * winner commits, then finds nothing left to do. What must never happen is both
 * applying the same migration — on a schema change that is a duplicate DDL
 * error at best and a half-applied schema at worst.
 */
class MigrationConcurrencyTest extends AbstractIntegrationTest {

    private static final int CONCURRENT_INSTANCES = 4;

    @Autowired
    DataSource dataSource;

    @Autowired
    JdbcTemplate jdbc;

    @Test
    @DisplayName("racing instances leave exactly one history row per migration")
    void onlyOneInstanceApplies() throws Exception {
        // The application has already migrated on startup, so this re-runs the
        // race against an up-to-date schema — the rolling-deploy case, where
        // every instance starts with migrations that may or may not be pending.
        List<String> before = appliedVersions();

        try (ExecutorService pool = Executors.newFixedThreadPool(CONCURRENT_INSTANCES)) {
            List<Callable<Void>> instances = java.util.Collections.nCopies(CONCURRENT_INSTANCES, () -> {
                Flyway.configure()
                        .dataSource(dataSource)
                        .locations("classpath:db/migration")
                        .lockRetryCount(50)
                        .load()
                        .migrate();
                return null;
            });

            // get() rethrows anything a worker threw: a deadlock, a lock
            // timeout or a duplicate-key violation on the history table all
            // fail the test here rather than being swallowed.
            for (Future<Void> result : pool.invokeAll(instances)) {
                result.get();
            }
        }

        assertThat(appliedVersions())
                .as("no migration applied twice, and none lost")
                .isEqualTo(before)
                .doesNotHaveDuplicates();
    }

    private List<String> appliedVersions() {
        return jdbc.queryForList(
                "SELECT version FROM flyway_schema_history WHERE success = true ORDER BY installed_rank",
                String.class);
    }
}
