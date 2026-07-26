import { describe, expect, it, vi } from "vitest";
import { seededRandom } from "./seeded-random.ts";

describe("seededRandom", () => {
  it("gives the same sequence for the same seed", () => {
    const first = seededRandom(1337);
    const second = seededRandom(1337);

    const a = Array.from({ length: 50 }, first);
    const b = Array.from({ length: 50 }, second);

    expect(a).toEqual(b);
  });

  it("gives a different sequence for a different seed", () => {
    const a = Array.from({ length: 50 }, seededRandom(1));
    const b = Array.from({ length: 50 }, seededRandom(2));

    expect(a).not.toEqual(b);
  });

  it("stays inside the range Math.random promises", () => {
    const next = seededRandom(99);

    for (let index = 0; index < 5_000; index++) {
      const value = next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  // The whole point is to take the global generator out of the picture. A
  // version that delegated to it would pass every test above and still produce
  // a different screenshot on every run.
  it("never consults Math.random", () => {
    const globalRandom = vi.spyOn(Math, "random");

    const next = seededRandom(7);
    for (let index = 0; index < 100; index++) next();

    expect(globalRandom).not.toHaveBeenCalled();
    globalRandom.mockRestore();
  });

  // A generator that collapses onto one value, or onto a short cycle, would
  // still be deterministic — and would draw rain that is not rain.
  it("spreads its output across the unit interval", () => {
    const next = seededRandom(4242);
    const buckets = new Array<number>(10).fill(0);

    for (let index = 0; index < 10_000; index++) {
      buckets[Math.floor(next() * 10)]!++;
    }

    // Uniform would be 1000 apiece. This is loose enough not to be a test of
    // the constants and tight enough to catch a generator that is stuck.
    for (const count of buckets) {
      expect(count).toBeGreaterThan(700);
      expect(count).toBeLessThan(1300);
    }
  });
});
