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
}

# Four outcomes, each with the flag it sets alongside the words it prints. The
# words and the signal are set together and never derived from each other: a
# summary line reworded for readability must not be able to change what the
# sweep exits with.
# The words are a parameter because "no findings" is a claim, and not every
# tool is in a position to make it. govulncheck's success means "nothing you
# call is vulnerable", which is a smaller statement than "nothing is wrong".
clean() { record "$1" "${2:-no findings}"; }

found() {
  record "$1" "findings"
  found_something=1
}

not_run() { record "$1" "not run — $2"; }

# The sweep's own failure, as opposed to a tier's finding. Reported and then
# carried to the exit status, so a run where one tier broke is never mistaken
# for a clean one.
broke() {
  record "$1" "COULD NOT RUN — $2"
  could_not_run=1
}

# classify TIER STATUS FOUND_STATUS FAILURE [WORDS FOR SUCCESS]
#
# The one place a tool's exit status is turned into an outcome, because every
# tool here uses a different number for "found something" and the mapping is
# the part that is silently wrong when it is wrong. Anything that is neither
# success nor that number is a failure, loudly: the alternative is a scanner
# that broke being reported as a scanner that was satisfied.
classify() {
  local tier="$1" status="$2" found_status="$3" failure="$4" success="${5:-}"
  if [[ "$status" -eq 0 ]]; then
    clean "$tier" "$success"
  elif [[ "$status" -eq "$found_status" ]]; then
    found "$tier"
  else
    broke "$tier" "$failure (exit $status)"
  fi
}

# Asked separately from the question below it, because `git rev-parse` failing
# and `git` not being installed produce the same empty answer and want
# opposite responses from the reader.
if ! command -v git >/dev/null 2>&1; then
  echo "The sweep reads a git repository, and git is not on PATH." >&2
  exit 2
fi

repo_root="$(git rev-parse --show-toplevel 2>/dev/null)"
if [[ -z "$repo_root" ]]; then
  echo "The sweep reads a git repository, and this is not one." >&2
  echo "Run it from inside a checkout of this project." >&2
  exit 2
fi
cd "$repo_root" || exit 2

# Resolved from the repository being swept rather than from this script's own
# location: what is scanned and what scans it come from the same checkout, so
# a sweep never reports one repository's findings using another's shape list.
detector="$repo_root/scripts/credential_detector.py"
if [[ ! -f "$detector" ]]; then
  echo "The credential detector is not at $detector." >&2
  echo "Two of the four tiers are that file, so this is not a sweep." >&2
  exit 2
fi

# Failing loudly is the right default for a control, and the same argument the
# commit hook makes: a sweep that quietly reports nothing when its interpreter
# is missing is worse than no sweep, because everyone believes it ran.
if ! command -v python3 >/dev/null 2>&1; then
  echo "The sweep needs python3, which is not on PATH." >&2
  exit 2
fi

# The credential tiers read exit 1 as "found something", and a python process
# that died before scanning anything exits 1 too — a traceback, a syntax
# error, an import that is not there. So the detector is asked a question it
# cannot find anything in, and its answers are only believed if it gets that
# one right. Milliseconds, and it is the difference between a broken scan and
# a scan that reports credentials nobody can find.
if ! echo "" | python3 "$detector" --stdin --as preflight >/dev/null 2>&1; then
  echo "The credential detector could not answer a scan of nothing:" >&2
  echo "" | python3 "$detector" --stdin --as preflight >&2
  echo >&2
  echo "Nothing below would have been trustworthy, so nothing below ran." >&2
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
classify "tree" $? 1 "the credential detector failed"

# ---------------------------------------------------------------------------
# History: every blob any commit ever held.
#
# The one thing no working tree shows and no edit to a working tree fixes. A
# credential deleted from a file is still in the commit that carried it, and on
# a public repository that means it is in every clone anyone has taken.
# ---------------------------------------------------------------------------
heading "History: every blob ever committed"
python3 "$detector" --history
classify "history" $? 1 "the credential detector failed"

# ---------------------------------------------------------------------------
# Infrastructure misconfiguration, over the Terraform and the Dockerfiles.
#
# Findings here are the input to triage rather than the output of it: some of
# what Trivy reports about this repository's Terraform is a deliberate cost
# decision — a single-AZ database, no cross-region replication — and writing
# the suppressions that say so is a separate piece of work. Severity is not
# filtered for the same reason: the point is to see the list.
#
# ---------------------------------------------------------------------------
heading "Infrastructure: misconfiguration in the Terraform and the Dockerfiles"

# `--exit-code 2` rather than the more obvious 1, and that is the difference
# between a report and a rumour: Trivy exits 1 on its own fatal errors, so
# asking it to also exit 1 on findings makes a scanner that crashed
# indistinguishable from a scanner that found something — and the crash is the
# one that prints nothing.
#
# `**/node_modules` rather than `node_modules`, which matches only the one at
# the top: this workspace has six.
trivy_arguments=(config --exit-code 2 --skip-dirs '**/node_modules' .)

# The scan itself is repository-wide — the Dockerfiles under `apps/` and the
# compose files are misconfiguration surface too — but it is gated on the
# Terraform being here, because that is the substance of the tier and a run
# over a repository with none of it would report "clean" having read nothing.
if [[ ! -d "$repo_root/infra" ]]; then
  not_run "infrastructure" "there is no infra/ in this repository"
elif command -v trivy >/dev/null 2>&1; then
  # Preferring a local `trivy` to the container is not only about speed: the
  # container needs the repository bind-mounted into it, which a machine
  # running Docker in a VM does not always make possible.
  trivy "${trivy_arguments[@]}"
  classify "infrastructure" $? 2 "trivy failed"
elif command -v docker >/dev/null 2>&1; then
  # Read-only mount: a scanner has no business writing here, and Trivy keeps
  # its cache inside the container rather than in the repository.
  docker run --rm \
    --volume "$repo_root:/repo:ro" \
    --workdir /repo \
    "$TRIVY_IMAGE" "${trivy_arguments[@]}"
  status=$?
  # Docker's own three, and they all mean the container never started — a
  # stopped daemon, an image that could not be pulled, an entrypoint that is
  # not there. That says nothing at all about this repository, so it is a tier
  # that did not run rather than a sweep that failed.
  #
  # Deliberately these three and not "anything above 125": 137 is a container
  # that started and was killed, most likely for memory, and a scan that died
  # half way through is a failure rather than a skip.
  case $status in
  125 | 126 | 127)
    not_run "infrastructure" "Docker could not run $TRIVY_IMAGE (exit $status)"
    ;;
  *)
    classify "infrastructure" "$status" 2 "trivy failed"
    ;;
  esac
else
  not_run "infrastructure" "needs trivy, or Docker to run $TRIVY_IMAGE"
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
  # Installed into a throwaway directory and then run, rather than `go run`,
  # which is the obvious way to write this and is wrong. govulncheck exits 3
  # when it finds a reachable vulnerability; `go run` reports that as its own
  # exit 1, and a 1 here is indistinguishable from the tool having failed —
  # so the one outcome this tier exists for would be recorded as "did not
  # run", and the sweep would exit 0 having found a live vulnerability.
  #
  # The version is pinned so it is visible in the diff when it moves. The
  # install reaches the network, so no network is a tier that did not run
  # rather than a tier that found nothing.
  # Guarded, because an unset GOBIN does not mean "install nowhere" — it means
  # install into the user's `~/go/bin`, which is not this script's to write to.
  if ! gobin="$(mktemp -d)"; then
    not_run "go" "there was nowhere to install govulncheck"
  elif ! GOBIN="$gobin" go install "$GOVULNCHECK"; then
    not_run "go" "govulncheck could not be fetched — no network, or no module cache"
    rm -rf "$gobin"
  else
    (cd "$repo_root/apps/judge" && "$gobin/govulncheck" ./...)
    # Not "no findings". govulncheck exits 0 with vulnerabilities on the
    # screen when they are in modules this code does not call — worth knowing,
    # and worth not overstating.
    classify "go" $? 3 "govulncheck failed" "no reachable vulnerabilities"
    rm -rf "$gobin"
  fi
fi

# ---------------------------------------------------------------------------
# The summary, and then the part that matters more: what this could not see.
# ---------------------------------------------------------------------------
echo
echo "Summary"
if ((${#tier_names[@]})); then
  for index in "${!tier_names[@]}"; do
    printf '  %-16s %s\n' "${tier_names[$index]}" "${tier_outcomes[$index]}"
  done
fi

# Dated rather than complete, in the idiom SECURITY.md uses for the same
# reason: this describes what was true of the repository's settings when this
# file last changed, and the commands are here so a reader can check rather
# than believe. Nothing below is queried at run time — the sweep works with no
# network and no GitHub credentials, and a coverage statement that silently
# degraded to "unknown" would be worse than one that can be checked.
cat <<'GAPS'

What this run did not check, and could not
  Some of the posture only exists on GitHub's side. This sweep says nothing
  about any of it, and a run that ended without saying so would overstate
  itself.

  Running, and covering what this does not:

  - GitHub secret scanning and push protection, which read every push with
    their own list rather than this one. But `secret_scanning_non_provider_
    patterns` is disabled here, so anything without a known provider format
    has never been read by that side at all — the tree and history tiers
    above are the only reading it has ever had. Validity checks are off too,
    so a hit there does not tell you whether the credential still works.
  - Dependabot alerts, over declared dependencies. Security tab, under
    Dependabot. Container OS packages are covered by nothing, which ADR-0013
    records as a deliberate acceptance rather than an oversight.

  Named in ADR-0013 and NOT configured on this repository as of this file's
  last change — so nothing is doing this today, here or there:

  - CodeQL. Code scanning's default setup is not enabled and there is no
    CodeQL workflow, so no source analysis has ever run over the three
    languages written here.
  - Dependency review, which would fail a pull request that adds a
    vulnerable package. There is no workflow for it.

  Check both rather than trusting this paragraph:

    gh api repos/OWNER/REPO/code-scanning/default-setup --jq .state
    gh api repos/OWNER/REPO --jq .security_and_analysis

  The judge's machine image is checked by nothing either. It is built out of
  band from `infra/judge-ami/provision.sh`, and re-provisioning is manual
  (ADR-0013).
GAPS

echo
# Both are said when both are true. The exit status can only carry one of
# them, and the incomplete run wins — a caller that reads 1 as "these are the
# findings" would be reading a partial list as a whole one. Swallowing the
# findings to say so would be the worse error, so they are printed either way.
if ((found_something)); then
  echo "Findings above. Nothing here has been changed for you: a credential" >&2
  echo "in history is rotated by a person, and history is not rewritten." >&2
fi
if ((could_not_run)); then
  echo "A tier could not run. This sweep did not finish, and nothing above" >&2
  echo "should be read as a clean result." >&2
  exit 2
fi
if ((found_something)); then
  exit 1
fi
echo "No findings in the tiers that ran."
exit 0
