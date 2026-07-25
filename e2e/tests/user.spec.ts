import { expect, test } from "@playwright/test";

/**
 * The only seam where "survives a browser restart" is a claim about a browser
 * rather than about a header. Everything here is real: a Chromium profile, the
 * built bundle, Caddy, Spring Boot, PostgreSQL.
 */

const HANDLE = /^[A-Z]+ING_[A-Z]+(_\d+)?$/;

test("a visitor arrives and becomes someone, without being asked for anything", async ({
  page,
}) => {
  await page.goto("/");

  const handle = page.getByTestId("user-handle");
  await expect(handle).toHaveText(HANDLE, { timeout: 15_000 });
  await expect(page.getByTestId("user-avatar")).toBeVisible();

  // No form and no sign-in wall stood between arriving and having a Handle.
  await expect(page.getByRole("textbox")).toHaveCount(0);
});

test("the Handle survives a reload", async ({ page }) => {
  await page.goto("/");
  const first = await settledHandle(page);

  await page.reload();

  await expect(page.getByTestId("user-handle")).toHaveText(first, { timeout: 15_000 });
});

test("the Handle survives a browser restart", async ({ browser }) => {
  const before = await browser.newContext();
  const page = await before.newPage();
  await page.goto("/");
  const handle = await settledHandle(page);

  // A restart keeps persistent cookies and discards session ones. Playwright
  // reports a session cookie as `expires: -1`, so dropping those is a faithful
  // model of closing the browser — and the assertion that follows fails if the
  // backend ever stops setting Max-Age.
  const saved = await before.storageState();
  const survived = { ...saved, cookies: saved.cookies.filter((c) => c.expires > 0) };
  expect(survived.cookies.some((c) => c.name === "gmc_recognition")).toBe(true);
  await before.close();

  const after = await browser.newContext({ storageState: survived });
  const reopened = await after.newPage();
  await reopened.goto("/");

  await expect(reopened.getByTestId("user-handle")).toHaveText(handle, { timeout: 15_000 });
  await after.close();
});

test("a browser that has never been here becomes someone else", async ({ browser }) => {
  const [one, two] = await Promise.all([browser.newContext(), browser.newContext()]);

  const handles = await Promise.all(
    [one, two].map(async (context) => {
      const page = await context.newPage();
      await page.goto("/");
      return settledHandle(page);
    }),
  );

  // A User is remembered per browser, not derived from anything the two share —
  // an IP address, a user agent, the hour of the day.
  expect(handles[0]).not.toEqual(handles[1]);
  await Promise.all([one.close(), two.close()]);
});

test("the Recognition Key cookie is out of reach of any script", async ({ page, context }) => {
  await page.goto("/");
  await settledHandle(page);

  // The browser has it...
  const stored = await context.cookies();
  expect(stored.map((cookie) => cookie.name)).toContain("gmc_recognition");

  // ...and no script can read it. Asserting only the second half would pass on
  // a page that has no cookie at all.
  const visibleToScripts = await page.evaluate(() => document.cookie);
  expect(visibleToScripts).not.toContain("gmc_recognition");
});

/**
 * The longest Handle the generator can produce: an 11-character gerund, a
 * 6-character creature, and the largest collision suffix. 22 characters, which
 * is the budget HandleWords derives.
 */
const LONGEST_POSSIBLE = "PERCOLATING_FERRET_100";

for (const width of [320, 375, 479, 480, 640, 900]) {
  test(`the longest possible Handle fits the header at ${width}px`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width, height: 400 } });
    const page = await context.newPage();
    await page.goto("/");
    await settledHandle(page);

    // The Handle is swapped for the worst case rather than waited for: forcing
    // the generator to draw PERCOLATING_FERRET is a one-in-twelve-thousand
    // event, and what is under test is the layout, not the draw.
    const measured = await page.evaluate((text) => {
      const el = document.querySelector("[data-testid=user-handle]") as HTMLElement;
      el.textContent = text;
      return {
        pageOverflows: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        handleTruncated: el.scrollWidth > el.clientWidth,
      };
    }, LONGEST_POSSIBLE);

    // The length budget in HandleWords is arithmetic against a Leaderboard row
    // that does not exist yet. This is the part of it that does render, held to
    // the claim in a real browser: at the narrowest supported width the longest
    // Handle neither pushes the page sideways nor gets cut off.
    expect(measured.pageOverflows).toBe(false);
    expect(measured.handleTruncated).toBe(false);

    await context.close();
  });
}

/**
 * The Handle once it has actually arrived.
 *
 * Reading `textContent()` straight after `goto` returns the empty placeholder —
 * the header reserves the space before the request lands — so the wait has to
 * come first or every comparison below is between two empty strings.
 */
async function settledHandle(page: import("@playwright/test").Page): Promise<string> {
  const handle = page.getByTestId("user-handle");
  await expect(handle).toHaveText(HANDLE, { timeout: 15_000 });
  return (await handle.textContent()) ?? "";
}
