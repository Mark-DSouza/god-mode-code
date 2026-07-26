import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Gallery } from "./Gallery.tsx";
import { SPECIMEN_NAMES, VIEWPORT_SPECIMENS, specimenFrom, specimenHref } from "./names.ts";

/**
 * The gallery is where the visual suite points its camera, so the failure this
 * guards against is not "the page looks wrong" — the baselines cover that — but
 * "the page rendered nothing and the baseline is a photograph of an empty box".
 * A blank specimen compares clean against a blank baseline forever.
 */
describe("the specimen gallery", () => {
  it.each(SPECIMEN_NAMES)("renders something for %s", (name) => {
    render(<Gallery name={name} />);

    const box = screen.getByTestId(`specimen-${name}`);
    expect(box).toBeInTheDocument();
    // `Dialog` is the one specimen whose content is not inside its box — the
    // native modal is lifted into the top layer — so it is asserted through the
    // document instead.
    const rendered = VIEWPORT_SPECIMENS.includes(name)
      ? document.body.textContent
      : box.textContent;
    expect(rendered?.trim()).not.toBe("");
  });

  it("lists every specimen when none was asked for", () => {
    render(<Gallery name={undefined} />);

    for (const name of SPECIMEN_NAMES) {
      expect(screen.getByRole("link", { name })).toHaveAttribute("href", specimenHref(name));
    }
  });

  it("reads the specimen out of the page's query string", () => {
    expect(specimenFrom("?specimen=button-variants")).toBe("button-variants");
  });

  // A renamed specimen leaves a stale link somewhere. Falling back to the index
  // makes that recoverable; throwing would make it look like the component
  // under test had broken.
  it("falls back to the index for a name it does not have", () => {
    expect(specimenFrom("?specimen=nonexistent")).toBeUndefined();
    expect(specimenFrom("")).toBeUndefined();
  });
});
