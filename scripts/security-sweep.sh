#!/usr/bin/env bash
#
# The whole-repository security sweep: everything the diff-scoped controls
# never look at, and an honest account of what it could not look at either.
#
# Every other control here reads a change. The commit guard reads the staged
# diff, CI reads the pull request, and code scanning decides what is new by
# fingerprinting against the base. That is deliberate and ADR-0013 argues it at
# length — a gate that fires on findings unrelated to the change in front of it
# is a gate people learn to route around. The cost of it is that code nobody
# has touched since it was written is never looked at again, and that history
# is never looked at at all. This is what looks.
#
# So it is a command, not a gate. Nothing in CI runs it, and wiring it into a
# pull request would recreate exactly the whole-repository gate ADR-0013 exists
# to refuse. It reports; a person decides. Run it after touching anything
# security-shaped, before a release, or when you want to know rather than
# assume. The shape is `scripts/check-contract-drift.sh` and
# `visual/run-in-ci-image.sh`: one command, run locally, exactly as documented.
#
# Two properties are the whole point, and neither is negotiable:
#
#   **A tier that could not run says so, in the summary, next to the tiers that
#   did.** A scan that quietly does nothing is worse than one that fails,
#   because it is believed. `trivy` needs Docker and `govulncheck` needs the Go
#   toolchain; neither is present on every machine, and neither is silently
#   skipped.
#
#   **It closes by naming what it cannot check at all.** CodeQL, Dependabot,
#   push protection and GitHub's secret scanning are not local tools and never
#   will be. A local sweep that ends with an unqualified "no problems found"
#   misleads the reader about how much of the posture it just covered.
#
# Findings are reported, never remediated. Nothing here rotates a credential —
# rotating one can break the running deploy, and that is a person's decision —
# and nothing rewrites history: `main` refuses force pushes with
# `enforce_admins`, and a rewrite does not un-publish what has already been
# cloned.
#
# Exit status:
#
#   0   every tier that ran found nothing
#   1   something was found
#   2   the sweep could not run
#
# A tier that could not run does not change the exit status. That is the one
# judgement call in this file: on a laptop without Docker the ordinary outcome
# would otherwise be a failure with nothing wrong, and a command that fails
# when nothing is wrong is a command people stop reading. What ran is in the
# summary, in words, where the reason fits.
set -uo pipefail

# Deliberately not `set -e`. Every tier here is expected to exit non-zero when
# it finds something, and the whole job of this script is to collect those
# rather than to stop at the first one.

readonly TRIVY_IMAGE="aquasec/trivy:0.72.0"
readonly GOVULNCHECK="golang.org/x/vuln/cmd/govulncheck@v1.6.0"

readonly FOUND="findings"
readonly CLEAN="no findings"

# Tier name, and what became of it. Two arrays rather than one associative
# array, so the summary prints in the order the tiers ran.
tier_names=()
tier_outcomes=()

found_something=0
could_not_run=0

heading() {
  echo
  echo "==> $1"
}

record() {
  tier_names+=("$1")
  tier_outcomes+=("$2")
  case "$2" in
  "$FOUND") found_something=1 ;;
  esac
}

not_run() {
  record "$1" "not run — $2"
}

# The sweep's own failure, as opposed to a tier's finding. Reported and then
# carried to the exit status, so a run where one tier broke is never mistaken
# for a clean one.
broke() {
  record "$1" "COULD NOT RUN — $2"
  could_not_run=1
}

repo_root="$(git rev-parse --show-toplevel 2>/dev/null)"
if [[ -z "$repo_root" ]]; then
  echo "The sweep reads a git repository, and this is not one." >&2
  echo "Run it from inside a checkout of this project." >&2
  exit 2
fi
cd "$repo_root"

detector="$repo_root/scripts/credential_detector.py"

# Failing loudly is the right default for a control, and the same argument the
# commit hook makes: a sweep that quietly reports nothing when its interpreter
# is missing is worse than no sweep, because everyone believes it ran.
if ! command -v python3 >/dev/null 2>&1; then
  echo "The sweep needs python3, which is not on PATH." >&2
  exit 2
fi

echo "Sweeping $repo_root"

# ---------------------------------------------------------------------------
# The tree: every tracked file, not only the changed ones.
#
# The commit guard reads added lines, so anything committed before it existed
# — the first five hundred and fifty files of this repository among them — has
# never been read by anything of ours at all.
# ---------------------------------------------------------------------------
heading "Tree: every tracked file"
python3 "$detector" --tracked
case $? in
0) record "tree" "$CLEAN" ;;
1) record "tree" "$FOUND" ;;
*) broke "tree" "the credential detector failed" ;;
esac

# ---------------------------------------------------------------------------
# History: every blob any commit ever held.
#
# The one thing no working tree shows and no edit to a working tree fixes. A
# credential deleted from a file is still in the commit that carried it, and on
# a public repository that means it is in every clone anyone has taken.
# ---------------------------------------------------------------------------
heading "History: every blob ever committed"
python3 "$detector" --history
case $? in
0) record "history" "$CLEAN" ;;
1) record "history" "$FOUND" ;;
*) broke "history" "the credential detector failed" ;;
esac

# ---------------------------------------------------------------------------
# Infrastructure misconfiguration, over the Terraform and the Dockerfiles.
#
# Findings here are the input to triage rather than the output of it: some of
# what Trivy reports about this repository's Terraform is a deliberate cost
# decision — a single-AZ database, no cross-region replication — and writing
# the suppressions that say so is a separate piece of work. Severity is not
# filtered for the same reason: the point is to see the list.
#
# Preferring a local `trivy` to the container is not only about speed. The
# container needs the repository bind-mounted into it, which a machine running
# Docker in a VM does not always make possible.
# ---------------------------------------------------------------------------
heading "Infrastructure: misconfiguration in the Terraform and the Dockerfiles"
scan_infrastructure() {
  if command -v trivy >/dev/null 2>&1; then
    trivy config --exit-code 1 --skip-dirs node_modules .
    return $?
  fi
  if command -v docker >/dev/null 2>&1; then
    # `--cache-dir` inside the mount would write into the repository, so the
    # container keeps its cache to itself and re-fetches the checks each run.
    docker run --rm \
      --volume "$repo_root:/repo:ro" \
      --workdir /repo \
      "$TRIVY_IMAGE" config --exit-code 1 --skip-dirs node_modules .
    return $?
  fi
  return 127
}

# The scan itself is repository-wide — the Dockerfiles under `apps/` and the
# compose files are misconfiguration surface too — but it is gated on the
# Terraform being here, because that is the substance of the tier and a run
# over a repository with none of it would report "clean" having read nothing.
if [[ ! -d "$repo_root/infra" ]]; then
  not_run "infrastructure" "there is no infra/ in this repository"
else
  scan_infrastructure
  case $? in
  0) record "infrastructure" "$CLEAN" ;;
  1) record "infrastructure" "$FOUND" ;;
  127) not_run "infrastructure" "needs trivy, or Docker to run $TRIVY_IMAGE" ;;
  *) broke "infrastructure" "trivy failed" ;;
  esac
fi

# ---------------------------------------------------------------------------
# Known vulnerabilities in the judge's Go dependencies and toolchain.
#
# `apps/judge` has no third-party dependencies today, so this is mostly a
# statement about the standard library and the toolchain it was built with.
# Worth having anyway for a network service — and the day it grows a
# dependency, this is already here rather than remembered.
# ---------------------------------------------------------------------------
heading "Go: known vulnerabilities in the judge"
if [[ ! -f "$repo_root/apps/judge/go.mod" ]]; then
  not_run "go" "there is no apps/judge/go.mod in this repository"
elif ! command -v go >/dev/null 2>&1; then
  not_run "go" "needs the Go toolchain"
else
  # `go run` rather than an installed binary, pinned: nothing here has to be
  # installed first, and the version is visible in the diff when it moves.
  # It fetches the vulnerability database over the network, so no network is
  # a tier that did not run rather than a tier that found nothing.
  (cd "$repo_root/apps/judge" && go run "$GOVULNCHECK" ./...)
  case $? in
  0) record "go" "$CLEAN" ;;
  # govulncheck's own convention: 3 means it found something reachable.
  3) record "go" "$FOUND" ;;
  *) not_run "go" "govulncheck could not run — no network, or no module cache" ;;
  esac
fi

# ---------------------------------------------------------------------------
# The summary, and then the part that matters more: what this could not see.
# ---------------------------------------------------------------------------
echo
echo "Summary"
for index in "${!tier_names[@]}"; do
  printf '  %-16s %s\n' "${tier_names[$index]}" "${tier_outcomes[$index]}"
done

cat <<'GAPS'

What this run did not check, and could not
  Four tiers of the posture only exist on GitHub's side, and a local sweep
  that ends without saying so overstates itself:

  - CodeQL, over the three languages written here. Runs on pull requests and
    on a schedule; results are in the repository's Security tab, under Code
    scanning.
  - Dependabot alerts, for known vulnerabilities in declared dependencies.
    Security tab, under Dependabot. Note that container OS packages are not
    covered by anything, which ADR-0013 records as a deliberate acceptance.
  - GitHub secret scanning and push protection, which read every push with
    their own list rather than this one. Note that
    `secret_scanning_non_provider_patterns` is disabled on this repository,
    so anything without a known provider format has never been searched for
    on that side — the tree and history tiers above are the only reading it
    has had.
  - Dependency review, which fails a pull request that adds a vulnerable
    package. It is a pull request event and has nothing to say about a
    repository sitting still.

  The judge's machine image is checked by nothing, here or there. It is built
  out of band from `infra/judge-ami/provision.sh`, and re-provisioning is
  manual (ADR-0013).
GAPS

echo
if ((could_not_run)); then
  echo "A tier could not run. This sweep did not finish, and nothing above" >&2
  echo "should be read as a clean result." >&2
  exit 2
fi
if ((found_something)); then
  echo "Findings above. Nothing here has been changed for you: a credential" >&2
  echo "in history is rotated by a person, and history is not rewritten." >&2
  exit 1
fi
echo "No findings in the tiers that ran."
exit 0
