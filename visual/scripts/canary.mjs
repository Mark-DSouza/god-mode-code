#!/usr/bin/env node
/**
 * Proves the visual suite fails when the design moves.
 *
 * Runs `tests/canary.spec.ts` twice against the same committed baseline: once
 * untouched, which must pass, and once with a three-pixel offset injected,
 * which must fail. Either result coming out the other way is a suite that
 * cannot be trusted — a red first run means the baseline itself has drifted,
 * and a green second run means comparisons are not actually being made.
 *
 * Kept out of the suite proper on purpose. A test that asserts another test
 * fails has to run Playwright inside Playwright, and the honest way to say
 * "the suite fails" is to run the suite and look at its exit code.
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

/** Small enough to be a plausible regression, large enough to be a real one. */
const OFFSET = "3px";

// The binary by path rather than by name. This script runs inside the CI
// container image as well as on a laptop, and the image ships no package
// manager to put `node_modules/.bin` on the PATH for us.
const PLAYWRIGHT = fileURLToPath(new URL("../node_modules/.bin/playwright", import.meta.url));
const PACKAGE_ROOT = fileURLToPath(new URL("..", import.meta.url));

const ARGUMENTS = ["test", "--project=desktop", "tests/canary.spec.ts"];

/** @param {NodeJS.ProcessEnv} extra */
function runCanary(extra) {
  const result = spawnSync(PLAYWRIGHT, ARGUMENTS, {
    stdio: "inherit",
    cwd: PACKAGE_ROOT,
    env: { ...process.env, ...extra },
  });
  if (result.error) throw result.error;
  return result.status;
}

console.log("\n▚ canary 1/2 — the suite must pass against its baseline\n");
const clean = runCanary({});
if (clean !== 0) {
  console.error(
    "\n✕ The canary failed against its own baseline.\n" +
      "  Something has drifted, or the baseline was generated somewhere other than\n" +
      "  the container image CI runs in. Regenerate with `pnpm visual:update`.\n",
  );
  process.exit(1);
}

console.log(`\n▚ canary 2/2 — the suite must fail once the buttons move ${OFFSET}\n`);
const perturbed = runCanary({ VISUAL_CANARY: OFFSET });
if (perturbed === 0) {
  console.error(
    `\n✕ The suite passed with the buttons shifted ${OFFSET}.\n` +
      "  The comparison is not catching regressions. Check that the baseline is not\n" +
      "  blank, that `maxDiffPixelRatio` has not been widened, and that the spec is\n" +
      "  actually reaching its assertion.\n",
  );
  process.exit(1);
}

console.log("\n✓ The suite passes against its baseline and fails on a three-pixel regression.\n");
