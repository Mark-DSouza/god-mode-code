import { type Locator, type Page, expect } from "@playwright/test";
import { type SpecimenName, specimenHref } from "../../apps/web/src/specimens/names.ts";
import { settled } from "./settle.ts";

/**
 * Opens one specimen and waits until it is safe to photograph.
 *
 * The URL comes from `specimenHref`, the same function the gallery's own index
 * links with, so there is one definition of where a specimen lives rather than
 * a copy here that could drift from it.
 *
 * Returns the box to photograph. Callers that need the whole viewport — the
 * native modal, which is not inside its box — take the page instead.
 */
export async function openSpecimen(page: Page, name: SpecimenName): Promise<Locator> {
  await page.goto(`/specimens.html${specimenHref(name)}`);

  const box = page.getByTestId(`specimen-${name}`);
  await expect(box).toBeVisible();
  await settled(page);

  return box;
}
