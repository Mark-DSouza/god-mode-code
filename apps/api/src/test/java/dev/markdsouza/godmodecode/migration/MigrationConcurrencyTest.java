package dev.markdsouza.godmodecode.migration;

import static org.assertj.core.api.Assertions.assertThat;

import dev.markdsouza.godmodecode.AbstractIntegrationTest;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import javax.sql.DataSource;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.output.MigrateResult;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * "Gated so only one instance migrates" is the kind of claim that holds right
 * up until a rolling deploy starts two containers in the same second, so it is
 * worth actually racing.
 *
 * Flyway takes a PostgreSQL session-level advisory lock before it touches the
 * schema history table. The instance that loses blocks until the winner
 * commits, then finds nothing left to do. What must never happen is two
 * instances applying the same migration — on a schema change that is a
 * duplicate DDL error at best and a half-applied schema at worst.
 *
 * The race runs against a schema of its own, created empty. Racing the
 * application's schema would prove nothing: Spring has already migrated it on
 * startup, so every thread would find nothing pending and the test would pass
 * just as happily with locking switched off.
 */
class MigrationConcurrencyTest extends AbstractIntegrationTest {

    private static final int CONCURRENT_INSTANCES = 4;

    @Autowired
    DataSource dataSource;

    @Autowired
    JdbcTemplate jdbc;

    /** Unique per test, so a failed run cannot poison the next one. */
    private final String schema = "race_" + UUID.randomUUID().toString().replace("-", "");

    @AfterEach
    void dropRaceSchema() {
        jdbc.execute("DROP SCHEMA IF EXISTS \"" + schema + "\" CASCADE");
    }

    @Test
    @DisplayName("only one of four simultaneous instances applies the pending migrations")
    void onlyOneInstanceApplies() throws Exception {
        // Released only when every thread has reached it, so the instances
        // contend for the lock rather than politely arriving one at a time.
        CyclicBarrier startTogether = new CyclicBarrier(CONCURRENT_INSTANCES);

        List<Callable<Integer>> instances = java.util.Collections.nCopies(
                CONCURRENT_INSTANCES,
                () -> {
                    startTogether.await();
                    MigrateResult result = Flyway.configure()
                            .dataSource(dataSource)
                            .schemas(schema)
                            .defaultSchema(schema)
                            .createSchemas(true)
                            .locations("classpath:db/migration")
                            .lockRetryCount(50)
                            .load()
                            .migrate();
                    return result.migrationsExecuted;
                });

        int totalExecuted = 0;
        try (ExecutorService pool = Executors.newFixedThreadPool(CONCURRENT_INSTANCES)) {
            // get() rethrows whatever a worker threw, so a deadlock, a lock
            // timeout or a duplicate-key violation on the history table fails
            // the test here rather than being swallowed.
            for (Future<Integer> result : pool.invokeAll(instances)) {
                totalExecuted += result.get();
            }
        }

        int migrationsOnDisk = appliedVersions().size();
        assertThat(migrationsOnDisk)
                .as("the race is meaningless unless there was something to apply")
                .isPositive();

        // The assertion that carries the acceptance criterion. Four instances
        // raced; between them they applied each migration exactly once. Were
        // the lock not held, more than one would report having done the work.
        assertThat(totalExecuted)
                .as("each migration applied by exactly one instance, not by several")
                .isEqualTo(migrationsOnDisk);

        assertThat(appliedVersions())
                .as("no migration recorded twice")
                .doesNotHaveDuplicates();
    }

    private List<String> appliedVersions() {
        // `version IS NOT NULL` drops the schema-creation bookkeeping row that
        // Flyway writes when it creates the schema itself. It is not a
        // migration, and counting it would make the totals disagree by one.
        return jdbc.queryForList(
                "SELECT version FROM \"" + schema + "\".flyway_schema_history"
                        + " WHERE success = true AND version IS NOT NULL"
                        + " ORDER BY installed_rank",
                String.class);
    }
}
