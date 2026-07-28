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

| Control                              | Fires when                              | Gate or alert        |
| ------------------------------------ | --------------------------------------- | -------------------- |
| Claude Code write guard              | before a mutating tool call             | gate (deny or ask)   |
| Commit hook (`.githooks/pre-commit`) | `git commit`, on the added lines        | gate (refuses)       |
| CodeQL, Trivy (`security.yml`)       | pull request, push to `main`, weekly    | gate on new only     |
| Dependency review                    | a pull request that adds a dependency   | gate                 |
| Dependabot alerts                    | a CVE lands, whenever that happens      | alert                |
| Dependabot version updates           | monthly, one pull request per ecosystem | neither              |
| `pnpm security:sweep`                | you run it                              | neither — it reports |

The write guard is wired to `Bash`, `Edit`, `MultiEdit`, `NotebookEdit` and
`Write` — every tool that can put bytes on disk, the shell included.

CodeQL and Trivy upload SARIF and always exit successfully. What fails a pull
request is code scanning's own **Code scanning results** check, which fires only
on alerts the diff introduced. A red check there is never about pre-existing
findings, and never about the repository being unhealthy.

## When something fires

### A write is denied: "This would write a credential into the repository"

The write guard matched a credential shape in content about to hit disk. The
message names the shape and the line.

**Do:** write a placeholder and read the real value from the environment.

**Do not** reach for another tool. Every mutating tool is inspected, the shell
included — `bash -c 'cat > file'` is read as content and refused on the spot,
not waved through to be caught at commit time.

### A commit is refused: "a staged change carries a credential"

Same detector, reading the added lines of the staged diff. Same remedy: value
into the environment, placeholder in the file, commit again.

Two other refusals share the prefix and are not findings at all. "needs python3,
which is not on PATH" wants an interpreter; "the credential guard could not run"
means the detector itself failed, and the traceback is printed underneath it.
Both fail loudly on purpose — a guard that passes when it could not run is worse
than none — and neither is answered by skipping the hook.

### A prompt on a protected path

The write guard asks — it never refuses — when a call touches something whose
weakening would disarm a control. `PROTECTED_PATHS` in
`scripts/claude_code_guard.py` is the list, and it currently holds the
workflows, `dependabot.yml`, `infra/terraform/tests/security.tftest.hcl`,
`.githooks/`, the detector, the hook installer, and the guard and its settings.

**A human decides.** Say what the change is and why it does not weaken the
control, and let them approve it. Editing one of these to make a failing check
go green is the exact move the prompt exists to catch.

Reading is mostly free: a fixed allowlist of readers — `cat`, `grep`, `git
diff`, `git log` and about twenty others — goes through untouched. Anything
outside it prompts, and so does a reader carrying a redirect, since `cat x >
.githooks/pre-commit` truncates the commit hook using nothing but a reader.

If the approved change is to a workflow, keep every `uses:` pinned to a commit
SHA with its `# vX.Y.Z` comment beside it. Dependabot rewrites the pair
together; a tag in there is a moving target nobody reviews again.

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
missing — Trivy needs `trivy` on `PATH` or Docker to run it, `govulncheck` needs
the Go toolchain — reports **not run**, which is not the same as clean and does
not change the exit status.

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

The marker anywhere on the line silences that line for the write guard, the
commit hook and the sweep's tree tier at once, since they all call the same
detector. Placeholders in `.example` files are already understood and need no
marker.

The sweep's **history** tier is the exception, and marking cannot clear it: it
reads blobs as they were committed, and the blob that carried the line is still
what it was. A credential in history has been published — rotate it. If it was
never a credential, that tier is a report rather than a gate, and nothing is
blocked while it stays on the list.

A Terraform finding has its own marker: a `#trivy:ignore:AVD-…` comment on the
resource, naming the decision that bought it. The ones already in
`infra/terraform/` are the worked examples.

Marking is a supported action with a reviewable diff. Bypassing is not an
alternative to it: `--no-verify` skips every line rather than the one you argued
about, and leaves nothing behind for a reviewer to disagree with.

## If you find a real vulnerability

Not an issue on the tracker — this repository is public, and an issue publishes
a working exploit before there is a fix. Use GitHub's **Report a vulnerability**
button; `SECURITY.md` has the link and the scope.

## The judgement layer already exists

`/security-review` reviews the pending changes for vulnerabilities, and `/cso`
covers the same layer more broadly. Both live in the agent tooling rather than
in this repository, and they read a change the way a reviewer would — which is
the one thing the shape lists and rule sets above cannot do.

Point at them. Do not write a third one here.
