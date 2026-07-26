import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Glyph } from "./Glyph.tsx";
import { TypingField } from "./TypingField.tsx";

/**
 * The typing surface on its own, away from a Run.
 *
 * Everything about how it behaves under real keystrokes is asserted through the
 * rendered application in `src/run/run.test.tsx`. What is left here is what only
 * this component can answer: what it renders, and what it renders again.
 */

function glyphs() {
  return within(screen.getByTestId("typing-field")).getAllByText(/[\s\S]/, {
    selector: "span[data-state]",
  });
}

describe("the typing surface", () => {
  it("gives every character of the Passage its own state", () => {
    render(<TypingField text="abc" typed="ax" />);

    expect(glyphs().map((glyph) => glyph.getAttribute("data-state"))).toEqual([
      "correct",
      "wrong",
      "untyped",
    ]);
  });

  it("puts the caret on the character about to be typed", () => {
    render(<TypingField text="abc" typed="a" />);

    expect(glyphs()[1]).toHaveAttribute("data-caret");
    expect(screen.getAllByTestId("caret")).toHaveLength(1);
  });

  it("leaves the caret standing at the end once the Passage is finished", () => {
    render(<TypingField text="abc" typed="abc" />);

    // No glyph is left to carry it, and a caret that vanishes at the moment the
    // Run ends reads as the surface breaking rather than as the Run finishing.
    expect(glyphs().every((glyph) => !glyph.hasAttribute("data-caret"))).toBe(true);
    expect(screen.getAllByTestId("caret")).toHaveLength(1);
  });

  it("stays out of the accessibility tree", () => {
    render(<TypingField text="abc" />);

    // Several hundred one-character elements is not something to read aloud.
    // Whoever owns the input offers the Passage as running text instead.
    expect(screen.getByTestId("typing-field")).toHaveAttribute("aria-hidden", "true");
  });

  it("renders the glyph through a memoised component", () => {
    // A keystroke changes the state of two glyphs and leaves the other few
    // hundred alone, ten times a second. Without `memo` every one of them
    // re-renders on every keystroke.
    //
    // This is asserted against the wrapper rather than against the output on
    // purpose: an unmemoised per-glyph component produces byte-identical DOM,
    // so there is nothing rendered that could tell the two apart. What can be
    // checked is that the component is wrapped, and that its props stayed
    // shallow-comparable — which is the half that gets broken by accident.
    expect((Glyph as { $$typeof?: symbol }).$$typeof).toBe(Symbol.for("react.memo"));
  });
});
