package dev.markdsouza.godmodecode.observability;

import java.util.UUID;
import java.util.regex.Pattern;

/**
 * The identifier that ties a response somebody is holding to the log lines the
 * request produced.
 *
 * Cloudflare already stamps every request it forwards with a ray id, and
 * adopting it rather than minting a second identifier means the edge's record
 * and ours name the same request — which matters precisely when the question is
 * whether a failure happened before or after the tunnel.
 */
final class CorrelationId {

    /** Returned on every response, so a bug report can carry one. */
    static final String HEADER = "X-Correlation-Id";

    /** What Cloudflare stamps on requests it forwards (ADR-0002). */
    static final String CLOUDFLARE_HEADER = "Cf-Ray";

    /** The key log lines carry it under. */
    static final String MDC_KEY = "correlationId";

    /** Long enough for a ray id and a generated one, short enough to read. */
    static final int MAX_LENGTH = 64;

    /**
     * Deliberately narrow. The supplied value is attacker-controlled and ends
     * up in a log file: a newline in it appends a line of the sender's own
     * invention, which is how an audit trail becomes fiction. Structured output
     * escapes it, but the human-readable console format does not, and which
     * format is in use is a setting rather than a guarantee.
     */
    private static final Pattern SAFE = Pattern.compile("[A-Za-z0-9_-]{1," + MAX_LENGTH + "}");

    private CorrelationId() {}

    /**
     * The id for a request, given whatever the edge supplied.
     *
     * Anything unusable is replaced rather than rejected: refusing the request
     * would turn a malformed header into an outage, and the id is a debugging
     * aid, not an authorisation decision.
     */
    static String from(String supplied) {
        if (supplied != null && SAFE.matcher(supplied).matches()) {
            return supplied;
        }
        return UUID.randomUUID().toString().replace("-", "");
    }
}
