---
name: cleanup-worktree
description: Delete a finished worktree and its branch, local and remote, then pull latest main.
argument-hint: "[worktree or branch name — defaults to the current one]"
disable-model-invocation: true
---

Tear down a worktree whose work has **landed**, and bring `main` up to date.

_Landed_ is the whole gate. Content that lives only in this worktree is gone the moment it is deleted, so every step before the deletion exists to prove the work is somewhere else first. Prove it landed, then delete freely.

## 1. Fetch, so the checks are about now

`git fetch origin --prune`

Every check below reads `origin/main`. A stale ref makes landed work look unlanded, and you will be arguing with a fact that stopped being true an hour ago.

**Done when:** `git rev-parse origin/main` and `git ls-remote origin main` name the same commit.

## 2. Name the target, and write down the SHA

Default to the worktree the session is in and the branch it has checked out; an argument overrides both. Record:

- the worktree path,
- the branch name,
- **the branch tip SHA** — this is the thread back after step 5, so it goes in the final report whether or not anything goes wrong.

**Done when:** all three are written down, and `git worktree list` has told you which _other_ worktrees exist so you can leave them alone.

## 3. Prove it landed

Three proofs, cheapest first. Any one is enough, but reaching for only the first is how work gets destroyed:

| Proof    | Command                                                | Catches                     |
| -------- | ------------------------------------------------------ | --------------------------- |
| Ancestry | `git merge-base --is-ancestor <tip> origin/main`        | merge commits, fast-forward |
| Pull request | `gh pr view <branch> --json state,mergeCommit`     | squash and rebase merges    |
| Content  | `git diff <tip> origin/main -- <paths the branch touched>` | anything, including merges made by hand |

**A squash merge fails the ancestry check while being completely landed.** It is the common case, not the exotic one: main carries one new commit whose SHA the branch has never seen. Ancestry says no; the PR says `MERGED`; the content diff comes back empty. Read all three before concluding a branch is unlanded.

`gh` answering "no pull requests found" is a result rather than a failure: that proof is simply unavailable, so fall through to content.

Then confirm nothing exists _only_ here:

- `git status --porcelain` — empty, or uncommitted work is about to be destroyed.
- `git ls-remote --heads origin <branch>` — **if this is empty the branch was never pushed**, and content is the only proof that can save it. Do not run the next check: `git log origin/<branch>..<branch>` errors on a missing ref rather than returning nothing, and an error read as "no output" is how this skill would talk itself into deleting the one copy.
- `git log origin/<branch>..<branch>` — for a branch that _is_ pushed, empty, or local commits have never reached the remote.

**Done when:** every path the branch touched is accounted for on `origin/main`, or you have stopped and told the user exactly which ones are not. Unlanded work ends the skill here — report it and delete nothing.

## 4. Leave, then remove

You cannot remove the ground you are standing on, so leave the worktree before deleting it.

`ExitWorktree` with `action: "remove"` handles it when this session created the worktree. Expect it to refuse: it counts commits not on the original branch, and a squash-merged branch has all of them, so it will report "N commits will be discarded". After step 3 that refusal is answered — re-invoke with `discard_changes: true`. Those commits are genuinely discarded, which is what a squash merge already decided.

Otherwise remove it from outside: `git -C <main checkout> worktree remove <path>`, adding `--force` for a locked worktree, then `git branch -D <branch>`.

**Done when:** `git worktree list` shows the target gone and every other worktree still there, untouched.

## 5. Delete the remote branch

`git push origin --delete <branch>`

The irreversible step, and the one that takes the branch's granular history with it — a squash-merged PR keeps that history on its own page, but it stops being fetchable. The SHA from step 2 is the way back inside the host's retention window.

**Done when:** `git ls-remote --heads origin <branch>` is empty.

## 6. Pull

`git pull --ff-only origin main`

`--ff-only` so a surprise divergence stops rather than opening a merge nobody asked for.

**Done when:** `git status -sb` shows `main` level with `origin/main`.

## Report

State the SHA, how landing was proven, what was deleted, and which worktrees were deliberately left alone. If the granular history went with the remote branch, say so plainly — it is the one thing the user cannot get back by re-running anything.
