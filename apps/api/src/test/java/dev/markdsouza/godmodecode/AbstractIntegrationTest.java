package dev.markdsouza.godmodecode;

import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.test.context.ActiveProfiles;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * Base for tests that drive the application through its HTTP boundary against a
 * real PostgreSQL.
 *
 * Real, not H2 and not a mock. The ranking queries this codebase is heading
 * toward lean on window functions and index behaviour that an in-memory
 * substitute either implements differently or not at all, and a test suite that
 * passes against a database nobody deploys is a test suite that reports the
 * wrong answer.
 *
 * The container is {@code static}, so one PostgreSQL is started for the whole
 * suite and shared by every subclass through Spring's context cache. Per-class
 * containers would add a few seconds to each test class for no isolation
 * benefit that a transaction rollback does not already give.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
@Testcontainers
public abstract class AbstractIntegrationTest {

    /**
     * Pinned to the major version deployed in production. Floating this to
     * `latest` would mean a PostgreSQL release could break the build on a day
     * nobody changed any code.
     */
    @SuppressWarnings("resource") // Testcontainers closes this via its JVM shutdown hook.
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17-alpine")
            .withDatabaseName("godmodecode")
            .withUsername("godmodecode")
            .withPassword("godmodecode");

    static {
        POSTGRES.start();
    }

    @Autowired
    private TestRestTemplate httpForCsrfSetup;

    /**
     * A subclass that adds its own {@code @TestConfiguration} or {@code
     * @DynamicPropertySource} — {@link dev.markdsouza.godmodecode.user.HandleCollisionTest},
     * every {@link dev.markdsouza.godmodecode.pattern.JudgedIntegrationTest}
     * subclass — gets a Spring context of its own, and with it a {@code
     * TestRestTemplate} bean of its own. A flag scoped to this class would
     * only ever catch the first such context; checking the instance's own
     * interceptor list is what makes this correct once for every context,
     * including the ones nothing else here knows the names of.
     */
    @BeforeEach
    void installCsrfInterceptorOnce() {
        var interceptors = httpForCsrfSetup.getRestTemplate().getInterceptors();
        if (interceptors.stream().noneMatch(CsrfHeaderInterceptor.class::isInstance)) {
            interceptors.add(new CsrfHeaderInterceptor());
        }
    }
}
