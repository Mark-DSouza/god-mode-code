#!/usr/bin/env bash
#
# Runs the visual suite inside the same container image CI uses.
#
# Screenshots are platform-specific. Font rasterisation, subpixel antialiasing
# and canvas compositing all differ between a laptop and a GitHub runner, by far
# more than the comparison threshold — so a baseline generated on a developer's
# machine fails in CI for reasons that have nothing to do with the design, and
# the usual response to that is to widen the threshold until the suite stops
# saying anything. Generating and comparing in one image removes the problem
# rather than tolerating it (ADR-0012).
#
#   ./visual/run-in-ci-image.sh test    # run the suite
#   ./visual/run-in-ci-image.sh update  # regenerate the baselines
#   ./visual/run-in-ci-image.sh canary  # prove the suite still catches a change
#
# Any further arguments go to Playwright, so `update -- --grep "the result
# screen"` regenerates one baseline rather than all of them.
set -euo pipefail

# Must match the @playwright/test version in the lockfile and the `container:`
# image in .github/workflows/ci.yml. A browser build that differs from the one
# the baselines were taken with is exactly the drift this script exists to stop.
IMAGE="mcr.microsoft.com/playwright:v1.61.1-noble"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# The binaries directly, with no package manager in between.
#
# The image ships Node and the browsers but not pnpm, and every route to
# installing one ends up reinstalling the workspace: pnpm sees a node_modules
# built by another machine, decides it is out of sync, and writes a 240MB store
# into the bind-mounted repository. The dependencies are the host's business.
# This container runs one command against them and changes nothing.
command=("${1:-test}")
shift || true
case "${command[0]}" in
  test) command=(node_modules/.bin/playwright test) ;;
  update) command=(node_modules/.bin/playwright test --update-snapshots) ;;
  canary) command=(node scripts/canary.mjs) ;;
  *)
    echo "usage: ${BASH_SOURCE[0]##*/} [test|update|canary] [playwright args...]" >&2
    exit 2
    ;;
esac

# As the invoking user, so regenerated baselines are owned by whoever has to
# commit them rather than by root.
exec docker run --rm --init \
  --ipc=host \
  --volume "$REPO_ROOT:/repo" \
  --workdir /repo/visual \
  --user "$(id -u):$(id -g)" \
  --env HOME=/tmp \
  --env CI=1 \
  "$IMAGE" \
  "${command[@]}" "$@"
