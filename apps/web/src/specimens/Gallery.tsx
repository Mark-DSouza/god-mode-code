import { SPECIMENS } from "./catalogue.tsx";
import { SPECIMEN_NAMES, type SpecimenName, specimenHref } from "./names.ts";

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
