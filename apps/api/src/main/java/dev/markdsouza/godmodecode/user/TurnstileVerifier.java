package dev.markdsouza.godmodecode.user;

import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/**
 * Whether a widget vouches for the browser asking to become a User.
 *
 * A blank secret key means no Turnstile site is provisioned for this
 * environment — every local and CI run, until one is — and {@link #verify}
 * simply waves everything through, the same posture {@code SecurityConfig}
 * takes toward a blank Cognito issuer (ADR-0011). Where a site is
 * provisioned, a token that does not check out — missing, wrong, or
 * Cloudflare unreachable — is refused rather than let through: the whole
 * point of the widget is that identity creation is guarded, and treating an
 * unreachable verifier as a pass would make an outage indistinguishable from
 * having no guard at all.
 */
@Component
class TurnstileVerifier {

    private static final Logger log = LoggerFactory.getLogger(TurnstileVerifier.class);

    private static final URI SITEVERIFY = URI.create("https://challenges.cloudflare.com/turnstile/v0/siteverify");

    private record SiteverifyResponse(boolean success) {}

    private final RestClient http;
    private final String secretKey;

    TurnstileVerifier(RestClient.Builder builder, @Value("${gmc.turnstile.secret-key:}") String secretKey) {
        this.http = builder.build();
        this.secretKey = secretKey;
    }

    /** Whether this environment has a Turnstile site configured at all. */
    boolean configured() {
        return !secretKey.isBlank();
    }

    /** Whether {@code token} — the widget's answer, from this {@code remoteAddress} — checks out. */
    boolean verify(String token, String remoteAddress) {
        if (!configured()) {
            return true;
        }
        if (token == null || token.isBlank()) {
            return false;
        }

        String body = "secret=%s&response=%s&remoteip=%s"
                .formatted(encode(secretKey), encode(token), encode(remoteAddress));
        try {
            SiteverifyResponse response = http.post()
                    .uri(SITEVERIFY)
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .body(body)
                    .retrieve()
                    .body(SiteverifyResponse.class);
            return response != null && response.success();
        } catch (RestClientException e) {
            log.warn("Could not reach Turnstile's siteverify endpoint", e);
            return false;
        }
    }

    private static String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }
}
