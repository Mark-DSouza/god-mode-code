#!/usr/bin/env bash
#
# Point git at the tracked hooks directory. Run by the `prepare` script, which
# means it runs on every `pnpm install`.
#
# This file exists so that the `prepare` entry in package.json is not an
# unexplained line that silently reconfigures git — which is exactly the sort
# of thing a reviewer should be suspicious of. So, the reasons:
#
#   The commit guard has to cover every commit in every clone and every
#   worktree, by every human and every agent. A hook that has to be installed
#   by hand is a hook that is installed on one machine, once, by the person who
#   wrote it.
#
#   `.git/hooks` is not tracked and cannot be. Pointing `core.hooksPath` at a
#   directory that *is* tracked is what makes the hook travel with the
#   repository, and it does the same job husky does with no dependency — which
#   matters in a repository that is only about a quarter JavaScript.
#
#   The gap, stated rather than hidden: `prepare` runs on `pnpm install`, so a
#   contributor who only ever touches Go or Java never gets the hook. That is
#   accepted — CI and GitHub's push protection still cover them — and the
#   one-line manual alternative is:
#
#       git config core.hooksPath .githooks
#
# The path is relative on purpose. Git runs hooks from the top of the working
# tree, so a relative `core.hooksPath` resolves inside whichever worktree the
# commit is being made in, while an absolute one would point every worktree at
# the checkout that happened to run `pnpm install` first.
set -euo pipefail

# Not every context that runs `pnpm install` is a git clone: the web image is
# built from a context with `.git` excluded. Installing hooks there is both
# impossible and pointless, so this is a no-op rather than a failure — a build
# must not break over a developer convenience it has no use for.
command -v git >/dev/null 2>&1 || exit 0
git rev-parse --git-dir >/dev/null 2>&1 || exit 0

git config core.hooksPath .githooks
echo "==> Git hooks installed (core.hooksPath = .githooks)"
