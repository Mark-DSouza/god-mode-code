/**
 * The rain seed the build was given, if it was given one.
 *
 * Only the visual regression harness sets `VITE_RAIN_SEED`. Vite replaces the
 * expression with a literal at build time, so an ordinary build compiles this
 * down to `undefined` and the animated rain is the only thing that survives
 * into the bundle — there is no runtime switch a visitor could find and no
 * test-only branch shipped to production.
 *
 * Kept apart from the component so the parsing has somewhere to be tested.
 */
export function rainSeedFrom(raw: string | undefined): number | undefined {
  if (raw === undefined || raw === "") return undefined;

  const seed = Number(raw);
  // Loud rather than lenient. A seed that quietly failed to parse would leave
  // the rain animating under a suite whose whole premise is that it does not,
  // and the symptom would be an unrepeatable diff rather than an error.
  if (!Number.isInteger(seed)) {
    throw new Error(`VITE_RAIN_SEED must be an integer, got ${JSON.stringify(raw)}`);
  }
  return seed;
}
