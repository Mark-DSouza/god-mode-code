package dev.markdsouza.godmodecode.ratelimit;

import jakarta.servlet.http.HttpServletRequest;

/**
 * The address a request actually came from, for rate limiting by source
 * address.
 *
 * Traffic reaches this application as Cloudflare Tunnel → {@code cloudflared}
 * → Caddy (over loopback) → here, and {@link HttpServletRequest#getRemoteAddr()}
 * at the end of that chain names Caddy, not the visitor. Cloudflare's edge
 * stamps {@code CF-Connecting-IP} on every request before any of those hops,
 * and nothing between the edge and here strips or rewrites it, so it is read
 * first. Local development and the containerised end-to-end stack have no
 * Cloudflare in front of them at all, so {@code getRemoteAddr()} is the
 * honest answer there — and is exactly what a forged header would otherwise
 * let a caller override, which is why it is the fallback rather than the
 * primary source.
 */
public final class ClientAddress {

    private static final String CLOUDFLARE_HEADER = "CF-Connecting-IP";

    private ClientAddress() {}

    public static String of(HttpServletRequest request) {
        String fromEdge = request.getHeader(CLOUDFLARE_HEADER);
        return fromEdge != null && !fromEdge.isBlank() ? fromEdge : request.getRemoteAddr();
    }
}
