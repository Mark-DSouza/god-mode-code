import type { Health, User } from "@gmc/api-client";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";

/**
 * Interception happens at the network layer, not by swapping the client.
 *
 * A test that replaces `fetch` or stubs the API module proves the component
 * calls the stub. This intercepts the actual HTTP request, so the URL, the
 * method, the status code and the JSON body are all part of what is under
 * test — which is where the mismatches actually live.
 *
 * `Health` is imported from the generated client, so a backend change that
 * alters the response shape fails to compile here rather than producing a mock
 * that no longer resembles the real thing.
 */

export const healthUp: Health = {
  status: "UP",
  database: "UP",
  version: "0.0.1-test",
};

/**
 * A browser that has been here before, which is the uninteresting case and
 * therefore the right default: tests about anything other than identity should
 * not have to think about it, and no POST handler is registered, so a test that
 * unexpectedly creates a User fails on an unhandled request.
 */
export const returningUser: User = {
  id: "00000000-0000-4000-8000-000000000001",
  handle: "PERCOLATING_FERRET",
  claimed: false,
};

export const handlers = [
  http.get("/api/health", () => HttpResponse.json(healthUp)),
  http.get("/api/users/me", () => HttpResponse.json(returningUser)),
];

export const server = setupServer(...handlers);

/** A backend that answers, but reports a dependency down. */
export function respondDegraded() {
  server.use(
    http.get("/api/health", () =>
      HttpResponse.json<Health>(
        { status: "DEGRADED", database: "DEGRADED", version: "0.0.1-test" },
        { status: 503 },
      ),
    ),
  );
}

/** A backend that is not there at all — a different failure from a degraded one. */
export function respondUnreachable() {
  server.use(http.get("/api/health", () => HttpResponse.error()));
}
