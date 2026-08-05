import { HttpResponse, http } from "msw";
import { afterEach, describe, expect, it } from "vitest";
import { createApiClient } from "@gmc/api-client";
import { server } from "../test/msw-server.ts";

/**
 * The CSRF half of the double-submit pattern `SecurityConfig` (backend)
 * expects: a state-changing request echoes back whatever the `XSRF-TOKEN`
 * cookie holds, as a header. Driven through a real client and intercepted at
 * the network layer, same as every other suite here — this is what actually
 * leaves the browser, not what a helper function returns in isolation.
 */
describe("the CSRF token cookie is echoed back as a header", () => {
  afterEach(() => {
    document.cookie = "XSRF-TOKEN=; Max-Age=0";
  });

  it("is attached to a state-changing request once the cookie is set", async () => {
    document.cookie = "XSRF-TOKEN=test-csrf-token";
    let receivedHeader: string | null = null;
    server.use(
      http.post("/api/users", ({ request }) => {
        receivedHeader = request.headers.get("X-XSRF-TOKEN");
        return HttpResponse.json(
          { id: "00000000-0000-4000-8000-000000000099", handle: "SOMEBODY", claimed: false },
          { status: 201 },
        );
      }),
    );

    await createApiClient().POST("/api/users");

    expect(receivedHeader).toBe("test-csrf-token");
  });

  it("is not attached to a read, which never needs one", async () => {
    document.cookie = "XSRF-TOKEN=test-csrf-token";
    let receivedHeader: string | null = "unset";
    server.use(
      http.get("/api/users/me", ({ request }) => {
        receivedHeader = request.headers.get("X-XSRF-TOKEN");
        return new HttpResponse(null, { status: 404 });
      }),
    );

    await createApiClient().GET("/api/users/me");

    expect(receivedHeader).toBeNull();
  });

  it("is simply absent when no cookie has been issued yet", async () => {
    let receivedHeader: string | null = "unset";
    server.use(
      http.post("/api/users", ({ request }) => {
        receivedHeader = request.headers.get("X-XSRF-TOKEN");
        return HttpResponse.json(
          { id: "00000000-0000-4000-8000-000000000098", handle: "NOBODY_YET", claimed: false },
          { status: 201 },
        );
      }),
    );

    await createApiClient().POST("/api/users");

    expect(receivedHeader).toBeNull();
  });
});
