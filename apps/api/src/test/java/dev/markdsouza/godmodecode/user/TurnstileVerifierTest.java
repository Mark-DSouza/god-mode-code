package dev.markdsouza.godmodecode.user;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

/**
 * Whether the widget's token is believed, against a faked siteverify endpoint
 * rather than Cloudflare's real one — the HTTP boundary this reaches is
 * theirs, not ours, and nothing here should depend on it being reachable.
 */
class TurnstileVerifierTest {

    @Test
    @DisplayName("with no secret key configured, everything is waved through")
    void unconfiguredWavesEverythingThrough() {
        TurnstileVerifier verifier = new TurnstileVerifier(RestClient.builder(), "");

        assertThat(verifier.configured()).isFalse();
        assertThat(verifier.verify(null, "203.0.113.1")).isTrue();
        assertThat(verifier.verify("", "203.0.113.1")).isTrue();
    }

    @Test
    @DisplayName("configured, but no token was sent, is refused without ever asking Cloudflare")
    void configuredButNoTokenIsRefused() {
        TurnstileVerifier verifier = new TurnstileVerifier(RestClient.builder(), "a-secret");

        assertThat(verifier.configured()).isTrue();
        assertThat(verifier.verify(null, "203.0.113.1")).isFalse();
        assertThat(verifier.verify("   ", "203.0.113.1")).isFalse();
    }

    @Test
    @DisplayName("a token siteverify accepts is trusted")
    void anAcceptedTokenIsTrusted() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        server.expect(requestTo("https://challenges.cloudflare.com/turnstile/v0/siteverify"))
                .andRespond(withSuccess("{\"success\":true}", MediaType.APPLICATION_JSON));

        TurnstileVerifier verifier = new TurnstileVerifier(builder, "a-secret");

        assertThat(verifier.verify("a-real-token", "203.0.113.1")).isTrue();
        server.verify();
    }

    @Test
    @DisplayName("a token siteverify rejects is refused")
    void aRejectedTokenIsRefused() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        server.expect(requestTo("https://challenges.cloudflare.com/turnstile/v0/siteverify"))
                .andRespond(withSuccess("{\"success\":false}", MediaType.APPLICATION_JSON));

        TurnstileVerifier verifier = new TurnstileVerifier(builder, "a-secret");

        assertThat(verifier.verify("a-forged-token", "203.0.113.1")).isFalse();
    }

    @Test
    @DisplayName("Cloudflare being unreachable refuses rather than waves through")
    void anUnreachableSiteverifyIsRefused() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        server.expect(requestTo("https://challenges.cloudflare.com/turnstile/v0/siteverify"))
                .andRespond(withServerError());

        TurnstileVerifier verifier = new TurnstileVerifier(builder, "a-secret");

        assertThat(verifier.verify("a-real-token", "203.0.113.1")).isFalse();
    }
}
