/**
 * Every specimen the gallery renders, named.
 *
 * Deliberately a plain list with no imports: the Playwright suite reads it to
 * decide which tests exist, and anything that pulled React in would drag a
 * browser bundle into a Node process. The gallery keys its catalogue off the
 * same names, so a component added here without something to render is a
 * compile error rather than a silently missing baseline.
 *
 * The states behind each name mirror the shipped design system's specimen cards
 * in `mockups-and-design-system/design_system/**\/*.card.html`, which is what
 * makes a diff here mean "we have drifted from the published reference" rather
 * than "somebody changed the demo".
 */
export const SPECIMEN_NAMES = [
  // brand/brand.card.html
  "wordmark",
  // core/core.card.html
  "button-variants",
  "button-sizes",
  "icon-button",
  "switch",
  "select",
  "kbd",
  // core/surfaces.card.html
  "surfaces",
  "card",
  "badge",
  "progress-bar",
  "input",
  "stat",
  // No card publishes these two. Their states come from the component prompts,
  // which are the only reference the design system gives for them.
  "dialog",
  "tabs",
  // data/data.card.html
  "avatar",
  // effects/rain.card.html
  "digital-rain",
  // typing/typing.card.html
  "typing-field",
  "challenge-card",
  "result-panel",
  "countdown",
] as const;

export type SpecimenName = (typeof SPECIMEN_NAMES)[number];

/**
 * Specimens photographed as a whole viewport rather than as a box on the page.
 *
 * `Dialog` is built on the native `<dialog>` element, so `showModal` lifts it
 * into the browser's top layer — it is a child of the specimen box in the DOM
 * and nowhere near it on screen. Its baseline is the viewport because the
 * viewport is what a modal actually occupies: scrim, blur and all.
 */
export const VIEWPORT_SPECIMENS: readonly SpecimenName[] = ["dialog"];

/** Where a specimen page finds the name it is meant to render. */
const NAME_PARAMETER = "specimen";

/**
 * The URL a specimen is rendered — and photographed — at.
 *
 * Here rather than beside the gallery so the Playwright suite can use it too.
 * That is the whole reason this module imports nothing: both the browser and a
 * bare Node process need it, and anything React-shaped would rule the second
 * one out.
 */
export function specimenHref(name: SpecimenName): string {
  return `?${NAME_PARAMETER}=${name}`;
}

/** Reads the requested specimen out of a page's query string, refusing anything unknown. */
export function specimenFrom(search: string): SpecimenName | undefined {
  const requested = new URLSearchParams(search).get(NAME_PARAMETER);
  return SPECIMEN_NAMES.find((name) => name === requested);
}
