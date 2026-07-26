import { type Page, expect, test } from "@playwright/test";
import {
  FIXED_TIME,
  HANDLE,
  PARTIALLY_TYPED,
  PASSAGE_TEXT,
  TYPING_ELAPSED_MILLIS,
  breakFurtherChallenges,
  stubBackend,
  type BackendOptions,
} from "../fixtures/backend.ts";
import { settled } from "../fixtures/settle.ts";

/**
 * Every screen the product has, at both widths the design specifies.
 *
 * This is the seam the walking skeleton's three defects would have been caught
 * by. All of them were compositions — the rain inheriting a level no frame in
 * the design uses, a status panel wearing the ring that means "selected", a
 * numeral readout printing a word — and a composition is only wrong when you
 * look at it.
 *
 * The countdown, the clock and the rain are all frozen before the shutter
 * opens; see `stubBackend` and `settled` for how and why.
 */

/** Long enough for the three one-second countdown steps and the render after them. */
const COUNTDOWN_MILLIS = 3_500;

/**
 * Opens the home screen with the backend answering and the clock stopped.
 *
 * The clock is installed before navigation because the application reads it
 * during its first render — the Challenge's expiry is compared against `now` as
 * soon as a Run starts, and a real `Date.now()` would make that comparison
 * different on every run.
 */
async function openHome(page: Page, options: BackendOptions = {}): Promise<void> {
  await page.clock.install({ time: FIXED_TIME });
  await stubBackend(page, options);

  await page.goto("/");

  await expect(page.getByRole("heading", { name: /how fast can you type/i })).toBeVisible();
  // Both of these arrive over the network and both change the layout when they
  // land. Photographing before them catches an empty header and a pending pill.
  await expect(page.getByTestId("user-handle")).toHaveText(HANDLE);
  await expect(page.getByRole("status").first()).toHaveText(
    options.judgeDegraded ? /degraded/i : /online/i,
  );
}

/** Starts a Run and lets the countdown finish, leaving the typing surface live. */
async function startRun(page: Page): Promise<void> {
  await page.getByRole("button", { name: /start run/i }).click();
  await expect(page.getByTestId("countdown")).toBeVisible();
  await page.clock.runFor(COUNTDOWN_MILLIS);
  await expect(page.getByTestId("typing-field")).toBeVisible();
}

test("the home screen", async ({ page }) => {
  await openHome(page);
  await settled(page);

  await expect(page).toHaveScreenshot("home.png");
});

test("the home screen when the backend will not deal a Passage", async ({ page }) => {
  await openHome(page, { challengeFails: true });

  await page.getByRole("button", { name: /start run/i }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await settled(page);

  await expect(page).toHaveScreenshot("home-request-failed.png");
});

test("the Run screen during the countdown", async ({ page }) => {
  await openHome(page);

  await page.getByRole("button", { name: /start run/i }).click();
  // Photographed at three, before any tick. The mockup clears the screen for
  // this — no readouts, no progress track — so what is *absent* here is as much
  // of the design as what is present.
  await expect(page.getByTestId("countdown")).toBeVisible();
  await settled(page);

  await expect(page).toHaveScreenshot("run-countdown.png");
});

test("the Run screen mid-Passage", async ({ page }) => {
  await openHome(page);
  await startRun(page);

  // One `fill` rather than keystrokes: the engine takes the input's whole value
  // and works out the rest, so this is the same state a player would be in and
  // it arrives at one exact moment on the frozen clock.
  await page.getByTestId("typing-input").fill(PARTIALLY_TYPED);
  // Nothing has elapsed yet — the clock starts on the first keystroke and it is
  // still that instant. Advancing it is what puts real numbers in the readouts.
  await page.clock.runFor(TYPING_ELAPSED_MILLIS);
  await expect(page.getByRole("status")).toContainText(/keep going/i);
  await settled(page);

  await expect(page).toHaveScreenshot("run-typing.png");
});

test("the result screen", async ({ page }) => {
  await openHome(page);
  await startRun(page);

  // The Run ends on the final character; there is no button to press. What
  // appears is the server's arithmetic, which the fixture pins.
  await page.getByTestId("typing-input").fill(PASSAGE_TEXT);
  await expect(page.getByRole("region", { name: /run result/i })).toBeVisible();
  await settled(page);

  await expect(page).toHaveScreenshot("result.png");
});

test("the result screen when the backend will not deal another Passage", async ({ page }) => {
  await openHome(page);
  await startRun(page);

  await page.getByTestId("typing-input").fill(PASSAGE_TEXT);
  await expect(page.getByRole("region", { name: /run result/i })).toBeVisible();

  // Broken only now: the Run had to be recorded before there was a result
  // screen to fail on.
  await breakFurtherChallenges(page);
  await page.getByRole("button", { name: /run again/i }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await settled(page);

  await expect(page).toHaveScreenshot("result-request-failed.png");
});

// A whole layout of its own — not a badge or a card added to a screen that is
// already covered — and it is what the player sees when a Run they have just
// finished typing turns out not to count.
test("a Run the server refused to record", async ({ page }) => {
  await openHome(page, { runRefused: true });
  await startRun(page);

  await page.getByTestId("typing-input").fill(PASSAGE_TEXT);
  await expect(page.getByRole("alert")).toContainText(/run not recorded/i);
  await settled(page);

  await expect(page).toHaveScreenshot("run-refused.png");
});

// The judge is a dependency of one Discipline, so the home screen reports it
// apart from the badge rather than folding it in. Both readouts move together
// and neither is covered by the healthy shot.
test("the home screen with the judge degraded", async ({ page }) => {
  await openHome(page, { judgeDegraded: true });
  await settled(page);

  await expect(page).toHaveScreenshot("home-judge-degraded.png");
});
