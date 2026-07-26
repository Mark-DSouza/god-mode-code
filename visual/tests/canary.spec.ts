import { expect, test } from "@playwright/test";
import { settled } from "../fixtures/settle.ts";

/**
 * The test that proves the other tests can fail.
 *
 * A visual suite that has never gone red is not known to work. Baselines can be
 * blank, a threshold can be loose enough to swallow anything, a comparison can
 * be silently skipped — and every one of those failure modes looks exactly like
 * a suite that is passing.
 *
 * So this photographs a real specimen against a real committed baseline, and
 * `scripts/canary.mjs` runs it twice: once as it stands, which must pass, and
 * once with `VISUAL_CANARY` set, which nudges the buttons three pixels sideways
 * and must fail. Three pixels is chosen to be near the floor of what anyone
 * would file a bug about — if the suite catches that, it catches a regression
 * worth catching.
 */
const OFFSET = process.env.VISUAL_CANARY;

const SPECIMEN = "button-variants";

test("the canary specimen matches its baseline", async ({ page }) => {
  await page.goto(`/specimens.html?specimen=${SPECIMEN}`);

  const box = page.getByTestId(`specimen-${SPECIMEN}`);
  await expect(box).toBeVisible();

  if (OFFSET) {
    // A translation rather than an edited padding or colour, because it needs
    // no knowledge of what the token currently is — the perturbation stays
    // valid however the design system moves underneath it.
    await page.addStyleTag({
      content: `[data-testid="specimen-${SPECIMEN}"] button { transform: translateX(${OFFSET}); }`,
    });
  }

  await settled(page);

  await expect(box).toHaveScreenshot("canary.png");
});
