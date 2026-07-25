# GOD_MODE_CODE

A speed-typing site with three Disciplines. **Quotes** and **Prose** measure how
fast you transcribe a Passage. **Code** presents a Pattern — one algorithmic
technique distilled to a few lines — and judges your submission by executing
hidden tests. Anyone can play immediately, without an account.

The vocabulary is defined in [`CONTEXT.md`](./CONTEXT.md); the decisions behind
the architecture are in [`docs/adr/`](./docs/adr/).

> **Status: walking skeleton.** The full path works end to end — a browser loads
> the built SPA, calls the backend on one origin, and the backend answers from a
> migrated PostgreSQL — but no part of the product is built yet. There are no
> Disciplines, no Runs and no Leaderboards.

## Running it

### From a clean clone, with nothing installed but Docker

```sh
docker compose -f compose.e2e.yaml up --build
```

Then open <http://localhost:8000>. This builds and runs the whole stack —
database, backend, judge, and the proxy serving the built frontend. No Node, JDK
or Go toolchain required.

### For development

```sh
pnpm install
pnpm dev
```

Then open <http://localhost:5173>.

The database runs in a container; the applications run natively, so debuggers
attach normally and hot reload is not fighting a bind mount. The backend's
debugger listens on port 5005. Vite proxies `/api` to it, so local development
has the same single-origin shape as production.

Requires Docker, Node 24+, pnpm, a JDK 21+, and — optionally — Go 1.26+. Without
Go the judge is skipped, which nothing yet depends on.

## Layout

| Path                         | What it is                                                             |
| ---------------------------- | ---------------------------------------------------------------------- |
| `apps/web`                   | React + TypeScript SPA, built by Vite, styled with Tailwind v4         |
| `apps/api`                   | Spring Boot backend; Flyway migrations run on startup                  |
| `apps/judge`                 | Go service that will execute untrusted submissions in containers       |
| `packages/design-tokens`     | The design system's tokens, plus the ADR-0010 accessibility deviations |
| `packages/api-client`        | Generated OpenAPI document and the typed client built from it          |
| `infra/`                     | Infrastructure definitions — currently the reverse proxy               |
| `e2e/`                       | Playwright suite, driven against the containerised stack               |
| `mockups-and-design-system/` | The shipped design system and UI mockups, treated as source of truth   |

## One origin, no CORS

`godmodecode.markdsouza.dev` serves everything. Caddy serves the built SPA and
reverse-proxies `/api/*` to Spring Boot behind a single hostname, so the
application never makes a cross-origin request — no preflight on every API call,
no origin allowlist, and no class of bug that only appears in production. This
was forced by a certificate constraint and turned out to be better anyway
(ADR-0002).

Nothing in this repository should introduce a second origin for the API. An
end-to-end test asserts that every request the page makes is same-origin, with
one documented exemption: the design system's font tokens `@import` Google
Fonts, so `googleapis.com` and `gstatic.com` are allowed. Any other origin fails
the build.

The one place a host is configurable is Vite's dev proxy (`API_ORIGIN`), which
exists so the dev server can forward `/api` to a backend on another port. It has
no production equivalent — Caddy's upstream is fixed — and it still leaves the
browser talking to a single origin.

## The API contract

The backend owns the contract. `packages/api-client/openapi.json` is generated
from it, and `src/schema.d.ts` is generated from that. Both are committed.

```sh
./scripts/generate-contract.sh   # regenerate both after changing an endpoint
```

CI regenerates and fails on any difference. The failure this prevents is a
response shape changing while the frontend keeps compiling against the old
types — both sides internally consistent, and only the contract showing the
mismatch.

## Testing

Four seams, each exercising a real boundary:

| Seam         | What is real                                                         | Run it            |
| ------------ | -------------------------------------------------------------------- | ----------------- |
| **backend**  | HTTP over a socket, against PostgreSQL in a container                | `pnpm api:test`   |
| **judge**    | HTTP over a socket, against the real router                          | `pnpm judge:test` |
| **frontend** | the rendered application, with HTTP intercepted at the network layer | `pnpm test:web`   |
| **e2e**      | a browser against the containerised stack — nothing stubbed          | `pnpm test:e2e`   |

The frontend seam intercepts requests rather than stubbing the client, so URLs,
methods, status codes and JSON bodies are all under test. Its mock payloads are
typed from the generated client, so a backend change that alters a response
shape fails to compile rather than producing a mock that no longer resembles the
real thing.

```sh
pnpm typecheck && pnpm test   # everything JavaScript/TypeScript
```

## Accessibility

The design system is authoritative except in four places, all accessibility
fixes, all recorded in [ADR-0010](./docs/adr/0010-accessibility-deviations-from-the-design-system.md).
Two are implemented here:

- **`--ink-3` is raised** from `#1C6531` to `#2A8642`. It colours untyped glyphs
  on the typing surface — text a player reads under time pressure — and the
  shipped value measures ~3.0:1 against the void, failing WCAG AA. The new value
  is verified by a real contrast checker in `packages/design-tokens`, which also
  asserts the old one fails, so the deviation cannot be "corrected" back
  unnoticed.
- **The digital rain defaults off** when the operating system requests reduced
  motion. It animates continuously behind every screen and intensifies with WPM.
  An explicit choice in Settings still wins.

The other two — the visually hidden focused input behind the typing surface, and
the non-colour indicator on wrong glyphs — belong to the Run screen and land
with it.
