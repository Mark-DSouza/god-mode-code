# Infrastructure

Everything the application runs on is declared here as code. That is what keeps
the hosting decision reversible — the whole stack should be rebuildable
elsewhere from these definitions rather than from somebody's memory of which
console checkboxes were ticked (ADR-0001).

## What is here now

| Path     | What it is                                                                  |
| -------- | --------------------------------------------------------------------------- |
| `caddy/` | The reverse proxy: serves the built SPA and proxies `/api/*` to the backend |

`caddy/Caddyfile` is used unchanged by the local end-to-end stack and by
production. The only difference between the two is the address it binds and the
upstream it proxies to, both of which come from the environment. A proxy config
that differs between local and production is a proxy config whose bugs are only
ever found in production.

## What is not here yet

The cloud account, the managed database, the instances, the tunnel, the
parameter store and the budget action all land with the first deploy. That work
is deliberately separate from the walking skeleton: the skeleton has to be
provably working locally before there is any point pointing a domain at it.

The judge's host is separate again, and its isolation is the whole point — its
own instance, no cloud credentials, no outbound route, reachable only from the
application (ADR-0005).

One rule worth stating before anything is built: **local development may mount
the container socket for convenience; production must never do so.** A mounted
container socket is the most direct escape path available to the untrusted code
the judge exists to contain.
