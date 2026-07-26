import { SPECIMENS } from "./catalogue.tsx";
import { SPECIMEN_NAMES, type SpecimenName } from "./names.ts";

/** Where a specimen page finds the name it is meant to render. */
const NAME_PARAMETER = "specimen";

/**
 * Reads the requested specimen out of a URL, refusing anything not in the list.
 *
 * Exported for the test: "an unknown name renders the index rather than
 * throwing" is the behaviour that keeps a stale link from looking like a
 * rendering fault.
 */
export function specimenFrom(search: string): SpecimenName | undefined {
  const requested = new URLSearchParams(search).get(NAME_PARAMETER);
  return SPECIMEN_NAMES.find((name) => name === requested);
}

/** The URL a given specimen is photographed at. */
export function specimenHref(name: SpecimenName): string {
  return `?${NAME_PARAMETER}=${name}`;
}

/**
 * One specimen per page.
 *
 * Not a single scrolling board, for two reasons that are both about the
 * baseline rather than about the layout. `Dialog` is a native modal, so it
 * lifts itself into the browser's top layer and covers whatever else is on the
 * page. And a screenshot is only reviewable if it is small: one image per
 * component means a change to `Button` produces a diff of `Button`, not a diff
 * of a two-thousand-pixel contact sheet that nobody will read.
 */
export function Gallery({ name }: { name: SpecimenName | undefined }) {
  if (!name) return <Index />;

  const specimen = SPECIMENS[name];

  return (
    <div
      data-testid={`specimen-${name}`}
      className="bg-void"
      // The width is pinned per specimen because text wrapping is a function of
      // it: a box that sized itself to the viewport would rewrap between a
      // baseline taken on one machine and a comparison run on another.
      style={{ width: specimen.width, padding: 22 }}
    >
      {specimen.node}
    </div>
  );
}

/** The list, for a person who opened the gallery to look at it. */
function Index() {
  return (
    <nav className="flex flex-col items-start gap-2 p-6">
      <h1 className="mb-2 font-display text-lg tracking-wide text-heading uppercase">Specimens</h1>
      {SPECIMEN_NAMES.map((name) => (
        <a key={name} href={specimenHref(name)} className="font-code text-sm text-accent underline">
          {name}
        </a>
      ))}
    </nav>
  );
}
