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
 * script there is every visitor's Recognition Key, permanently.
 */
@Component
public class RecognitionCookie {

    /**
     * Named for what it carries — a Recognition Key — and deliberately not for
     * the User.
     *
     * This value is emphatically not the User's id, and a cookie named after the
     * identifier it is not invites exactly the substitution the design exists to
     * prevent. The name reaches the wire and the generated client, so it is the
     * copy of the vocabulary hardest to correct later.
     */
    public static final String NAME = "gmc_recognition";

    /**
     * A year and a bit. The value has to outlive a browser restart, which is what
     * separates it from a session cookie — those are discarded when the browser
     * closes, and a User who evaporates overnight is not a User.
     *
     * 400 days rather than "forever": Chrome caps cookie lifetime at 400 days and
     * silently truncates anything longer, so asking for more would only make the
     * code disagree with the browser.
     */
    private static final Duration LIFETIME = Duration.ofDays(400);

    private final boolean secure;

    RecognitionCookie(@Value("${gmc.cookie-secure:true}") boolean secure) {
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
