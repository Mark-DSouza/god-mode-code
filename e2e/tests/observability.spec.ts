import { expect, test } from "@playwright/test";

/**
 * What the proxy exposes, and what it must not.
 *
 * These assertions only mean something here. The backend's own tests can prove
 * that Spring maps `/actuator` outside `/api`, but whether the internet can
 * reach it is decided by Caddy, and Caddy is only in the picture at this seam
 * (ADR-0002).
 */

test("the metrics endpoint is not reachable from the internet", async ({ request }) => {
  // Nothing routes `/actuator` to the backend, so this falls through to the
  // single-page application's catch-all and serves index.html. That is fine —
  // what matters is that it is not exposition. A public scrape endpoint hands
  // over the shape of the traffic, the endpoints that exist, and the version
  // running, for free.
  const response = await request.get("/actuator/prometheus");
  const body = await response.text();

  expect(body).not.toContain("# TYPE");
  expect(body).not.toContain("jvm_memory_used_bytes");
  expect(body).not.toContain("http_server_requests_seconds");
});

test("the health endpoint answers with a correlation id a bug report can quote", async ({
  request,
}) => {
  const response = await request.get("/api/health");

  // Lower-cased by Playwright, as HTTP header names are case-insensitive.
  const correlationId = response.headers()["x-correlation-id"];
  expect(correlationId).toBeTruthy();

  const second = await request.get("/api/health");
  expect(second.headers()["x-correlation-id"]).not.toBe(correlationId);
});

test("an identifier supplied by the edge is the one that comes back", async ({ request }) => {
  // Cloudflare stamps every request it forwards. Adopting that value rather
  // than minting a second one is what lets the edge's record and ours name the
  // same request — which matters exactly when the question is whether a failure
  // happened before or after the tunnel.
  const rayId = "e2e00000000dead1-BOM";

  const response = await request.get("/api/health", { headers: { "Cf-Ray": rayId } });

  expect(response.headers()["x-correlation-id"]).toBe(rayId);
});
