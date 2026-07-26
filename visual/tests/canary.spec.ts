import { expect, test } from "@playwright/test";
import { openSpecimen } from "../fixtures/specimen.ts";

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
 * once with `VISUAL_CANARY` set, which nudges the buttons sideways and must
 * fail. The offset is chosen to be near the floor of what anyone would file a
 * bug about — if the suite catches that, it catches a regression worth
 * catching.
 */

/** The specimen the canary perturbs. Any real one would do; this one is small. */
const SPECIMEN = "button-variants";

/** Unset on the run that must pass; a CSS length on the run that must fail. */
const INJECTED_OFFSET = process.env.VISUAL_CANARY;

test("the canary specimen matches its baseline", async ({ page }) => {
  const box = await openSpecimen(page, SPECIMEN);

  if (INJECTED_OFFSET) {
    // A translation rather than an edited padding or colour, because it needs
    // no knowledge of what the token currently is — the perturbation stays
    // valid however the design system moves underneath it.
    await page.addStyleTag({
      content: `[data-testid="specimen-${SPECIMEN}"] button { transform: translateX(${INJECTED_OFFSET}); }`,
    });
  }

  await expect(box).toHaveScreenshot("canary.png");
});
