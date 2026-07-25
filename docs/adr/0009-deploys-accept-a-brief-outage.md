# Deploys accept a brief outage

There is one api instance, so deploying stops the running container and starts
the replacement, giving a 10–15 second window during which Cloudflare serves
errors. We accept that rather than building blue-green on a single host.

Blue-green would mean two Spring Boot containers alive simultaneously during the
swap. At `-Xmx512m` each lands around 700MB resident — 1.4GB of a 2GB instance —
alongside Caddy, `cloudflared`, and the operating system. That runs the box to
the edge of OOM **during every deploy**, which is precisely the moment a crash is
most expensive. It converts a predictable, harmless, self-inflicted outage into
an unpredictable one. A larger instance would fix the arithmetic at roughly
+$12/month, a 35% budget increase to remove a blip nobody is present to observe.

Mitigations that cost nothing: the deploy script pulls the new image _before_
stopping the old container, so the gap is a restart rather than a download; and
`server.shutdown=graceful` lets in-flight requests drain instead of being severed.

Revisit if the app ever acquires users who would notice.
