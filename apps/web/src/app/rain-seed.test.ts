import { describe, expect, it } from "vitest";
import { rainSeedFrom } from "./rain-seed.ts";

describe("rainSeedFrom", () => {
  // The production build is the case that matters. Vite substitutes an unset
  // `VITE_` variable with `undefined`, and anything other than "no seed" here
  // would freeze the rain for real visitors.
  it("has no seed when the variable is unset", () => {
    expect(rainSeedFrom(undefined)).toBeUndefined();
    expect(rainSeedFrom("")).toBeUndefined();
  });

  it("reads a seed the visual harness set", () => {
    expect(rainSeedFrom("1337")).toBe(1337);
    expect(rainSeedFrom("0")).toBe(0);
  });

  // A typo in the harness must not silently ship animated rain into a snapshot
  // run — that would look like flake rather than like a broken configuration.
  it("refuses a value that is not a number", () => {
    expect(() => rainSeedFrom("calm")).toThrow(/VITE_RAIN_SEED/);
    expect(() => rainSeedFrom("1.5")).toThrow(/VITE_RAIN_SEED/);
  });
});
