/**
 * A reproducible stand-in for `Math.random`.
 *
 * Exists so the rain can be photographed. `DigitalRain` makes several random
 * draws per column per frame — where each column starts, how fast it falls,
 * which glyph it shows, whether this one is the bright head — which is what
 * makes it look like rain and what makes any screenshot of it different from
 * the last. Given a seed, this returns the same stream every time, on every
 * machine, so the same seed and the same frame count produce the same picture
 * (ADR-0012).
 *
 * Mulberry32: 32 bits of state, no dependencies, and uniform enough that rain
 * drawn with it is indistinguishable from rain drawn with `Math.random`. It is
 * not cryptographic and nothing here wants it to be.
 */
export function seededRandom(seed: number): () => number {
  let state = seed | 0;

  return function next(): number {
    state = (state + 0x6d2b79f5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296;
  };
}
