# Static SPA, no server-side rendering

The frontend is a Vite + React + TypeScript bundle of static files. No Next.js,
no React Router framework mode, no SSR of any kind.

The decisive reason is not the usual SEO argument — it is that the backend is a
JVM. Any SSR framework would introduce Node as a _second_ runtime on a 2GB
instance: another container, another deploy, another thing to monitor, in order
to server-render screens (auth, run, result, profile, settings) that are all
either private or purely interactive.

Tailwind v4 consumes the existing design-system tokens through `@theme inline`
rather than defining a competing scale, so there remains a single source of truth
for colour, type, and spacing.

## Everything is served from one origin

`godmodecode.markdsouza.dev` serves the whole application. Caddy on the api
instance serves the built SPA and reverse-proxies `/api/*` to Spring Boot;
Cloudflare Tunnel exposes that single hostname. There is no S3 bucket and no
separate API subdomain.

This was forced by a certificate constraint and then turned out to be better
anyway. Cloudflare's free Universal SSL covers the apex and **first-level**
subdomains only, so `api.godmodecode.markdsouza.dev` — two levels deep — would
have required Advanced Certificate Manager at $10/month, a 30% increase in
running costs caused entirely by a naming choice.

The alternative was a hyphenated first-level subdomain, which is free but keeps
two origins. Collapsing to one instead means **no CORS**: no preflight round-trip
on every API call, no origin allowlists to maintain, and no class of bug that
only appears in production. It also removes S3 and its bucket policy from the
architecture.

## Consequences

Static assets originate from EC2 rather than object storage. With hashed
filenames and long `Cache-Control` they are served from Cloudflare's edge, so
origin hits are rare and the egress is negligible — but the frontend is no longer
_structurally_ incapable of generating cost, as it was on S3. Caddy remains up
during the Spring Boot restart described in ADR-0009, so a deploy degrades the
API rather than taking the whole site down.
