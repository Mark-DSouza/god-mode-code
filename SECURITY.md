# Security Policy

## Reporting

Use GitHub's [**Report a vulnerability**][report] button rather than opening an
issue. This repository is public, and an issue publishes a working exploit
before there is a fix.

One maintainer, spare time. Expect an acknowledgement within a week and a fix
when I get to it — worth more than promising 24 hours and missing it.

## Scope

The list is dated rather than complete: it is what
`godmodecode.markdsouza.dev` exposed as of this file's last change, which is
recognition and Run integrity.

- **Being recognised as another User** — obtaining a Recognition Key from
  outside the browser whose `gmc_recognition` cookie holds it, or otherwise
  being handed someone else's Handle and their Runs.
- **Recording a Run that should not exist** — getting a Typing Run past
  Verification with metrics it did not earn, or consuming an Issue that was
  replayed, expired, or handed to someone else.

Judging is not in scope yet. It executes arbitrary submitted source, but nothing
on the internet reaches it: there is no Pattern submission endpoint, and the
judge sits in a private subnet reachable only from the api's security group. It
joins the list above on the day the Solve Run path opens.

[report]: https://github.com/Mark-DSouza/god-mode-code/security/advisories/new
