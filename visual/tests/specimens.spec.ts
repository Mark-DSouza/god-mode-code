import { expect, test } from "@playwright/test";
import { SPECIMEN_NAMES, VIEWPORT_SPECIMENS } from "../../apps/web/src/specimens/names.ts";
import { openSpecimen } from "../fixtures/specimen.ts";

/**
 * Every reimplemented design system component, against the states its specimen
 * card publishes.
 *
 * The gallery under test is built from our components and the real token layer,
 * so a baseline here is a photograph of what we ship. Held up against
 * `mockups-and-design-system/design_system/**\/*.card.html` — which renders the
 * *shipped* components against the *same* tokens — it is a like-for-like
 * comparison, and that one-time review by eye is what the handoff's
 * "pixel-faithfully" actually asks for. After that, this suite's job is to
 * notice the day one of them stops matching.
 *
 * One test per specimen rather than one contact sheet, so a failure names the
 * component and its diff is small enough to read.
 */
for (const name of SPECIMEN_NAMES) {
  test(`the ${name} specimen matches its baseline`, async ({ page }) => {
    const box = await openSpecimen(page, name);

    if (VIEWPORT_SPECIMENS.includes(name)) {
      await expect(page).toHaveScreenshot(`${name}.png`);
    } else {
      await expect(box).toHaveScreenshot(`${name}.png`);
    }
  });
}
