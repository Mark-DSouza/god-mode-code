import { expect, test } from "@playwright/test";

/**
 * The end-to-end seam. Everything here is real: a browser, the built bundle,
 * Caddy, Spring Boot, PostgreSQL.
 */

test("the application loads and reports the backend online", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /system online/i })).toBeVisible();

  // The badge, not the heading: this is the value that only appears once the
  // browser has actually reached the backend through the proxy.
  await expect(page.getByRole("status")).toHaveText(/online/i, { timeout: 15_000 });
  await expect(page.getByText("e2e")).toBeVisible();
});

test("every request the page makes is same-origin", async ({ page }) => {
  // Collected before navigation, because the document request itself counts.
  // The origin cannot be read from the page yet — it is still about:blank — so
  // requests are recorded now and classified once the real origin is known.
  const requested: string[] = [];
  page.on("request", (request) => requested.push(request.url()));

  await page.goto("/");
  await expect(page.getByRole("status")).toHaveText(/online/i, { timeout: 15_000 });

  const pageOrigin = new URL(page.url()).origin;
  const foreignOrigins = requested.filter((href) => {
    const url = new URL(href);
    if (!url.protocol.startsWith("http")) return false;
    return url.origin !== pageOrigin;
  });

  // Exactly one origin, with no exemptions. This assertion used to allow Google
  // Fonts, because the design system's font tokens `@import` them; those three
  // families are now self-hosted, so there is no third party left to allow and
  // any origin appearing here means CORS has been reintroduced (ADR-0002).
  expect(foreignOrigins).toEqual([]);

  // Guards the guard: if nothing was recorded, the assertion above passes
  // whatever the app does.
  expect(requested.some((href) => href.endsWith("/api/health"))).toBe(true);
});

test("the API is reachable through the proxy, not only from the app", async ({ request }) => {
  const response = await request.get("/api/health");

  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("application/json");
  expect(await response.json()).toMatchObject({
    status: "UP",
    database: "UP",
    version: "e2e",
  });
});

test("a judge that cannot judge degrades the Code Discipline and nothing else", async ({
  request,
}) => {
  // The judge in this stack has no container socket, on purpose — see the long
  // comment in compose.e2e.yaml — so it serves and refuses Solve Runs. That
  // makes this the real degraded case rather than a simulated one.
  const response = await request.get("/api/health");
  const health = await response.json();

  expect(health.judge).toBe("DEGRADED");

  // The assertion that matters, and the reason it is a status code rather than
  // a field: the external uptime monitor reads the code alone, so a 503 here
  // would page somebody because one Discipline is unavailable. Quotes, Prose,
  // Leaderboards and sign-in need no judge (ADR-0005).
  expect(response.status()).toBe(200);
  expect(health.status).toBe("UP");
  expect(health.database).toBe("UP");
});

test("unknown paths serve the application, so client-side routing works", async ({ page }) => {
  // A hard load of a route the server has no file for must return index.html
  // rather than 404 — otherwise every deep link breaks on refresh.
  const response = await page.goto("/leaderboard/quotes");

  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: /system online/i })).toBeVisible();
});

test("the digital rain renders behind the application", async ({ page }) => {
  await page.goto("/");

  const rain = page.locator("[data-testid='digital-rain']");
  await expect(rain).toBeAttached();
  // Decorative, and must stay out of the accessibility tree.
  await expect(rain).toHaveAttribute("aria-hidden", "true");
});

test("the rain is off by default when the browser asks for reduced motion", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();

  await page.goto("/");
  await expect(page.getByRole("heading", { name: /system online/i })).toBeVisible();

  // ADR-0010. Verified against a real browser's media query rather than a
  // mocked matchMedia, which is the version that can actually be wrong.
  await expect(page.locator("[data-testid='digital-rain']")).toHaveCount(0);

  await context.close();
});
