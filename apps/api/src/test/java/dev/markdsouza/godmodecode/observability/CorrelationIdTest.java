package dev.markdsouza.godmodecode.observability;

import static org.assertj.core.api.Assertions.assertThat;

import dev.markdsouza.godmodecode.AbstractIntegrationTest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;

/**
 * One identifier tying a response somebody is holding to the log lines the
 * request produced. Without it, "the site broke for me at about half past four"
 * is the entirety of what you have to search on.
 */
class CorrelationIdTest extends AbstractIntegrationTest {

    @Autowired
    TestRestTemplate http;

    @Test
    @DisplayName("returns a correlation id on every response")
    void returnsACorrelationId() {
        ResponseEntity<String> response = http.getForEntity("/api/health", String.class);

        String id = response.getHeaders().getFirst(CorrelationId.HEADER);
        assertThat(id).isNotNull().isNotBlank();
    }

    @Test
    @DisplayName("gives different requests different ids")
    void givesDifferentRequestsDifferentIds() {
        String first = http.getForEntity("/api/health", String.class)
                .getHeaders()
                .getFirst(CorrelationId.HEADER);
        String second = http.getForEntity("/api/health", String.class)
                .getHeaders()
                .getFirst(CorrelationId.HEADER);

        assertThat(first).isNotEqualTo(second);
    }

    @Test
    @DisplayName("adopts Cloudflare's ray id, so the edge log and ours name the same request")
    void adoptsTheRayId() {
        HttpHeaders headers = new HttpHeaders();
        headers.set(CorrelationId.CLOUDFLARE_HEADER, "8f1e2d3c4b5a6978-BOM");

        ResponseEntity<String> response =
                http.exchange("/api/health", HttpMethod.GET, new HttpEntity<>(headers), String.class);

        assertThat(response.getHeaders().getFirst(CorrelationId.HEADER)).isEqualTo("8f1e2d3c4b5a6978-BOM");
    }

    @Test
    @DisplayName("refuses an id that would forge log lines, rather than writing it out")
    void refusesAnIdThatWouldForgeLogLines() {
        // Asserted directly rather than over HTTP, because the client refuses
        // to send a header containing a newline at all — which is a defence,
        // not a guarantee. The value arrives from the edge, ends up in a log
        // file, and a newline in it appends a line of the sender's own
        // invention. That is how an audit trail becomes fiction. Structured
        // output escapes it; the human-readable console format does not, and
        // which one is in use is a setting rather than a promise.
        String forged = CorrelationId.from("abc\ndef ERROR everything is fine");

        assertThat(forged).doesNotContain("ERROR").doesNotContain("\n");
    }

    @Test
    @DisplayName("refuses an id carrying anything but the characters an id is made of")
    void refusesAnIdWithUnexpectedCharacters() {
        assertThat(CorrelationId.from("../../etc/passwd")).doesNotContain("/");
        assertThat(CorrelationId.from("")).isNotEmpty();
        assertThat(CorrelationId.from(null)).isNotBlank();
    }

    @Test
    @DisplayName("refuses an id long enough to bury the line it appears on")
    void refusesAnOverlongId() {
        HttpHeaders headers = new HttpHeaders();
        headers.set(CorrelationId.CLOUDFLARE_HEADER, "a".repeat(500));

        ResponseEntity<String> response =
                http.exchange("/api/health", HttpMethod.GET, new HttpEntity<>(headers), String.class);

        String id = response.getHeaders().getFirst(CorrelationId.HEADER);
        assertThat(id).isNotNull().hasSizeLessThanOrEqualTo(CorrelationId.MAX_LENGTH);
    }
}
