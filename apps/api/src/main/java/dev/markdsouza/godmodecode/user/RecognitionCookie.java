package dev.markdsouza.godmodecode.user;

import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

/**
 * How the Recognition Key gets to the browser and back.
 *
 * A cookie rather than local storage, for two reasons. It is sent automatically
 * on every request to the one origin the whole application lives at (ADR-0002),
 * so nothing has to remember to attach it; and {@code HttpOnly} keeps it out of
 * reach of any script, which local storage cannot do at all — one injected
 * script there is every visitor's identity, permanently.
 */
@Component
public class RecognitionCookie {

    public static final String NAME = "gmc_user";

    /**
     * A year and a bit. The value has to outlive a browser restart, which is what
     * separates it from a session cookie — those are discarded when the browser
     * closes, and an identity that evaporates overnight is not an identity.
     *
     * 400 days rather than "forever": Chrome caps cookie lifetime at 400 days and
     * silently truncates anything longer, so asking for more would only make the
     * code disagree with the browser.
     */
    private static final Duration LIFETIME = Duration.ofDays(400);

    private final boolean secure;

    RecognitionCookie(@Value("${gmc.identity.cookie-secure:true}") boolean secure) {
        this.secure = secure;
    }

    public ResponseCookie carrying(String recognitionKey) {
        return ResponseCookie.from(NAME, recognitionKey)
                // No script needs to read this, and every script that could is a
                // script that could steal it.
                .httpOnly(true)
                .secure(secure)
                // There is exactly one origin, so nothing legitimate sends this
                // cross-site. Lax rather than Strict only so that arriving from
                // an external link still recognises the visitor.
                .sameSite("Lax")
                .path("/")
                .maxAge(LIFETIME)
                .build();
    }
}
