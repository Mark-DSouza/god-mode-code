import { defineConfig, devices } from "@playwright/test";

/**
 * The visual regression seam.
 *
 * Every other suite in this repository asserts about structure: a token
 * resolves, a `className` override wins, a role is present, the backend
 * answers. All of those were green while the walking skeleton shipped three
 * visible defects, because none of them look at pixels. This one photographs
 * the rendered page and compares it against a committed baseline (ADR-0012).
 *
 * It does not boot the stack. The end-to-end suite already owns "the pieces are
 * wired together"; what this needs is a page that renders the same way twice,
 * so the backend is stubbed at the network and the only variables left are the
 * markup, the styles and the tokens.
 */

const PORT = Number(process.env.VISUAL_PORT ?? 4173);
const BASE_URL = process.env.VISUAL_BASE_URL ?? `http://127.0.0.1:${PORT}`;

/**
 * The seed the application's rain is built with.
 *
 * Any integer would do; what matters is that it never changes, because it is
 * half of what decides the picture — the other half being the frame count fixed
 * inside `DigitalRain`. Changing this invalidates every baseline containing
 * rain and buys nothing.
 */
const RAIN_SEED = "5150";

/** Set when a preview server is already up, so the build is not paid twice. */
const reuseExistingServer = Boolean(process.env.VISUAL_BASE_URL);

/**
 * Built to its own directory, never to `dist`.
 *
 * This build carries the specimen gallery, which no deployed bundle may. Giving
 * it a separate output means a visual run can never leave a `dist` behind that
 * somebody later ships.
 */
const OUT_DIR = "dist-visual";

/** Resolved from `apps/web`, which is where the server runs. */
const VITE = "node_modules/.bin/vite";

export default defineConfig({
  testDir: "./tests",
  snapshotDir: "./__screenshots__",

  // Flat, one directory per viewport, named for the thing photographed rather
  // than for the file and test that happened to photograph it. Baselines are
  // reviewed by a person opening them in a pull request, and
  // `screens-spec-ts-home-desktop-chromium-linux.png` is not a name that helps.
  snapshotPathTemplate: "{snapshotDir}/{projectName}/{arg}{ext}",

  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),

  // No retries, deliberately. A retry on a visual suite hides exactly the
  // failure mode the suite must not have: a comparison that passes on the
  // second attempt is a flake, and a flake that reruns itself green is one
  // nobody will ever fix.
  retries: 0,

  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],

  use: {
    baseURL: BASE_URL,
    // Pinned rather than inherited. All three change what is rendered — the
    // theme decides the palette, the locale and time zone decide how anything
    // formatted lands — and a runner in another region must photograph the same
    // page as a laptop.
    colorScheme: "dark",
    locale: "en-GB",
    timezoneId: "UTC",
    // The rain is drawn only when motion is allowed. A runner that requested
    // reduced motion would photograph pages with no rain at all and compare
    // them clean against baselines that have it. Reachable only through
    // `contextOptions` — Playwright exposes no top-level test option for it.
    contextOptions: { reducedMotion: "no-preference" },
    trace: "on-first-retry",
  },

  expect: {
    toHaveScreenshot: {
      // Per-pixel colour tolerance, then a budget for how many pixels may
      // differ at all. Two in a thousand is about 2000 pixels of a desktop
      // viewport: far below a shifted element, a changed colour or a different
      // font, and far above the handful of subpixels that antialiasing moves.
      threshold: 0.2,
      maxDiffPixelRatio: 0.002,
      // CSS animations and transitions are held at their end state. The rain is
      // a canvas and is not covered by this — it is frozen by its seed instead.
      animations: "disabled",
      caret: "hide",
      scale: "css",
    },
  },

  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
    {
      // The design specifies both widths and three of the eighteen handoff
      // frames are phones. Only the product screens are photographed here:
      // a specimen is a fixed-width box and rendering it twice would double the
      // baselines without covering anything the desktop run does not.
      name: "mobile",
      testMatch: /screens\.spec\.ts/,
      use: {
        ...devices["Pixel 7"],
        // The device profile's 2.6× ratio would triple every file for no extra
        // signal — a layout regression is a layout regression at 1×.
        deviceScaleFactor: 1,
        viewport: { width: 390, height: 844 },
      },
    },
  ],

  ...(reuseExistingServer
    ? {}
    : {
        webServer: {
          // The binary directly, rather than through a package manager. This
          // command also runs inside the CI container image, which ships Node
          // and the browsers but no pnpm — and a server that starts one way on
          // a laptop and another way in the image is a difference the baselines
          // would eventually notice.
          command:
            `${VITE} build --outDir ${OUT_DIR} && ` +
            // `--host 127.0.0.1` rather than the default: Vite binds the name
            // `localhost`, which on a Node that prefers IPv6 listens on `::1`
            // and nothing at all on the address the tests dial.
            `${VITE} preview --outDir ${OUT_DIR} --host 127.0.0.1 --port ${PORT} --strictPort`,
          cwd: "../apps/web",
          url: BASE_URL,
          reuseExistingServer: !process.env.CI,
          timeout: 3 * 60 * 1000,
          stdout: "pipe",
          stderr: "pipe",
          env: {
            // Adds the specimen gallery as a second entry point.
            VISUAL: "1",
            // Freezes the rain behind every product screen.
            VITE_RAIN_SEED: RAIN_SEED,
          },
        },
      }),
});
