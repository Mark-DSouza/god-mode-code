import { type CSSProperties, memo } from "react";
import { cn } from "../cn.ts";
import { Glyph, type GlyphState } from "./Glyph.tsx";

export interface TypingFieldProps {
  /** The target Passage to be typed. */
  text: string;
  /** What the player has entered so far, compared character by character. */
  typed?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  style?: CSSProperties;
}

const SIZES = {
  sm: "text-md",
  md: "text-lg",
  lg: "text-xl",
} as const;

/**
 * The typing surface: correct glyphs glow, mistakes flash and carry an
 * underline, a blinking block caret marks the active glyph.
 *
 * <h2>Purely presentational, and that is load-bearing</h2>
 *
 * This renders `text` against `typed` and does nothing else. It has no keyboard
 * handler, no focus, no state. The keystrokes arrive at a visually hidden but
 * genuinely focused `<input>` that the Run screen owns and this sits above
 * (ADR-0010, deviation 2).
 *
 * That split is not tidiness. The shipped design system captures input with
 * `tabIndex` and `onKeyDown` on a `<div>`, which does not raise the on-screen
 * keyboard on iOS or Android — so the mobile Run screen the mockups explicitly
 * design for could not be typed on at all. A real form control also gives
 * correct IME and dead-key handling, a paste event that can be seen, and
 * something for a screen reader to land on.
 *
 * The whole surface is hidden from assistive technology: it is several hundred
 * one-character elements, which is noise to read aloud. The Passage is offered
 * to a screen reader as running text by whoever owns the input.
 *
 * <h2>Memoised as well as its glyphs</h2>
 *
 * `Glyph` being memoised stops a keystroke reconciling the whole Passage. This
 * stops something else: the Run screen re-renders ten times a second to move the
 * elapsed clock, and every one of those renders would otherwise rebuild several
 * hundred glyph elements for React to compare and discard. Nothing on this
 * surface changes with the clock, so the tick should not reach it at all.
 *
 * `style` is the one prop that can defeat this — an object literal is a new
 * object each render. Callers that want the memo should pass classes.
 */
export const TypingField = memo(function TypingField({
  text,
  typed = "",
  size = "lg",
  className,
  style,
}: TypingFieldProps) {
  // Split by code point rather than by UTF-16 unit, and split both sides the
  // same way. Passages are printable ASCII today, where the two are identical —
  // but a surface that indexes the target one way and the typed text the other
  // is a bug waiting for the first Discipline that needs a character outside it.
  const characters = [...text];
  const typedCharacters = [...typed];

  return (
    <div
      aria-hidden="true"
      data-testid="typing-field"
      className={cn(
        "font-code leading-loose tracking-[0.02em] break-words whitespace-pre-wrap text-ink-3",
        SIZES[size],
        className,
      )}
      style={style}
    >
      {characters.map((char, index) => (
        <Glyph
          // The index is the identity here, and legitimately so: a glyph *is* a
          // position in a fixed Passage. Nothing is inserted, removed or
          // reordered — only the state at each position changes.
          key={index}
          char={char}
          state={stateOf(char, typedCharacters[index])}
          caret={index === typedCharacters.length}
        />
      ))}

      {/* The caret has nowhere left to sit once the last character is typed, so
          it stands on its own at the end rather than vanishing at the moment the
          Run ends. */}
      {typedCharacters.length >= characters.length && (
        <span
          data-testid="caret"
          className="gmc-caret inline-block h-[1em] w-0.5 animate-[gmc-caret_1s_steps(1)_infinite] bg-accent align-text-bottom shadow-[var(--glow-md)]"
        />
      )}
    </div>
  );
});

function stateOf(expected: string, actual: string | undefined): GlyphState {
  if (actual === undefined) return "untyped";
  return actual === expected ? "correct" : "wrong";
}
