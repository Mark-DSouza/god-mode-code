import { type Locator, type Page, expect, test } from "@playwright/test";

/**
 * The tracer bullet, through everything at once: a real browser typing a real
 * Passage, issued by Spring Boot out of PostgreSQL, verified by the same server
 * and rendered back as a result.
 *
 * The component and HTTP seams cover the parts in isolation and cover them
 * better — this is the one that would notice the Passage arriving with a
 * character the keyboard cannot produce, or the Issue never reaching the
 * database, or the metrics disagreeing across the wire.
 */

/**
 * Fifty milliseconds a character, which works out at a steady 240 words per
 * minute whatever the Passage's length — fast, and comfortably under the speed
 * past which the server stops believing anybody. Typing at Playwright's default
 * of no delay at all produces several thousand words per minute and is refused,
 * correctly.
 */
const HUMANLY_FAST = 50;

test("a Passage is issued, typed, and verified by the server", async ({ page }) => {
  // Up to a few hundred characters at 50ms each, plus a three-second countdown.
  test.setTimeout(90_000);

  await page.goto("/");

  await page.getByRole("button", { name: /^quotes/i }).click();
  await page.getByRole("button", { name: /start run/i }).click();

  // The countdown runs first. The Passage is already on the page for a screen
  // reader, which is also where a test can read exactly what to type.
  await expect(page.getByTestId("countdown")).toBeVisible();
  await expect(page.getByTestId("typing-input")).toBeVisible({ timeout: 15_000 });

  const passage = await page.locator("#passage-text").textContent();
  expect(passage).toBeTruthy();
  // Every character has to be one this keyboard can produce, or the Run can
  // never reach its final character and the test hangs rather than fails.
  expect(passage).toMatch(/^[ -~]+$/);

  await page.keyboard.type(passage ?? "", { delay: HUMANLY_FAST });

  // No submit button was pressed: the Run ends on the final character, and the
  // result that appears is the server's arithmetic, not the browser's.
  const result = page.getByRole("region", { name: /run result/i });
  await expect(result).toBeVisible({ timeout: 15_000 });

  await expect(statIn(result, page, "Accuracy")).toContainText("100");
  await expect(statIn(result, page, "Errors")).toContainText("0");

  const speed = Number((await statIn(result, page, "Speed").innerText()).replace(/\D+/g, ""));
  // Not a fixture: this is what the server measured of a browser genuinely
  // typing at 240 words per minute, so it is asserted as a band rather than a
  // number. Zero would mean the duration never crossed the wire.
  expect(speed).toBeGreaterThan(100);
  expect(speed).toBeLessThan(300);
});

test.describe("pasting", () => {
  // Writing to the clipboard is a privileged action, and Chromium refuses it by
  // default — which would fail this test for the wrong reason.
  test.use({ permissions: ["clipboard-read", "clipboard-write"] });

  test("a Passage cannot be pasted", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /^prose/i }).click();
    await page.getByRole("button", { name: /start run/i }).click();
    await expect(page.getByTestId("typing-input")).toBeVisible({ timeout: 15_000 });

    const passage = (await page.locator("#passage-text").textContent()) ?? "";
    await page.evaluate((text) => navigator.clipboard.writeText(text), passage);
    await page.keyboard.press("ControlOrMeta+V");

    // The paste is seen and stopped because the keystrokes go to a real form
    // control (ADR-0010). A focusable `<div>`, which is what the shipped design
    // system uses, raises no paste event at all — the Passage would simply
    // appear, fully typed, in no time.
    await expect(page.getByTestId("typing-input")).toHaveValue("");
  });
});

/** One CRT readout, found by the label underneath it. */
function statIn(result: Locator, page: Page, label: string): Locator {
  return result.locator(`div:has(> span:text-is("${label}"))`);
}
