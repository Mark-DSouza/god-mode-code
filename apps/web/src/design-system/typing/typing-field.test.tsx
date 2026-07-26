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

  it("memoises both the glyph and the surface", () => {
    // Two different savings. `Glyph` memoised means a keystroke reconciles the
    // two glyphs whose state changed rather than the whole Passage. `TypingField`
    // memoised means the Run screen's hundred-millisecond clock tick does not
    // reach the surface at all — nothing here changes with the time.
    //
    // Asserted against the wrappers rather than the output, because an
    // unmemoised component renders byte-identical DOM: there is nothing on the
    // page that could tell the two apart.
    expect((Glyph as { $$typeof?: symbol }).$$typeof).toBe(Symbol.for("react.memo"));
    expect((TypingField as { $$typeof?: symbol }).$$typeof).toBe(Symbol.for("react.memo"));
  });

  it("keeps the glyph's props shallow-comparable, which is what makes the memo work", () => {
    render(<TypingField text="abc" typed="a" />);

    // The half that gets broken by accident. `memo` compares props shallowly, so
    // the moment a glyph is handed an object — the whole typed string, a
    // per-glyph callback, a style literal — every glyph re-renders again and the
    // memo above becomes decoration. Each glyph's rendered attributes are the
    // primitives it was given, so this is where that shows.
    for (const glyph of glyphs()) {
      expect(glyph.getAttribute("data-state")).toMatch(/^(untyped|correct|wrong)$/);
    }
  });
});
