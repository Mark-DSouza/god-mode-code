#!/usr/bin/env bash
#
# Point git at the tracked hooks directory. Run by the `prepare` script, which
# means it runs on every `pnpm install`.
#
# This file exists so that the `prepare` entry in package.json is not an
# unexplained line that silently reconfigures git — which is exactly the sort of
# thing a reviewer should be suspicious of. So, the reasons:
#
#   `.git/hooks` is not tracked and cannot be, so a hook that lives there is a
#   hook that exists on one machine, once, on the laptop of whoever wrote it.
#   Pointing `core.hooksPath` at a directory that *is* tracked is what makes the
#   commit guard travel with the repository, and it does the same job husky does
#   with no dependency — which matters in a repository only about a quarter of
#   which is JavaScript.
#
#   The gap, stated rather than hidden: `prepare` runs on `pnpm install`, so a
#   contributor who only ever touches Go or Java never gets the hook. That is
#   accepted — CI and GitHub's push protection still cover them — and the
#   one-line manual alternative is `git config core.hooksPath .githooks`.
#
# The path is stored relative on purpose. Git runs hooks from the top of the
# working tree, so a relative `core.hooksPath` resolves inside whichever
# worktree the commit is being made in, while an absolute one would point every
# worktree at the checkout that happened to run `pnpm install` first.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

hooks_path=".githooks"

# Not every context that runs `pnpm install` is a git clone: the web image is
# built from a context with `.git` excluded. Installing hooks there is both
# impossible and pointless, so this is a no-op rather than a failure — a build
# must not break over a developer convenience it has no use for.
command -v git >/dev/null 2>&1 || exit 0
git rev-parse --git-dir >/dev/null 2>&1 || exit 0

# Somebody may have pointed this somewhere themselves. Overwriting is still the
# right answer — the guard has to be installed — but doing it without saying so
# would make their hooks disappear with no explanation anywhere.
existing="$(git config --get core.hooksPath || true)"
if [[ -n "$existing" && "$existing" != "$hooks_path" ]]; then
  echo "==> Replacing core.hooksPath: was $existing"
fi

git config core.hooksPath "$hooks_path"
echo "==> Git hooks installed (core.hooksPath = $hooks_path)"
