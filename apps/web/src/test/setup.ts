import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, vi } from "vitest";
import { server } from "./msw-server.ts";

/**
 * `error` rather than the default `warn`: a request the handlers do not cover is
 * a test that would have hit the network, and a test whose result depends on
 * whether a real backend happens to be running is worse than no test.
 */
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  cleanup();
});
afterAll(() => server.close());

/** jsdom implements neither of these, and both are load-bearing for DigitalRain. */
beforeAll(() => {
  if (!window.matchMedia) {
    setPrefersReducedMotion(false);
  }

  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }

  // jsdom has no canvas implementation and logs a loud "not implemented" error
  // on every call. Returning null is the documented "no 2D context" path, which
  // DigitalRain already handles.
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as never;

  installWebLocks();
});

/**
 * A Web Locks implementation for jsdom, which ships none.
 *
 * Real enough to be worth testing against: one holder per name, the rest queued
 * in arrival order, the lock released when the callback's promise settles either
 * way. That is the whole contract `acrossTabs` relies on, and without it the
 * cross-tab test would exercise only the no-API fallback — which is the branch
 * that does not serialise anything.
 *
 * Same reasoning as `matchMedia` above: a browser API the code under test
 * genuinely depends on, stood up rather than stubbed away.
 */
function installWebLocks(): void {
  if (globalThis.navigator?.locks) return;

  const queues = new Map<string, Promise<unknown>>();

  const request = (name: string, callback: () => unknown): Promise<unknown> => {
    const waitFor = queues.get(name) ?? Promise.resolve();
    // `.catch` so one holder throwing does not wedge the queue for the rest.
    const held = waitFor.catch(() => undefined).then(() => callback());
    queues.set(
      name,
      held.catch(() => undefined),
    );
    return held;
  };

  Object.defineProperty(globalThis.navigator, "locks", {
    configurable: true,
    value: { request },
  });
}

/**
 * Vitest's fake timers, plus the one shim that makes Testing Library notice
 * them.
 *
 * Two gaps have to be closed, and both of them bite as a test that times out
 * rather than as a test that fails.
 *
 * `toFake` is a short list on purpose. Faking everything also replaces
 * `setImmediate`, `queueMicrotask` and `process.nextTick`, and the HTTP
 * interception layer schedules its own work on those — fake them and no request
 * ever resolves.
 *
 * The `jest` stub is uglier and unavoidable. Testing Library decides whether
 * fake timers are installed with `typeof jest !== "undefined" &&
 * hasOwnProperty(setTimeout, "clock")`, and vitest defines no `jest` global —
 * so `waitFor` takes its real-timer path, schedules a `setInterval` that is now
 * fake, and waits forever for a tick nobody will deliver. The stub is the
 * advance function it looks for, pointed at vitest's.
 *
 * Used by the Run tests, which have a three-second countdown to sit through and
 * an elapsed clock whose whole point is that it does not start when the
 * countdown ends.
 */
export function useFakeClock(): void {
  vi.useFakeTimers({
    toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"],
  });
  vi.stubGlobal("jest", { advanceTimersByTime: (ms: number) => vi.advanceTimersByTime(ms) });
}

/** Puts the real clock back, and takes the shim away with it. */
export function useRealClock(): void {
  vi.unstubAllGlobals();
  vi.useRealTimers();
}

/**
 * Points `matchMedia` at a given reduced-motion answer.
 *
 * Tests that care about the preference call this before rendering. Everything
 * returned is a real `MediaQueryList` shape, because the hook under test
 * subscribes to change events rather than reading `matches` once.
 */
export function setPrefersReducedMotion(reduce: boolean): void {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query.includes("prefers-reduced-motion: reduce") ? reduce : false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}
