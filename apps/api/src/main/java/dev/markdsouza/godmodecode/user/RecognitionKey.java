package dev.markdsouza.godmodecode.user;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;

/**
 * The opaque secret a browser holds so the same User is recognised on the next
 * visit.
 *
 * Not a credential in the ADR-0011 sense — nobody signs in with it, it proves
 * nothing about who anybody is, and a User holding one is still Unclaimed. It is
 * the thing that makes an Unclaimed User's Runs theirs tomorrow instead of
 * belonging to nobody.
 *
 * Deliberately separate from the User's id. The id is published — it will key
 * every Leaderboard row — and an identifier that doubles as a bearer secret can
 * be replayed by anyone who reads the page.
 */
final class RecognitionKey {

    /**
     * 256 bits. The keyspace has to survive being guessed at by anyone who wants
     * someone else's Runs, and the cookie has no rate limit in front of it.
     */
    private static final int BYTES = 32;

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final Base64.Encoder ENCODER = Base64.getUrlEncoder().withoutPadding();

    private RecognitionKey() {}

    /** A new key, URL-safe so it survives a cookie value unescaped. */
    static String issue() {
        byte[] bytes = new byte[BYTES];
        RANDOM.nextBytes(bytes);
        return ENCODER.encodeToString(bytes);
    }

    /**
     * The hex SHA-256 of a key, which is what the database stores.
     *
     * Unsalted and uniterated on purpose: this is a 256-bit random value, not a
     * password, so there is no dictionary to attack and nothing for a work factor
     * to slow down. What the digest buys is that a leaked table does not hand
     * over live keys.
     */
    static String hash(String rawKey) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(rawKey.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            // SHA-256 is required of every JVM, so this is unreachable rather
            // than a case to handle.
            throw new IllegalStateException("SHA-256 is unavailable", e);
        }
    }
}
