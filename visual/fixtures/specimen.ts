import { type Locator, type Page, expect } from "@playwright/test";
import type { SpecimenName } from "../../apps/web/src/specimens/names.ts";
import { settled } from "./settle.ts";

/**
 * Opens one specimen and waits until it is safe to photograph.
 *
 * The gallery's own `specimenHref` would build this URL, but importing it here
 * would drag React into a Node process — `names.ts` is deliberately import-free
 * for exactly that reason, so the one line of URL shape lives here instead.
 *
 * Returns the box to photograph. Callers that need the whole viewport — the
 * native modal, which is not inside its box — take the page instead.
 */
export async function openSpecimen(page: Page, name: SpecimenName): Promise<Locator> {
  await page.goto(`/specimens.html?specimen=${name}`);

  const box = page.getByTestId(`specimen-${name}`);
  await expect(box).toBeVisible();
  await settled(page);

  return box;
}
