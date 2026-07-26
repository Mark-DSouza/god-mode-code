# Security Policy

## Reporting

Use GitHub's [**Report a vulnerability**][report] button rather than opening an
issue. This repository is public, and an issue publishes a working exploit
before there is a fix.

One maintainer, spare time. Expect an acknowledgement within a week and a fix
when I get to it — which is worth more than promising 24 hours and missing it.

## In scope

What `godmodecode.markdsouza.dev` actually exposes today, which is the
authentication and Run-integrity surface:

- **Acting as another User** — claiming someone else's Handle, or obtaining a
  Recognition Key from outside the browser whose `gmc_recognition` cookie holds
  it.
- **Recording a Run that should not exist** — getting a Typing Run past
  Verification with metrics it did not earn, replaying an Issue, or spending an
  Issue that was granted to someone else.

## Not in scope yet

Judging executes arbitrary submitted source, but nothing on the internet reaches
it: there is no Pattern submission endpoint, and the judge sits in a private
subnet reachable only from the api. Until the Solve Run work lands there is no
path from a browser to code execution, and it moves to the list above on the day
there is.

That list is dated rather than complete — it describes the site as of this
file's last change.

[report]: https://github.com/Mark-DSouza/god-mode-code/security/advisories/new
