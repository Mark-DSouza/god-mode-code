import * as React from "react";

export interface DigitalRainProps {
  /** Fall-rate multiplier. 1 = calm ambient; raise to ~2 while typing fast. */
  speed?: number;
  /** 0–1. Column density + glyph brightness. Raise while the user types. */
  intensity?: number;
  /** Glyph size in px (also the column width). */
  fontSize?: number;
  /** Trail color. Defaults to Matrix green (--rain-green). */
  color?: string;
  /** Leading-glyph "shine" color. Defaults to near-white (--rain-shine). */
  headColor?: string;
  /** Per-frame black fade (0–1). Higher = shorter trails. */
  fade?: number;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * The signature GOD_MODE_CODE digital-rain background. Renders a full-bleed
 * <canvas> of falling glyph columns. Place behind content (position it
 * absolutely in a container with darker content layered above at higher z).
 *
 * @startingPoint section="Effects" subtitle="Full-bleed Matrix rain canvas" viewport="900x520"
 */
export function DigitalRain(props: DigitalRainProps): JSX.Element;
