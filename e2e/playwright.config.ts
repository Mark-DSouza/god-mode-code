import { defineConfig, devices } from "@playwright/test";

/**
 * The end-to-end harness drives a real browser against the real containerised
 * stack — the built SPA served by Caddy, calling Spring Boot on one origin,
 * against PostgreSQL. Nothing is stubbed. The frontend seam already covers
 * component behaviour with HTTP intercepted; what only this can catch is the
 * wiring between the pieces: proxy routes, asset paths, container networking.
 */

const PORT = process.env.WEB_PORT ?? "8000";
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

/** Set when the stack is already running, so `--wait` is not paid twice. */
const reuseExistingStack = Boolean(process.env.E2E_BASE_URL);

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  ...(reuseExistingStack
    ? {}
    : {
        webServer: {
          // `--wait` blocks on the healthchecks, which include a request
          // through the proxy to the backend — so by the time a test runs, the
          // single origin is known to work.
          command: "docker compose -f ../compose.e2e.yaml up -d --build --wait",
          url: `${BASE_URL}/api/health`,
          reuseExistingServer: !process.env.CI,
          // Cold builds compile a JVM application and a Go binary.
          timeout: 10 * 60 * 1000,
          stdout: "pipe",
          stderr: "pipe",
        },
      }),
});
