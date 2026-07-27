# Security findings gate the diff, not the repository

A security check fails a pull request only for what that pull request
introduces. Everything else **alerts**: it lands in the Security tab, it is
visible to anyone who looks, and it blocks nothing. A CVE published on a quiet
Tuesday against a package nobody touched does not turn `main` red; it opens a
Dependabot alert. A finding that was already in the tree does not block an
unrelated change.

The alternative fails predictably. A gate that fires on findings unrelated to
the change in front of it is a gate people learn to route around —
`--no-verify`, an administrative merge, a suppression written in a hurry to get
something shipped — and a security control that is routinely bypassed is worse
than no control at all, because it is also believed. Gating on the whole
repository has a second failure the diff-scoped version does not: what fails is
decided by whatever the CVE feeds and rule sets happen to say this morning, so
a pull request that was green at nine can be red at eleven having changed
nothing. The author's only available response is to fix something they did not
break, or to learn the bypass.

The alert tier is not a consolation prize, and it has to be fed deliberately.
If every check only ever reads a change, then code nobody has touched since it
was written is never looked at again, and dependency review — which only fires
on a pull request event — cannot cover the gap. So a scheduled analysis of
everything reports into the Security tab on its own cadence, and fails nothing
when it does.

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

None of which makes suppression illegitimate — the two are opposites. A
suppression attached to one resource, naming the decision it encodes, is an
argument a reader can check and disagree with; an exclusion written across the
whole repository is indistinguishable from having no scanner at all.

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
pull request's dependency changes directly and fails when the diff _adds_ a
package with a known vulnerability. The exception is in the plumbing only: it
still gates on the change rather than the repository, and everything it leaves
alone — packages already there, and CVEs published against packages the diff
never touched — belongs to Dependabot rather than to this gate.

## Consequences

**Base images keep floating tags, and the deploy is the patching mechanism.**
The deploy builds two images, and what ships from them is a floating tag:
`eclipse-temurin:21-jre-alpine` under the application and `caddy:2-alpine`
under the proxy. Both are rebuilt on every push to `main`, so the OS packages
that actually run are patched continuously with no bot and no pull request. The
builder stages above them — `maven:3.9-eclipse-temurin-21` and `node:24-alpine`
— float for the same reason but matter less, since nothing they contain reaches
production. Pinning digests would freeze the runtime layer and _create_ the
staleness problem a bot would then exist to solve. Rollback is unaffected:
every build is tagged with the commit that produced it, so rolling back
redeploys an earlier image rather than rebuilding an earlier `FROM`. This is
the decision most likely to be "fixed" by a well-meaning reviewer who does not
realise they are turning off automatic patching.

Docker is therefore deliberately absent from the Dependabot ecosystems, and the
reason is worth stating, because the exclusion otherwise looks like an
oversight. Everything the ecosystem can see here is either already patched by
the rebuild — the application's tags and the proxy's — or never deployed:
`apps/judge/Dockerfile` is local-only by its own first line, and the
`postgres:17-alpine` in the compose files is development scaffolding, since
production runs RDS. The one image where staleness genuinely accrues is
`python:3.13-alpine`, and it is named in a shell variable rather than a `FROM`,
which is exactly what the ecosystem cannot see. Configured here, the bot would
open pull requests about everything except the thing that matters.

The judge is the exception, and it is the one to watch. It runs as a host
process from a machine image built out of band (ADR-0005,
`infra/judge-ami/provision.sh`), and the freeze is the whole image: the Amazon
Linux base and the packages `provision.sh` installs on it, plus
`python:3.13-alpine` — the image every sandbox container starts from, and the
only image here that ever holds hostile code. All of it is fixed as of the day
that machine image was taken. Re-provisioning is the patching mechanism, it is
manual, and nothing prompts for it. That is a real gap rather than a decision,
and it is recorded here so it is not mistaken for one.

**Container OS packages are knowingly uncovered.** GitHub's dependency graph
reads manifests, not image layers, so nothing watches the alpine packages
inside the images that run, nor the packages on the judge's own host. Accepted,
for two reasons that hold together and would not hold apart. The images are
small by construction — alpine for the JVM, the proxy and the sandbox — and
neither host is reachable from anywhere it should not be. The application
accepts no inbound traffic at all, an invariant
`infra/terraform/tests/security.tftest.hcl` asserts on every pull request that
touches the infrastructure, because traffic arrives through the
outbound-initiated tunnel of ADR-0002; the judge accepts one port from the
application's security group and has no egress and no credentials at all
(ADR-0005). A vulnerable library on a host nothing can dial is a different
proposition from one behind an open port — and on the judge, where hostile code
is inside by design rather than by accident, it is the containment ADR-0005
builds that does this work, not the currency of a package list. If the runtime
images ever stop being minimal, or either host ever accepts a connection from
somewhere new, this paragraph expires with it.

**The commit guard is the control; the Claude Code hook keeps the controls from
being quietly weakened; CI finds the vulnerabilities.** A hook in
`.claude/settings.json` covers one agent in one checkout: it is absent for
every human, for every agent that has never heard of Claude Code, and for
anything pushed from anywhere else. The commit guard — a git hook — covers
every commit, no matter who or what makes it, and CI covers every pull request
and everything that reaches `main`. So credential detection does not rest on
the Claude Code hook, and duplicating CI's scanning inside it would buy
coverage that is a strict subset of what already exists, at the cost of a
second detection rule list to keep in step. The Claude Code hook earns its
place by doing what neither of the others can, which is to fire before the tool
runs rather than after the bytes are written: the difference between a
credential that never touched disk and one that sits in the tree until a commit
is attempted, and the difference between asking a human before the security
workflow or the infrastructure invariants are edited and finding out afterwards
that they were. An agent told to make a check pass can, and will, edit the
thing that is failing — and since a pull request's workflows run as that pull
request defines them, CI cannot be relied on to object to being weakened by the
change it is running from.
