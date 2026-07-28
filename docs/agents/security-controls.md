# Security Controls

What fires, what it means, and what to do about it. The reasoning behind the
arrangement is
[ADR-0013](../adr/0013-security-findings-gate-the-diff-not-the-repository.md)
and is not repeated here.

## The shape of it

One credential detector — `scripts/credential_detector.py`, one list of shapes
— is called from three enforcement points: the Claude Code write guard, the
commit hook, and the sweep. Change the shape list and all three change
together; that is why it is one file.

Everything else splits in two. A **gate** reads the change in front of it and
can fail it. An **alert** reads the whole repository, lands in the Security tab,
and fails nothing. Which one you are looking at tells you what is expected of
you: a gate says _this diff introduced something_, an alert says _this
repository contains something_, and only the first is yours to fix right now.

| Control                              | Fires when                               | Gate or alert        |
| ------------------------------------ | ---------------------------------------- | -------------------- |
| Claude Code write guard              | before a `Write`/`Edit`/`Bash` tool runs | gate (deny or ask)   |
| Commit hook (`.githooks/pre-commit`) | `git commit`, on the added lines         | gate (refuses)       |
| CodeQL, Trivy (`security.yml`)       | pull request, push to `main`, weekly     | gate on new only     |
| Dependency review                    | a pull request that adds a dependency    | gate                 |
| Dependabot                           | a CVE lands, whenever that happens       | alert                |
| `pnpm security:sweep`                | you run it                               | neither — it reports |

CodeQL and Trivy upload SARIF and always exit successfully. What fails a pull
request is code scanning's own **Code scanning results** check, which fires only
on alerts the diff introduced. A red check there is never about pre-existing
findings, and never about the repository being unhealthy.

## When something fires

### A write is denied: "This would write a credential into the repository"

The write guard matched a credential shape in content about to hit disk. The
message names the shape and the line.

**Do:** write a placeholder and read the real value from the environment.

**Do not** reach for another tool. The same detector runs on `Write`, on `Edit`,
on `Bash` and again at commit time, so `bash -c 'cat > file'` reaches the same
refusal one step later.

### A commit is refused: "a staged change carries a credential"

Same detector, reading the added lines of the staged diff. Same remedy: value
into the environment, placeholder in the file, commit again.

"The credential guard could not run" is a different message and a different
problem — usually no `python3` on `PATH`. Fix the interpreter. The guard fails
loudly on purpose; a guard that passes when it could not run is worse than none.

### A prompt on a protected path

The write guard asks — it never refuses — when a call touches something whose
weakening would disarm a control:

- `.github/workflows/` — the gates, as supplied by the change they gate
- `.github/dependabot.yml`
- `infra/terraform/tests/security.tftest.hcl` — the no-inbound-traffic invariant
- `.githooks/` — the commit hook
- `scripts/credential_detector.py` — the shared detector
- `scripts/install-git-hooks.sh` — the installer
- `.claude/settings.json`, `scripts/claude_code_guard.py` — the guard itself

**A human decides.** Say what the change is and why it does not weaken the
control, and let them approve it. Editing one of these to make a failing check
go green is the exact move the prompt exists to catch. Reading these files does
not prompt — `cat`, `grep`, `git diff` and friends are allowed through.

### A prompt on a command that routes around the guard

`--no-verify`, a force push, `core.hooksPath`, `gh pr merge --admin`. The guard
asks rather than refuses, because a human may legitimately need one.

**Fix what the guard objected to.** Do not ask for the bypass as a way of
getting past a finding — see [False positives](#false-positives) for the
supported way through.

### A security gate fails on a pull request

The diff introduced it. Open the **Code scanning results** check, read the alert
it names, fix the code. Two specific ones:

- **Dependency review** fails when the diff _adds_ a package with a known
  vulnerability, at severity `low` and above. The remedy is a different version
  or a different package, decided now while it is cheap. It never fires on
  packages already here.
- **The `security` job** is an aggregate; it is red because something upstream
  of it was. Read the job that actually failed.

A Dependabot alert is not one of these. It blocks nothing and is not something
to fix inside an unrelated change.

## The whole-repository scan

```sh
pnpm security:sweep     # or ./scripts/security-sweep.sh
```

Four tiers: every tracked file, every blob any commit ever held, Trivy over the
Terraform and Dockerfiles, `govulncheck` over the judge. Exit `0` nothing found,
`1` something found, `2` the sweep could not finish. A tier whose tooling is
missing — Trivy wants Docker, `govulncheck` wants Go — reports **not run**,
which is not the same as clean and does not change the exit status.

It reports and never remediates. Rotating a credential can break the running
deploy, and history is not rewritten; both are a person's decision.

**What it cannot see**, and the sweep says so itself every time:

- CodeQL and dependency review, which run in `security.yml` on GitHub, not here
- Dependabot alerts, GitHub's secret scanning, and push protection
- Container OS packages, in the images and on the judge's host — covered by
  nothing, deliberately (ADR-0013)
- The judge's machine image, which is patched by re-provisioning, manually,
  with nothing prompting for it

Run it after touching anything security-shaped, or before a release. Nothing in
CI runs it, and wiring it into a pull request would recreate the
whole-repository gate ADR-0013 refuses.

## Installing the commit hook without the JavaScript toolchain

`pnpm install` runs `scripts/install-git-hooks.sh` through `prepare`, which
points `core.hooksPath` at the tracked `.githooks/`. A contributor who only ever
touches Go or Java never runs it. The one-line alternative:

```sh
git config core.hooksPath .githooks
```

Check it took:

```sh
git config --get core.hooksPath     # .githooks
```

Relative, not absolute — git resolves it inside whichever worktree the commit is
made in, and agent work here happens in worktrees.

## False positives

The detector matches unambiguous shapes only, so a false positive is rare and is
a normal thing to deal with rather than an emergency. Mark the line and say why:

```
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE  # credential-detector: allow — AWS's own docs example
```

The marker anywhere on the line silences that line for every enforcement point
at once, since they all call the same detector. Placeholders in `.example` files
are already understood and need no marker.

Marking a line is a supported action with a reviewable diff. Bypassing is not an
alternative to it: `--no-verify` skips every line rather than the one you argued
about, and leaves nothing behind for a reviewer to disagree with.

## The judgement layer already exists

`/security-review` reviews the pending changes for vulnerabilities, and `/cso`
covers the same layer more broadly. Both live in the agent tooling rather than
in this repository, and they read a change the way a reviewer would — which is
the one thing the shape lists and rule sets above cannot do.

Point at them. Do not write a third one here.
