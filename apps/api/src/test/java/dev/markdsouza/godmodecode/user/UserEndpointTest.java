package dev.markdsouza.godmodecode.user;

import static org.assertj.core.api.Assertions.assertThat;

import dev.markdsouza.godmodecode.AbstractIntegrationTest;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Arriving for the first time and becoming someone, driven through the HTTP
 * boundary against a real PostgreSQL.
 */
class UserEndpointTest extends AbstractIntegrationTest {

    @Autowired
    TestRestTemplate http;

    @Autowired
    JdbcTemplate jdbc;

    @Test
    @DisplayName("a first visit creates an Unclaimed User with a generated Handle")
    void firstVisitCreatesAnUnclaimedUser() {
        ResponseEntity<User> response = http.postForEntity("/api/users", null, User.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().id()).isNotNull();
        // GERUND_CREATURE, uppercase, no suffix on the first Handle to use this
        // pair of words.
        assertThat(response.getBody().handle()).matches("^[A-Z]+ING_[A-Z]+$");
        // Drawn from the committed lists, so it fits a Leaderboard row at 320px
        // with the collision suffix still in reserve.
        assertThat(response.getBody().handle())
                .hasSizeLessThanOrEqualTo(HandleWords.MAX_BASE_LENGTH);
        // ADR-0007: an Unclaimed User is a User with no credentials attached,
        // not a separate record — so the same payload describes both, and this
        // one simply reports that nothing has been claimed yet.
        assertThat(response.getBody().claimed()).isFalse();

        Integer stored = jdbc.queryForObject(
                "SELECT count(*) FROM users WHERE id = ? AND credential_subject IS NULL",
                Integer.class,
                response.getBody().id());
        assertThat(stored).isEqualTo(1);
    }

    @Test
    @DisplayName("a browser with no cookie is nobody yet")
    void aBrowserWithNoCookieIsNobody() {
        assertThat(http.getForEntity("/api/users/me", String.class).getStatusCode())
                .isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    @DisplayName("a return visit is recognised as the same User, with the same Handle")
    void aReturnVisitIsTheSameUser() {
        ResponseEntity<User> created = http.postForEntity("/api/users", null, User.class);
        String cookie = recognitionCookieFrom(created);

        ResponseEntity<User> returning = http.exchange(
                "/api/users/me", HttpMethod.GET, withCookie(cookie), User.class);

        assertThat(returning.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(returning.getBody()).isEqualTo(created.getBody());
    }

    @Test
    @DisplayName("the cookie outlives the browser, and is out of reach of any script")
    void theCookieOutlivesTheBrowser() {
        ResponseEntity<User> created = http.postForEntity("/api/users", null, User.class);
        String setCookie = created.getHeaders().getFirst(HttpHeaders.SET_COOKIE);

        assertThat(setCookie).isNotNull();
        // A session cookie — one with no Max-Age — is discarded when the browser
        // closes, which is precisely the criterion this must not fail. The
        // attribute being present, and large, is what makes the identity survive
        // a restart rather than only a reload.
        assertThat(setCookie).containsPattern("Max-Age=(\\d{7,})");
        assertThat(setCookie).contains("HttpOnly");
        assertThat(setCookie).contains("SameSite=Lax");
        assertThat(setCookie).contains("Path=/");

        // The cookie carries an opaque key, never the User's id. The id is
        // published in Leaderboard payloads, so an id that also recognised the
        // browser would let anyone reading a Leaderboard become anyone on it.
        assertThat(created.getBody()).isNotNull();
        assertThat(setCookie).doesNotContain(created.getBody().id().toString());
    }

    @Test
    @DisplayName("a browser that is already someone does not become someone else")
    void creatingTwiceDoesNotOrphanTheFirstUser() {
        ResponseEntity<User> first = http.postForEntity("/api/users", null, User.class);
        String cookie = recognitionCookieFrom(first);

        ResponseEntity<User> again =
                http.exchange("/api/users", HttpMethod.POST, withCookie(cookie), User.class);

        // The endpoint is the one thing on the site that is unsafe to repeat, and
        // a browser can repeat it — a double-submit, a retried request, a second
        // tab racing the first. Creating a second User there would strand every
        // Run the visitor had already recorded (ADR-0007), so an arrival that is
        // already someone is simply told who they are.
        assertThat(again.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(again.getBody()).isEqualTo(first.getBody());
        assertThat(again.getHeaders().getFirst(HttpHeaders.SET_COOKIE))
                .as("the browser already holds the right key; overwriting it can only lose it")
                .isNull();
    }

    @Test
    @DisplayName("a cookie nobody was ever issued recognises nobody")
    void aForgedCookieRecognisesNobody() {
        ResponseEntity<User> forged = http.exchange(
                "/api/users/me",
                HttpMethod.GET,
                withCookie("not-a-key-anyone-was-given"),
                User.class);

        assertThat(forged.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    @DisplayName("the raw key is never written down — only its digest")
    void theRawKeyIsNeverStored() {
        ResponseEntity<User> created = http.postForEntity("/api/users", null, User.class);
        String key = recognitionCookieFrom(created);

        // A leaked database must not hand over live identities. The row holds a
        // SHA-256 of the key and nothing that can be replayed.
        Integer rowsHoldingTheKey = jdbc.queryForObject(
                "SELECT count(*) FROM users WHERE recognition_key_hash = ?", Integer.class, key);
        assertThat(rowsHoldingTheKey).isZero();

        String storedHash = jdbc.queryForObject(
                "SELECT recognition_key_hash FROM users WHERE id = ?",
                String.class,
                created.getBody().id());
        assertThat(storedHash).hasSize(64).matches("^[0-9a-f]+$");
    }

    /** The cookie value the backend just handed out, without its attributes. */
    private static String recognitionCookieFrom(ResponseEntity<?> response) {
        String setCookie = response.getHeaders().getFirst(HttpHeaders.SET_COOKIE);
        assertThat(setCookie).as("no cookie was set").isNotNull();
        return setCookie.substring(setCookie.indexOf('=') + 1, setCookie.indexOf(';'));
    }

    /**
     * TestRestTemplate keeps no cookie jar, so the round trip is made explicit —
     * which is the honest version anyway: the assertion is that a browser
     * presenting this value is recognised, not that some client library
     * remembered something.
     */
    private static HttpEntity<Void> withCookie(String recognitionKey) {
        HttpHeaders headers = new HttpHeaders();
        headers.put(HttpHeaders.COOKIE, List.of(RecognitionCookie.NAME + "=" + recognitionKey));
        return new HttpEntity<>(headers);
    }
}
