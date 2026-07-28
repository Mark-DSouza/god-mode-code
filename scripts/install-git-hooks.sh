#!/bin/sh
#
# Point git at the tracked hooks directory. Run by the `prepare` script, which
# means it runs on every `pnpm install`.
#
# POSIX sh rather than the `#!/usr/bin/env bash` the other scripts here use,
# and that is a found-the-hard-way deviation rather than a preference: `pnpm
# install` runs `prepare` inside the web image's build too, and node:24-alpine
# ships no bash. The script has nothing in it that wants a shell that large.
#
# This file exists at all so that the `prepare` entry in package.json is not an
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
set -eu

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repo_root"

hooks_path=".githooks"

# Not every context that runs `pnpm install` is a git clone: the web image is
# built from a context with `.git` excluded. Installing hooks there is both
# impossible and pointless, so this is a no-op rather than a failure — a build
# must not break over a developer convenience it has no use for.
#
# It says so rather than exiting quietly. A control that skips itself in
# silence is indistinguishable from one that ran, and this script has exactly
# one job to be wrong about.
#
# The two reasons are reported separately because they are not the same
# situation, and the image build hits the first one: saying "not a git
# repository" on a machine that simply has no git installed sends whoever is
# reading the build log looking in the wrong place.
if ! command -v git >/dev/null 2>&1; then
  echo "==> No git on PATH, so no git hooks to install"
  exit 0
fi

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "==> Not a git repository, so no git hooks to install"
  exit 0
fi

# The success message below has to mean something. Git ignores a
# `core.hooksPath` pointing at a directory that is not there, without a word,
# so announcing success without looking would just move the silence one step
# along.
#
# Unlike the checks above, this one is fatal, and `prepare` failing fails the
# whole `pnpm install`. That is deliberate and it is safe: the no-git cases
# have already returned, so reaching this line means a real clone of this
# repository that has lost a tracked, executable file. There is no reading of
# that which should end in a working install.
if [ ! -x "$hooks_path/pre-commit" ]; then
  echo "Cannot install git hooks: $hooks_path/pre-commit is missing or not executable." >&2
  exit 1
fi

# Somebody may have pointed this somewhere themselves. Overwriting is still the
# right answer — the guard has to be installed — but doing it without saying so
# would make their hooks disappear with no explanation anywhere.
existing="$(git config --get core.hooksPath || true)"
if [ -n "$existing" ] && [ "$existing" != "$hooks_path" ]; then
  echo "==> Replacing core.hooksPath: was $existing"
fi

git config core.hooksPath "$hooks_path"
echo "==> Git hooks installed (core.hooksPath = $hooks_path)"
