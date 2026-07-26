package dev.markdsouza.godmodecode.observability;

import static org.assertj.core.api.Assertions.assertThat;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import dev.markdsouza.godmodecode.AbstractIntegrationTest;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.slf4j.event.KeyValuePair;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.core.env.Environment;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * What a failure leaves behind for whoever reads the logs afterwards.
 *
 * The assertions are on the logging event rather than on captured console
 * output, because the console format is a process-wide setting fixed by
 * whichever Spring context starts first — asserting on the rendered text would
 * make this class pass or fail according to the order the suite happened to run
 * in. The serialisation is Spring Boot's; the fields are ours, and the fields
 * are what is asserted here.
 */
@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        // The same switch production sets, so the wiring between the two names
        // is exercised rather than assumed.
        properties = "GMC_LOG_FORMAT=ecs")
@Import(StructuredLoggingTest.ExplodingEndpointConfiguration.class)
class StructuredLoggingTest extends AbstractIntegrationTest {

    private static final String RAY_ID = "deadbeefcafe0001-BOM";

    @Autowired
    TestRestTemplate http;

    @Autowired
    Environment environment;

    private final Logger filterLogger = (Logger) LoggerFactory.getLogger(CorrelationIdFilter.class);
    private final ListAppender<ILoggingEvent> recorded = new ListAppender<>();

    @BeforeEach
    void record() {
        recorded.start();
        filterLogger.addAppender(recorded);
    }

    @AfterEach
    void stopRecording() {
        filterLogger.detachAppender(recorded);
        recorded.stop();
    }

    @Test
    @DisplayName("emits JSON when the deployed switch is set, rather than lines needing a regular expression")
    void emitsJsonWhenTheDeployedSwitchIsSet() {
        // Loki indexes fields it is given; anything else has to be recovered
        // with a pattern that breaks the first time a message changes shape.
        assertThat(environment.getProperty("logging.structured.format.console"))
                .isEqualTo("ecs");
    }

    @Test
    @DisplayName("records a failed request against the id the caller was handed")
    void recordsAFailedRequestAgainstTheIdTheCallerWasHanded() {
        HttpHeaders headers = new HttpHeaders();
        headers.set(CorrelationId.CLOUDFLARE_HEADER, RAY_ID);

        ResponseEntity<String> response =
                http.exchange("/api/exploding", HttpMethod.GET, new HttpEntity<>(headers), String.class);

        // Whoever reports the bug is holding this; it has to be the same string
        // the log line was written under, or the two cannot be joined up.
        assertThat(response.getHeaders().getFirst(CorrelationId.HEADER)).isEqualTo(RAY_ID);

        ILoggingEvent failure = onlyFailure();
        assertThat(failure.getMDCPropertyMap()).containsEntry(CorrelationId.MDC_KEY, RAY_ID);
        assertThat(failure.getFormattedMessage()).isEqualTo("request failed");

        // Fields rather than an interpolated sentence, so "every failure on
        // this path" is a query instead of a grep.
        assertThat(keyValues(failure))
                .containsEntry("http.request.method", "GET")
                .containsEntry("url.path", "/api/exploding");

        // The failure itself, not the ServletException Spring wrapped it in.
        // Every controller failure shares that wrapper, so typing them all by
        // it would sort the log stream into one enormous useless bucket.
        assertThat(failure.getThrowableProxy()).isNotNull();
        assertThat(failure.getThrowableProxy().getClassName()).isEqualTo(IllegalStateException.class.getName());
        assertThat(failure.getThrowableProxy().getMessage()).isEqualTo("the deliberately triggered failure");
    }

    @Test
    @DisplayName("does not leave one request's id attached to the next one")
    void doesNotLeaveOneRequestsIdAttachedToTheNext() {
        // Servlet containers reuse threads, so an id left on one is inherited
        // by whatever lands there next. That failure is invisible until an
        // incident, when it quietly points at the wrong request.
        HttpHeaders headers = new HttpHeaders();
        headers.set(CorrelationId.CLOUDFLARE_HEADER, RAY_ID);
        http.exchange("/api/exploding", HttpMethod.GET, new HttpEntity<>(headers), String.class);

        recorded.list.clear();

        ResponseEntity<String> anonymous = http.getForEntity("/api/exploding", String.class);
        String freshId = anonymous.getHeaders().getFirst(CorrelationId.HEADER);

        assertThat(freshId).isNotEqualTo(RAY_ID);
        assertThat(onlyFailure().getMDCPropertyMap()).containsEntry(CorrelationId.MDC_KEY, freshId);
    }

    private ILoggingEvent onlyFailure() {
        List<ILoggingEvent> failures = recorded.list.stream()
                .filter(event -> event.getLevel() == ch.qos.logback.classic.Level.ERROR)
                .toList();
        assertThat(failures).hasSize(1);
        return failures.getFirst();
    }

    private Map<String, Object> keyValues(ILoggingEvent event) {
        List<KeyValuePair> pairs = event.getKeyValuePairs();
        assertThat(pairs).isNotNull();
        return pairs.stream().collect(Collectors.toMap(pair -> pair.key, pair -> pair.value));
    }

    /**
     * An endpoint that exists only here. Shipping one whose purpose is to fail
     * would hand anyone on the internet a way to fill the log stream the alerts
     * are built on.
     */
    @TestConfiguration
    static class ExplodingEndpointConfiguration {

        @Bean
        ExplodingEndpoint explodingEndpoint() {
            return new ExplodingEndpoint();
        }
    }

    @RestController
    static class ExplodingEndpoint {

        @GetMapping("/api/exploding")
        String explode() {
            throw new IllegalStateException("the deliberately triggered failure");
        }
    }
}
