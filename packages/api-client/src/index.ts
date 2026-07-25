import createClient from "openapi-fetch";
import type { paths } from "./schema.js";

export type { paths, components } from "./schema.js";

/** The health payload, named so callers do not restate the generated path type. */
export type Health = paths["/api/health"]["get"]["responses"][200]["content"]["application/json"];

/** Anyone who has played, Claimed or otherwise. One shape for both states (ADR-0007). */
export type User = paths["/api/users/me"]["get"]["responses"][200]["content"]["application/json"];

/**
 * The origin the application is being served from.
 *
 * Read off the page rather than configured. There is no environment variable
 * holding an API host and nothing to point at a different one, because there is
 * no second origin: Caddy serves the built SPA and proxies `/api/*` to Spring
 * Boot behind a single hostname (ADR-0002). A configurable base URL here would
 * be the first step back toward CORS.
 *
 * It has to be absolute rather than a bare `/`: `fetch` in Node — which is what
 * the frontend tests run on — rejects a relative URL outright, so a
 * path-relative client would work in a browser and fail everywhere else.
 */
function currentOrigin(): string {
  return globalThis.location?.origin ?? "http://localhost";
}

/**
 * Resolves `globalThis.fetch` per call rather than capturing it.
 *
 * `createClient` reads `globalThis.fetch` once, at construction. Clients are
 * normally built at module scope, which is evaluated on import — before a test
 * harness has installed its interceptor. The captured reference is then the
 * real `fetch`, and requests escape to the network no matter what the test
 * thought it had stubbed. Delegating on every call keeps the indirection.
 */
const lazyFetch: typeof globalThis.fetch = (...args) => globalThis.fetch(...args);

export function createApiClient() {
  return createClient<paths>({
    baseUrl: currentOrigin(),
    fetch: lazyFetch,
  });
}

export type ApiClient = ReturnType<typeof createApiClient>;
