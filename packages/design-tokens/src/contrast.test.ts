import { describe, expect, it } from "vitest";
import { hex as contrastRatio } from "wcag-contrast";
import { color, shippedColors } from "./values.js";

/**
 * ADR-0010's first deviation, checked with a real contrast checker.
 *
 * The point of running `wcag-contrast` rather than asserting a number someone
 * worked out by hand is that the relative-luminance formula has enough steps
 * (sRGB companding, the 0.05 flare term) to get quietly wrong, and a wrong
 * number here is invisible until a user cannot read the text they are being
 * asked to type.
 */

const WCAG_AA_NORMAL_TEXT = 4.5;

describe("--ink-3 against the void", () => {
  const void_ = color("--void");

  it("meets WCAG AA for normal text", () => {
    // The token colours untyped glyphs on the typing surface. The mobile Run
    // screen renders it at 19px, so the large-text exemption does not apply.
    expect(contrastRatio(color("--ink-3"), void_)).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT);
  });

  it("is a deviation from the shipped token, which does not meet AA", () => {
    // Guards the reason for the deviation. If the design system ever ships a
    // compliant --ink-3, this fails and the override should be deleted rather
    // than left to shadow a value that no longer needs overriding.
    const shipped = shippedColors.get("--ink-3");
    expect(shipped).toBeDefined();
    expect(contrastRatio(shipped!, void_)).toBeLessThan(WCAG_AA_NORMAL_TEXT);
    expect(color("--ink-3")).not.toBe(shipped);
  });
});

describe("the rest of the palette", () => {
  // ADR-0010 claims --ink-3 "is the only token that needed moving". These pin
  // that claim, so a future palette change cannot quietly introduce a second
  // unreadable text token.
  it.each([
    ["--ink-max", WCAG_AA_NORMAL_TEXT],
    ["--ink-1", WCAG_AA_NORMAL_TEXT],
    ["--ink-2", WCAG_AA_NORMAL_TEXT],
    ["--rain-green", WCAG_AA_NORMAL_TEXT],
  ])("%s meets AA against the void", (token, minimum) => {
    expect(contrastRatio(color(token), color("--void"))).toBeGreaterThanOrEqual(minimum);
  });

  it("keeps text on bright-green fills readable", () => {
    expect(contrastRatio(color("--ink-on"), color("--rain-green"))).toBeGreaterThanOrEqual(
      WCAG_AA_NORMAL_TEXT,
    );
  });
});
