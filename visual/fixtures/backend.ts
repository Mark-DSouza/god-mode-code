import type { Challenge, Health, TypingRun, User } from "@gmc/api-client";
import type { Page, Route } from "@playwright/test";

/**
 * The backend, as far as a photograph is concerned.
 *
 * Typed against the generated client, so a contract change breaks these
 * fixtures at compile time rather than producing a screen that renders an
 * error state and a baseline nobody notices is wrong.
 *
 * Stubbing rather than booting is the point. The end-to-end suite runs against
 * the real stack and asserts that the pieces connect; this suite asserts what
 * the pixels look like, and a real backend would hand it a different Passage,
 * a different Handle and a different set of numbers on every run.
 */

/**
 * The moment every screen is photographed at.
 *
 * The Run screen reads out elapsed seconds and the WPM derived from them, so
 * the clock is installed frozen here and advanced by exact amounts. Without
 * that, the numerals are different in every snapshot and the largest, most
 * legible thing on the screen is the one thing that cannot be compared.
 */
export const FIXED_TIME = new Date("2026-01-01T00:00:00.000Z");

/** Long enough that the expiry timer cannot fire inside a photographed Run. */
const CHALLENGE_LIFETIME_MILLIS = 10 * 60 * 1000;

export const HANDLE = "PERCOLATING_FERRET";

/**
 * The Passage every Run screen types.
 *
 * Fixed length and fixed content, because both decide where the text wraps and
 * therefore how tall the typing surface is. Long enough to wrap on a phone,
 * short enough to be typed in one `fill`.
 */
export const PASSAGE_TEXT =
  "There is no spoon. Only the keys, and how fast you find them under the falling rain.";

/**
 * A Run caught mid-Passage, with two characters wrong.
 *
 * The mistake is deliberate and load-bearing: it is what puts the accuracy
 * readout on its warning accent, the progress track on its warning tone, and
 * wrong glyphs on the typing surface. A clean prefix would photograph three
 * fewer states.
 */
export const PARTIALLY_TYPED = "There is no spoon. Only the keys, and hwo";

/** How long the photographed Run has been going when the shutter opens. */
export const TYPING_ELAPSED_MILLIS = 12_000;

const USER: User = {
  id: "3f1c0b1a-5c2e-4d3b-9f8a-1e2d3c4b5a69",
  handle: HANDLE,
  claimed: false,
};

const HEALTHY: Health = {
  status: "UP",
  database: "UP",
  judge: "UP",
  version: "0.0.1-SNAPSHOT",
};

const CHALLENGE: Challenge = {
  issueId: "8c1d2e3f-4a5b-4c6d-8e9f-0a1b2c3d4e5f",
  expiresAt: new Date(FIXED_TIME.getTime() + CHALLENGE_LIFETIME_MILLIS).toISOString(),
  passage: {
    id: "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
    discipline: "QUOTES",
    text: PASSAGE_TEXT,
    attribution: "Morpheus, The Matrix, 1999",
    characterCount: PASSAGE_TEXT.length,
  },
};

const RECORDED_RUN: TypingRun = {
  id: "9f8e7d6c-5b4a-4c3d-8e2f-1a0b9c8d7e6f",
  passageId: CHALLENGE.passage.id,
  discipline: "QUOTES",
  wpm: 112.4,
  accuracy: 98.4,
  elapsedMillis: 21_000,
  keystrokes: 86,
  correctCharacters: 83,
  errors: 3,
  completedAt: new Date(FIXED_TIME.getTime() + 21_000).toISOString(),
};

export interface BackendOptions {
  /** Make asking for a Challenge fail, which is the screens' error state. */
  challengeFails?: boolean;
}

/**
 * Answers every request the application makes, and refuses the ones it does not.
 *
 * The catch-all matters as much as the handlers: an unrouted `/api` call would
 * reach a preview server that has no backend behind it, and the screen would be
 * photographed in whatever state a failed request leaves it in.
 */
export async function stubBackend(page: Page, options: BackendOptions = {}): Promise<void> {
  /**
   * Answers with a payload from the generated client.
   *
   * The cast is the price of `fulfill` wanting a plain JSON object where these
   * are named contract types. Confined to one place so the types stay visible
   * at every call site rather than being restated five times.
   */
  const answer = (payload: object, status?: number) => (route: Route) =>
    route.fulfill({ ...(status === undefined ? {} : { status }), json: payload });

  // Registered first because Playwright matches routes in reverse: the last
  // handler added is the first consulted, so a catch-all added last would
  // swallow every stub below it.
  await page.route("**/api/**", (route) =>
    answer({ error: `unstubbed: ${route.request().url()}` }, 500)(route),
  );

  await page.route("**/api/health", answer(HEALTHY));
  await page.route("**/api/users/me", answer(USER));
  await page.route(
    "**/api/challenges",
    options.challengeFails ? answer({ error: "no backend" }, 503) : answer(CHALLENGE),
  );
  await page.route("**/api/typing-runs", answer(RECORDED_RUN));
}
