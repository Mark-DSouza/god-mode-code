# The write guard checks credentials only

The Claude Code write guard shipped with two rules: deny a credential shape,
and ask a human before a call touches a control — the workflows, `.githooks/`,
the shared detector, the guard's own settings — or spells `--no-verify`, a
force push, `core.hooksPath` or `gh pr merge --admin`. The second rule is
removed. The guard now denies credentials and is otherwise silent.

The prompts cost more than the layer returned. That judgement is the whole
decision, and it is a judgement rather than a finding: the ask rule worked as
designed, and the cost of it working was a prompt on every action taken while
working on a control — which, for eleven consecutive commits, was all of the
work. It had already been narrowed twice for the same reason, once to stop it
prompting on reads and once to admit the readers whose names settle it, and it
was still the dominant interruption. A third narrowing was available and was
not taken, because the thing being bought back each time was smaller than the
machinery buying it: the reader allowlist, the shell-segment splitter, the
commit-message stripping and the bypass table existed only to keep this rule
from firing on ordinary work, and they are gone with it. The guard went from
624 lines to 214, and its tests from 851 to 444.

## What is accepted in exchange

These are consequences that were weighed and taken, not gaps that were missed.
ADR-0013 argues for the layer being removed here and is worth reading first;
what follows is what changes if you do.

**Nothing now asks before a control is weakened.** ADR-0013's argument stands
and is not disputed — an agent told to make a check pass can and will edit the
thing that is failing, and CI cannot object to being weakened by the change it
is running from, since a pull request's workflows run as that pull request
defines them. What covers it now is a human reading the diff before merging.
That is weaker than it sounds: `required_approving_review_count` is `0` on this
repository, so nothing _requires_ the reading, and auto-merge is enabled, so
`gh pr merge --auto` is an unattended path to `main` for a pull request that
weakened a gate. Both were considered and left as they are; the practice of
merging by hand is what stands in for the mechanism.

Making every check a required one does not close this, and is worth stating
because it looks as though it would. A **skipped** required check counts as
satisfied — `security.yml`'s aggregate accepts `skipped` alongside `success` by
design, since that is how path filtering reports "this diff could not have
affected the Go service" — so required means _must not fail_ rather than _must
run_. The job deciding what skips is the `changes` filter, which lives in the
same workflow file a pull request can edit: filter your own change out and the
scan skips, the aggregate is content, and the branch is green with nothing
having run. Requiring the checks makes the honest cases legible and leaves this
one exactly where it was.

**`git commit --no-verify` is silent.** The commit guard remains the control
and still runs on every commit that does not skip it, but skipping it is now
one flag and no prompt.

**A credential that a command generates rather than spells is uncovered until
CI.** The guard scans command text, so `python3 gen.py > .env` was never
visible to it; the commit guard was the backstop, and the line above is why
that backstop is now optional. `pnpm security:sweep` and CI still read the
result.

## The half that stays

The credential deny is untouched, and it is the half that never had to be
narrowed — it has not produced a false positive in this repository, so it costs
nothing to keep. It also does something neither the commit guard nor CI can:
it fires before the bytes exist, which is the difference between a secret that
never touched disk and one that sits in the tree until a commit is attempted.
And it covers what GitHub's push protection does not, since
`secret_scanning_non_provider_patterns` is disabled here and anything not
matching a known provider format is invisible to it.

`scripts/test_claude_code_guard.py` asserts the _silence_ — that editing a
control, reading one with `sed`, and spelling `--no-verify` all produce no
decision — rather than merely omitting the tests that used to assert the
prompts. A deletion that nothing tests for is a deletion the next reader of
ADR-0013 quietly undoes.
