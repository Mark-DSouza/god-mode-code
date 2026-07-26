# Security findings gate the diff, not the repository

A security check fails a pull request only for what that pull request
introduces. Everything else **alerts**: a scheduled full sweep and the
dependency bot put it in the Security tab, where it is visible to anyone who
looks and blocks nothing. A CVE published on a quiet Tuesday against a package
nobody touched does not turn `main` red; it opens a Dependabot alert. A finding
that was already in the tree does not block an unrelated change.

The alternative fails predictably. A gate that fires on findings unrelated to
the change in front of it is a gate people learn to route around —
`--no-verify`, an administrative merge, a suppression written in a hurry to get
something shipped — and a security control that is routinely bypassed is worse
than no control at all, because it is also believed. Gating on the whole
repository has a second failure the diff-scoped version does not: what
fails is decided by whatever the CVE feeds and rule sets happen to say this
morning, so a pull request that was green at nine can be red at eleven having
changed nothing. The author's only available response is to fix something they
did not break, or to learn the bypass.

## SARIF to code scanning is what makes this uniform

Each scanner uploads its results to GitHub code scanning as SARIF rather than
deciding for itself what counts as new. Code scanning fingerprints the alerts
and computes new-versus-pre-existing per pull request, so diff-scoping is a
property of the mechanism and not something every tool has to implement in its
own idiom — CodeQL over the three languages written here and a misconfiguration
scan over the Terraform arrive at the same behaviour without agreeing on
anything. Nor does a baseline file have to be maintained, which matters more
than it sounds: a baseline lives in the repository, and is therefore edited by
the same pull request that introduces the finding it excuses.

Two things follow from routing through the mechanism rather than the tool. The
gate is code scanning's reading of the diff, not the scanner's exit status — a
scanner that exits non-zero on pre-existing findings fails the job before code
scanning is ever consulted, which is precisely the whole-repository behaviour
being avoided, so scanners report, upload and exit successfully. And a job that
correctly skips, because path filtering decided a stylesheet change cannot have
affected the Go service, must still report a result, or a required check sits
pending forever; `ci.yml`'s aggregate job already solves this and the shape is
reused rather than rediscovered.

Dependency review is the one gate that does not go through SARIF. It reads the
pull request's dependency changes directly and fails when the diff *adds* a
package with a known vulnerability. The exception is in the plumbing only: it
still gates on the change rather than the repository, and all it declines
to look at is Dependabot's alert stream, not this gate's.

## Consequences

**Base images keep floating tags, and the deploy is the patching mechanism.**
Every `FROM` here names a floating tag — `node:24-alpine`,
`maven:3.9-eclipse-temurin-21`, `eclipse-temurin:21-jre-alpine`,
`caddy:2-alpine`, `golang:1.26-alpine` and
`gcr.io/distroless/static-debian12:nonroot` — and images are rebuilt from
scratch on every push to `main`, so OS packages are continuously patched with
no bot and no pull request. Pinning digests would freeze them and *create* the
staleness problem a bot would then exist to solve. Rollback is unaffected: a
built image is immutable in ghcr once pushed and is tagged with the commit that
produced it, so rolling back redeploys an earlier image rather than rebuilding
an earlier `FROM`. Docker is therefore deliberately absent from the Dependabot
ecosystems. This is the decision most likely to be "fixed" by a well-meaning
reviewer who does not realise they are turning off automatic patching.

**Container OS packages are knowingly uncovered.** GitHub's dependency graph
reads manifests, not image layers, so nothing watches the alpine and Debian
packages inside the runtime images. Accepted, for two reasons that hold
together and would not hold apart. The images are small by construction —
alpine for the JVM and the proxy, and `distroless/static` for the judge, which
has essentially no OS packages to have vulnerabilities in — and the application
host accepts no inbound traffic at all, an invariant
`infra/terraform/tests/security.tftest.hcl` asserts on every pull request that
touches the infrastructure, because traffic arrives through the
outbound-initiated tunnel of ADR-0002. A
vulnerable library on a host nothing can dial is a different proposition from
one behind an open port. If a runtime image ever grows a package manager, or
the host ever accepts a connection, this paragraph expires with it.

**The Claude Code hook guards the controls; CI finds the vulnerabilities.** A
hook in `.claude/settings.json` covers one agent in one checkout: it is absent
for every human, for every agent that has never heard of Claude Code, and for
anything pushed from anywhere else. The commit-time git hook covers every
commit whoever makes it, and CI covers every branch and every push. So the
agent hook is not the control that credential detection rests on — the git hook
is — and duplicating CI's scanning inside the agent hook would buy coverage
that is a strict subset of what already exists, at the cost of a second
detection rule list to keep in step. It earns its place by doing what neither
of the others can, which is to fire before the tool runs rather than after the
bytes are written: the difference between a credential that never touched disk
and one that sits in the tree until a commit is attempted, and the difference
between asking a human before the security workflow or the infrastructure
invariants are edited and finding out afterwards that they were. An agent told
to make a check pass can, and will, edit the thing that is failing — and since a
pull request's workflows run as that pull request defines them, CI cannot be
relied on to object to being weakened by the change it is running from.
