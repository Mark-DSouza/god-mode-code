#!/usr/bin/env bash
#
# CI gate: regenerate the contract and the typed client, then fail if either
# differs from what is committed.
#
# The failure this exists to prevent is a backend response shape changing while
# the frontend keeps compiling against the old types — which type checking
# cannot catch, because both sides are internally consistent. The contract is
# the only place the mismatch is visible.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

"$repo_root/scripts/generate-contract.sh"

# `git status --porcelain`, not `git diff`: diff compares tracked files only, so
# a newly generated file that nobody has committed yet shows up as clean and the
# gate passes on a contract that was never checked in at all.
drift="$(git status --porcelain -- packages/api-client)"

if [[ -n "$drift" ]]; then
  echo
  echo "The API contract is out of date." >&2
  echo "The backend serves a different document than the one committed." >&2
  echo >&2
  echo "$drift" >&2
  echo >&2
  git --no-pager diff --stat -- packages/api-client >&2
  echo >&2
  echo "Run scripts/generate-contract.sh and commit the result." >&2
  exit 1
fi

echo "==> Contract is in sync"
