import { describe, expect, it } from "vitest";
import { turnstileConfigured, turnstileToken } from "./turnstile.ts";

/**
 * The only path every environment this suite runs in actually takes: no
 * Turnstile site is configured in local development, CI, or this test run,
 * the same as `auth/cognito.ts` and its Cognito pool.
 */
describe("Turnstile, unconfigured", () => {
  it("reports itself as unconfigured", () => {
    expect(turnstileConfigured()).toBe(false);
  });

  it("resolves to no token, without touching the DOM or the network", async () => {
    await expect(turnstileToken()).resolves.toBeUndefined();
    expect(document.querySelector("script[src*=turnstile]")).toBeNull();
  });
});
