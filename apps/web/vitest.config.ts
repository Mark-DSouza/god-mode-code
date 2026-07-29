import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    css: false,
    // Vitest defaults to five seconds, which is a fine budget for a unit test
    // and a tight one for these. The Run and Solve Run suites drive the whole
    // application through real keyboard events and intercepted HTTP: one test
    // picks a Discipline, sits through a countdown or a catalogue fetch, types,
    // and waits for a result. That is a second and a half on an idle machine
    // and three or four times that with several workers competing for a core,
    // so five seconds fails on a busy laptop rather than on a broken change —
    // and a suite that goes red for being run alongside something else is a
    // suite people learn to rerun instead of read.
    testTimeout: 20_000,
  },
});
