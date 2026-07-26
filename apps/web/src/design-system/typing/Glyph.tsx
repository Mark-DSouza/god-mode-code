import { memo } from "react";

/** What has happened to one character of the Passage. */
export type GlyphState = "untyped" | "correct" | "wrong";

export interface GlyphProps {
  /** The Passage's character at this position — never what was typed instead. */
  char: string;
  state: GlyphState;
  /** Whether this is the character the player is about to type. */
  caret: boolean;
}

/**
 * Characters a mistyped glyph would otherwise render as nothing at all.
 *
 * A wrong space is the case the design already anticipates — you cannot see
 * that a space is red. The others cannot appear in a Passage today, because the
 * database allows printable ASCII only, and are here so that the day a
 * Discipline needs them the surface does not silently swallow them.
 */
const VISIBLE_WHITESPACE: Record<string, string> = {
  " ": "␣",
  "\t": "⇥",
  "\n": "⏎",
};

/**
 * Every class this component can ever apply, on every glyph, driven off the
 * `data-state` attribute rather than composed per render.
 *
 * Two things follow from that. The className string is a constant, so a glyph
 * whose state has not changed re-renders to byte-identical props; and the state
 * a glyph is in is legible in the DOM, which is what the tests assert against
 * rather than reaching for a colour.
 */
const GLYPH = [
  "relative rounded-[1px]",
  "transition-[color,text-shadow] duration-[60ms] ease-linear",
  "data-[state=correct]:text-accent data-[state=correct]:[text-shadow:var(--glow-sm)]",
  // ADR-0010, deviation 4: the red flash is not allowed to be the only signal.
  // Green-against-red is the most common form of colour blindness, and
  // correct-versus-wrong carried by hue alone fails WCAG 1.4.1. The underline is
  // the non-colour half, and it is on the glyph itself rather than beneath the
  // line so it survives at the smallest size the Run screen uses.
  "data-[state=wrong]:text-rain-shine",
  "data-[state=wrong]:bg-[color-mix(in_srgb,var(--error)_45%,transparent)]",
  "data-[state=wrong]:underline data-[state=wrong]:decoration-wavy",
  "data-[state=wrong]:decoration-2 data-[state=wrong]:underline-offset-2",
].join(" ");

/**
 * One character of the Passage, and its state.
 *
 * <h2>Why this is memoised</h2>
 *
 * A Passage is hundreds of characters and a fast player produces ten keystrokes
 * a second. Each keystroke changes the state of at most two glyphs — the one
 * just typed and the one the caret moved to — so re-rendering the other few
 * hundred is work with no output, sixty times a second, on the one screen whose
 * whole job is to feel immediate.
 *
 * The props are three primitives precisely so that `memo`'s default shallow
 * comparison is the right comparison. Passing the whole typed string down, or a
 * per-glyph callback, would defeat it silently.
 */
export const Glyph = memo(function Glyph({ char, state, caret }: GlyphProps) {
  return (
    <span data-state={state} data-caret={caret ? "" : undefined} className={GLYPH}>
      {caret && (
        <span
          aria-hidden="true"
          data-testid="caret"
          // `gmc-caret` is not decoration: it is the cursor, and the token layer
          // slows its blink under reduced motion rather than stopping it, because
          // a caret that does not blink is hard to find on a dense glyph grid.
          className="gmc-caret absolute top-[0.12em] bottom-[0.12em] -left-px w-0.5 animate-[gmc-caret_1s_steps(1)_infinite] bg-accent shadow-[var(--glow-md)]"
        />
      )}
      {state === "wrong" ? (VISIBLE_WHITESPACE[char] ?? char) : char}
    </span>
  );
});
