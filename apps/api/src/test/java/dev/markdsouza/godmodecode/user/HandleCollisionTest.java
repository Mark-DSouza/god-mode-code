package dev.markdsouza.godmodecode.user;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import dev.markdsouza.godmodecode.AbstractIntegrationTest;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * What happens when two people draw the same two words.
 *
 * Forcing that with the real lists would mean creating enough Users to beat
 * twelve thousand pairs, so the word lists — and only the word lists — are
 * replaced with a single pair. Everything else is the real application: the same
 * endpoint, the same generator, the same database and the same constraint.
 */
class HandleCollisionTest extends AbstractIntegrationTest {

    private static final String ONLY_GERUND = "SPIRALING";
    private static final String ONLY_CREATURE = "MANTIS";
    private static final String ONLY_HANDLE = ONLY_GERUND + "_" + ONLY_CREATURE;

    /**
     * Nested, so Spring picks it up for this class alone. A second bean of the
     * same type marked {@code @Primary} rather than a replacement of the first:
     * bean overriding is off by default in Spring Boot 3, and turning it on to
     * win an argument with the framework is worse than being explicit.
     */
    @TestConfiguration
    static class OneWordPair {
        @Bean
        @Primary
        HandleWords onlyOnePairToDrawFrom() {
            return new HandleWords(List.of(ONLY_GERUND), List.of(ONLY_CREATURE));
        }
    }

    @Autowired
    TestRestTemplate http;

    @Autowired
    JdbcTemplate jdbc;

    /**
     * Only this class's Handles, never the whole table.
     *
     * Every integration test in the suite shares one PostgreSQL, and the
     * numbering below only holds if this pair starts free — but `DELETE FROM
     * users` would quietly reach into whatever another class had created, which
     * is correct today only because nothing runs them in parallel.
     */
    @BeforeEach
    void releaseTheWordPair() {
        jdbc.update("DELETE FROM users WHERE handle::text ~ ?", "^" + ONLY_HANDLE);
    }

    private int usersHolding() {
        return jdbc.queryForObject(
                "SELECT count(*) FROM users WHERE handle::text ~ ?", Integer.class, "^" + ONLY_HANDLE);
    }

    @Test
    @DisplayName("the first Handle is clean and only the ones after it carry a suffix")
    void onlyCollisionsAreSuffixed() {

        List<String> issued = new ArrayList<>();
        for (int visitor = 0; visitor < 4; visitor++) {
            ResponseEntity<User> response = http.postForEntity("/api/users", null, User.class);
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
            issued.add(response.getBody().handle());
        }

        // The whole criterion in one assertion: the first is clean, and the
        // suffix appears only where a Handle was already taken — densely, from
        // 2, so the second person to draw a pair is not handed _738.
        assertThat(issued)
                .containsExactly(
                        ONLY_HANDLE, ONLY_HANDLE + "_2", ONLY_HANDLE + "_3", ONLY_HANDLE + "_4");

        // And every one of them still fits the row it has to be read in.
        assertThat(issued).allSatisfy(handle -> assertThat(handle)
                .hasSizeLessThanOrEqualTo(HandleWords.MAX_HANDLE_LENGTH));
    }

    @Test
    @DisplayName("sixteen visitors arriving at once all get different Handles")
    void concurrentArrivalsNeverShareAHandle() throws Exception {

        int arrivals = 16;
        // Released only when every thread has reached it, so the requests contend
        // for the same Handle instead of politely queueing.
        CyclicBarrier allAtOnce = new CyclicBarrier(arrivals);

        List<Callable<String>> visitors = java.util.Collections.nCopies(arrivals, () -> {
            allAtOnce.await();
            ResponseEntity<User> response = http.postForEntity("/api/users", null, User.class);
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
            return response.getBody().handle();
        });

        List<String> issued;
        try (ExecutorService pool = Executors.newFixedThreadPool(arrivals)) {
            // get() rethrows whatever a worker threw, so a constraint violation
            // that escaped as a 500 fails here rather than being counted as a
            // Handle.
            issued = pool.invokeAll(visitors).stream()
                    .map(HandleCollisionTest::valueOf)
                    .toList();
        }

        assertThat(issued).hasSize(arrivals).doesNotHaveDuplicates();
        // Sixteen arrivals, sixteen rows: nobody was quietly dropped to make the
        // Handles unique.
        assertThat(usersHolding()).isEqualTo(arrivals);
    }

    @Test
    @DisplayName("the database, not the application, is what refuses a duplicate Handle")
    void theDatabaseRefusesADuplicate() {
        jdbc.update(
                "INSERT INTO users (handle, recognition_key_hash) VALUES (?, ?)",
                ONLY_HANDLE,
                "a".repeat(64));

        // Straight at the table, going nowhere near the generator or the service.
        // If this passed, every retry loop above would be the only thing standing
        // between two players and the same Handle.
        assertThatThrownBy(() -> jdbc.update(
                        "INSERT INTO users (handle, recognition_key_hash) VALUES (?, ?)",
                        ONLY_HANDLE,
                        "b".repeat(64)))
                .isInstanceOf(DuplicateKeyException.class);

        // citext (V1): the same Handle in different case is the same Handle, so
        // nobody can stand next to PERCOLATING_FERRET on a Leaderboard calling
        // themselves Percolating_Ferret.
        assertThatThrownBy(() -> jdbc.update(
                        "INSERT INTO users (handle, recognition_key_hash) VALUES (?, ?)",
                        "Spiraling_Mantis",
                        "c".repeat(64)))
                .isInstanceOf(DuplicateKeyException.class);
    }

    private static String valueOf(Future<String> handle) {
        try {
            return handle.get();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(e);
        } catch (Exception e) {
            throw new IllegalStateException("A visitor did not get a Handle", e);
        }
    }
}
