#!/usr/bin/env python3
"""
Tests for the Claude Code write guard, driven the way Claude Code drives it.

Every test of the guard's behaviour spawns the real script, writes a real
`PreToolUse` payload to its standard input and reads the decision off its
standard output. Nothing is stubbed and nothing imports a private helper to
assert on it, because the whole contract with Claude Code is a JSON document in
and a JSON document out — a test that reached past that could pass while the
guard was invisible in a live session.

`TheSettingsAndTheGuardAgree` at the bottom is the exception, and is not about
behaviour: it reads the committed configuration and asks whether it still names
this script and the tools this script expects to see. There is no payload to
send for "is the hook wired up at all".

Three things are being held down here, and they fail in different directions:

  **Deny is deny, and it is not routed around.** The credential tests are run
  once per tool that can put bytes on disk, `Bash` included, because an agent
  refused a `Write` will reasonably reach for a heredoc.

  **Ask is ask, and it is not worn down.** Every protected path gets a test,
  and so does an ordinary edit next door to one — a guard that prompts on
  everything is a guard whose prompts stop being read.

  **A guard that cannot run says so.** Malformed input, a missing detector and
  an unrecognised tool each have a test, because the failure this file exists
  to prevent is the one where the guard is absent and its absence looks exactly
  like it having passed.

The last class asserts that `.claude/settings.json` and this script still agree
about which tools are inspected. They are two files that have to be edited
together, and nothing else would notice if they were not.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from typing import Any, NamedTuple

REPO_ROOT = Path(__file__).resolve().parent.parent
GUARD = REPO_ROOT / "scripts" / "claude_code_guard.py"
SETTINGS = REPO_ROOT / ".claude" / "settings.json"

sys.path.insert(0, str(REPO_ROOT / "scripts"))
# After the path insert, which is what makes it importable at all.
import claude_code_guard

# Split at a point that breaks the shape matching it, for the reason given at
# length in `test_credential_detector.py`: this file is committed through the
# guard it tests, and pushed through GitHub's push protection. Do not join the
# halves.
AWS_KEY_ID = "AKIA" + "G1XOLRE4WF6IZD7E"
GITHUB_TOKEN = "ghp_" + "0123456789abcdefghijklmnopqrstuvwxyz"

# An absolute path is what Claude Code actually sends. A checkout somewhere
# else entirely is the point of it: the guard recognises this repository's
# controls by where they sit inside it, not by one machine's directory layout.
CHECKOUT = "/home/someone/src/god-mode-code"


class Decision(NamedTuple):
    """What Claude Code would make of one run of the guard."""

    kind: str | None
    reason: str
    exit_code: int
    stderr: str

    def __str__(self) -> str:
        return f"{self.kind!r} ({self.reason!r}) exit={self.exit_code} stderr={self.stderr!r}"


def decide(tool_name: str, tool_input: dict[str, Any], guard: Path = GUARD) -> Decision:
    """One `PreToolUse` payload in, one decision out."""
    payload = {
        "session_id": "test",
        "transcript_path": "/dev/null",
        "cwd": CHECKOUT,
        "permission_mode": "default",
        "hook_event_name": "PreToolUse",
        "tool_name": tool_name,
        "tool_input": tool_input,
        "tool_use_id": "toolu_test",
    }
    return run_guard(json.dumps(payload), guard)


def run_guard(stdin: str, guard: Path = GUARD) -> Decision:
    result = subprocess.run(
        [sys.executable, str(guard)],
        input=stdin,
        capture_output=True,
        text=True,
        # `CLAUDE_PROJECT_DIR` is set by Claude Code on the hook process. It is
        # deliberately not set here: the guard has to work without it, since a
        # git worktree is a different project root holding the same controls.
        env={k: v for k, v in os.environ.items() if k != "CLAUDE_PROJECT_DIR"},
    )
    if not result.stdout.strip():
        return Decision(None, "", result.returncode, result.stderr)
    emitted = json.loads(result.stdout)["hookSpecificOutput"]
    return Decision(
        emitted["permissionDecision"],
        emitted.get("permissionDecisionReason", ""),
        result.returncode,
        result.stderr,
    )


def write(path: str, content: str) -> tuple[str, dict[str, Any]]:
    return "Write", {"file_path": f"{CHECKOUT}/{path}", "content": content}


def edit(path: str, new_string: str) -> tuple[str, dict[str, Any]]:
    return "Edit", {
        "file_path": f"{CHECKOUT}/{path}",
        "old_string": "before",
        "new_string": new_string,
    }


def bash(command: str) -> tuple[str, dict[str, Any]]:
    return "Bash", {"command": command, "description": "a command"}


class GuardTest(unittest.TestCase):
    def assertDenied(self, call: tuple[str, dict[str, Any]]) -> str:
        decision = decide(*call)
        self.assertEqual("deny", decision.kind, f"expected a deny, got {decision}")
        self.assertEqual(0, decision.exit_code, decision)
        return decision.reason

    def assertAsked(self, call: tuple[str, dict[str, Any]]) -> str:
        decision = decide(*call)
        self.assertEqual("ask", decision.kind, f"expected an ask, got {decision}")
        self.assertEqual(0, decision.exit_code, decision)
        return decision.reason

    def assertNoDecision(self, call: tuple[str, dict[str, Any]]) -> None:
        decision = decide(*call)
        self.assertIsNone(decision.kind, f"expected no decision, got {decision}")
        self.assertEqual(0, decision.exit_code, decision)


class ACredentialIsDenied(GuardTest):
    """The first rule: a credential shape never reaches disk.

    One test per route, because the routes are the point. A guard that watches
    `Write` and `Edit` while `bash -c 'cat > file'` puts the same bytes down is
    a speed bump.
    """

    def test_a_write_carrying_a_credential_is_denied(self) -> None:
        self.assertDenied(write("src/config.ts", f'const key = "{AWS_KEY_ID}";\n'))

    def test_an_edit_carrying_a_credential_is_denied(self) -> None:
        self.assertDenied(edit("src/config.ts", f'const key = "{AWS_KEY_ID}";'))

    def test_a_multi_edit_carrying_a_credential_is_denied(self) -> None:
        self.assertDenied(
            (
                "MultiEdit",
                {
                    "file_path": f"{CHECKOUT}/src/config.ts",
                    "edits": [
                        {"old_string": "a", "new_string": "const timeout = 30;"},
                        {"old_string": "b", "new_string": f'const key = "{AWS_KEY_ID}";'},
                    ],
                },
            )
        )

    def test_a_notebook_edit_carrying_a_credential_is_denied(self) -> None:
        self.assertDenied(
            (
                "NotebookEdit",
                {
                    "notebook_path": f"{CHECKOUT}/analysis.ipynb",
                    "new_source": f'key = "{AWS_KEY_ID}"',
                },
            )
        )

    def test_a_heredoc_carrying_a_credential_is_denied(self) -> None:
        self.assertDenied(
            bash(f"cat > src/config.ts <<'EOF'\nconst key = \"{AWS_KEY_ID}\";\nEOF")
        )

    def test_an_append_carrying_a_credential_is_denied(self) -> None:
        self.assertDenied(bash(f"echo 'AWS_ACCESS_KEY_ID={AWS_KEY_ID}' >> .env"))

    def test_a_credential_reaching_disk_by_any_other_shell_route_is_denied(self) -> None:
        # `printf`, `tee`, python, sed -i: enumerating the ways a shell writes a
        # file is a losing game, so the guard reads the command as text and asks
        # only whether a credential is in it. Which also covers the routes that
        # are not writes at all — a live token has no business being typed into
        # a command line in the first place.
        self.assertDenied(bash(f"printf '%s' '{GITHUB_TOKEN}' | tee token.txt"))
        self.assertDenied(bash(f'curl -H "Authorization: Bearer {GITHUB_TOKEN}" https://api.github.com'))

    def test_a_credential_in_a_commit_message_is_denied(self) -> None:
        # The other two rules stop reading `-m` values, on the grounds that a
        # message goes to a commit rather than to disk. This one does not, and
        # must not: a commit message goes into the repository, which is the
        # thing the credential rule is protecting.
        self.assertDenied(bash(f'git commit -m "rotating {AWS_KEY_ID}"'))

    def test_the_denial_says_what_matched_and_where(self) -> None:
        reason = self.assertDenied(
            write("src/config.ts", f'const a = 1;\nconst key = "{AWS_KEY_ID}";\n')
        )
        self.assertIn("src/config.ts", reason)
        self.assertIn(":2:", reason)
        self.assertIn("AWS access key id", reason)

    def test_the_denial_asks_for_a_placeholder_rather_than_a_retry(self) -> None:
        # Without this the agent's next move is the same write through another
        # tool, which is the loop this rule exists to break.
        reason = self.assertDenied(write("src/config.ts", f'const key = "{AWS_KEY_ID}";\n'))
        self.assertIn("placeholder", reason.lower())

    def test_the_denial_does_not_echo_the_credential(self) -> None:
        # The reason is written into the transcript, which is a file on disk.
        reason = self.assertDenied(write("src/config.ts", f'const key = "{AWS_KEY_ID}";\n'))
        self.assertNotIn(AWS_KEY_ID, reason)

    def test_ordinary_content_is_not_denied(self) -> None:
        self.assertNoDecision(write("src/config.ts", "const timeout = 30;\n"))
        self.assertNoDecision(edit("src/config.ts", "const timeout = 30;"))
        self.assertNoDecision(bash("pnpm --filter @gmc/web test"))

    def test_a_placeholder_is_not_denied(self) -> None:
        # The detector's own judgement, reached through the guard rather than
        # re-decided by it. If these two ever disagree the shared list has been
        # forked, which is the thing that must not happen.
        self.assertNoDecision(write(".env.example", "AWS_ACCESS_KEY_ID=your-key-here\n"))

    def test_a_line_marked_as_a_false_positive_is_not_denied(self) -> None:
        marked = f'const documented = "{AWS_KEY_ID}"; // credential-detector: allow\n'
        self.assertNoDecision(write("docs/example.md", marked))


class TouchingAControlAsks(GuardTest):
    """The second rule: the controls are not quietly weakened.

    Ask rather than deny, and the distinction is the whole design. A hard deny
    would make these files unmaintainable — including by the change that
    installs this guard.
    """

    def test_the_security_workflow_asks(self) -> None:
        self.assertAsked(edit(".github/workflows/security.yml", "on: workflow_dispatch"))

    def test_the_ci_workflow_asks(self) -> None:
        # `ci.yml` is where the credential job lives today, and a pull request's
        # workflows run as that pull request defines them (ADR-0013).
        self.assertAsked(edit(".github/workflows/ci.yml", "  credentials:\n    if: false"))

    def test_the_dependabot_configuration_asks(self) -> None:
        self.assertAsked(edit(".github/dependabot.yml", "updates: []"))

    def test_the_terraform_security_invariants_ask(self) -> None:
        self.assertAsked(
            edit("infra/terraform/tests/security.tftest.hcl", "# assertions removed")
        )

    def test_a_terraform_test_that_is_not_the_security_one_does_not_ask(self) -> None:
        self.assertNoDecision(
            edit("infra/terraform/tests/resilience.tftest.hcl", "# a new assertion")
        )

    def test_the_git_hooks_directory_asks(self) -> None:
        self.assertAsked(edit(".githooks/pre-commit", "exit 0"))

    def test_the_hook_settings_ask(self) -> None:
        self.assertAsked(edit(".claude/settings.json", '{"hooks": {}}'))

    def test_the_guard_script_itself_asks(self) -> None:
        self.assertAsked(edit("scripts/claude_code_guard.py", "sys.exit(0)"))

    def test_the_shared_detector_asks(self) -> None:
        # The wrapper without the thing it calls is not a protected control:
        # emptying the shape list disarms all three enforcement points at once.
        self.assertAsked(edit("scripts/credential_detector.py", "CREDENTIAL_SHAPES = ()"))

    def test_the_hook_installer_asks(self) -> None:
        self.assertAsked(edit("scripts/install-git-hooks.sh", "exit 0"))

    def test_a_new_file_in_a_protected_directory_asks(self) -> None:
        self.assertAsked(write(".githooks/pre-push", "#!/bin/sh\nexit 0\n"))

    def test_ordinary_files_next_door_do_not_ask(self) -> None:
        self.assertNoDecision(edit("scripts/dev.sh", "set -euo pipefail"))
        self.assertNoDecision(edit(".github/ISSUE_TEMPLATE.md", "## What"))
        self.assertNoDecision(edit("infra/terraform/main.tf", "# a resource"))
        self.assertNoDecision(write("src/components/Timer.tsx", "export const Timer = () => null;"))

    def test_a_protected_path_reached_through_a_shell_command_asks(self) -> None:
        # The paths can be edited by shell exactly as easily as by `Edit`, so
        # the same set is read out of the command text.
        self.assertAsked(bash("rm -f .githooks/pre-commit"))
        self.assertAsked(bash("cat > .github/dependabot.yml <<'EOF'\nupdates: []\nEOF"))
        self.assertAsked(bash("sed -i 's/AKIA//' scripts/credential_detector.py"))
        self.assertAsked(bash("git checkout HEAD~5 -- .github/workflows/ci.yml"))

    def test_a_commit_message_naming_a_protected_path_does_not_ask(self) -> None:
        # Naming a control in a commit message is describing the work, not
        # doing it — and it is what the commits that touch these files look
        # like, so reading the message was a prompt on exactly the change the
        # rule most wants a human to read carefully.
        self.assertNoDecision(bash('git commit -m "ci: pin .github/workflows actions"'))
        self.assertNoDecision(bash("git commit -am 'fix: .githooks/pre-commit wording'"))

    def test_a_protected_path_outside_the_message_still_asks(self) -> None:
        self.assertAsked(bash('git commit -m "wip" -- .githooks/pre-commit'))

    def test_a_message_flag_belonging_to_another_program_is_left_alone(self) -> None:
        # Taking the message out only runs where the segment is actually a
        # commit. `-m` means something to plenty of other programs — `sort -m`
        # takes files — and eating their arguments would be a guard reading
        # less than it claims to.
        #
        # `.githooks/pre-commit` is the case that matters, because the path
        # itself contains the word: a looser test for "is this a commit" let
        # the protected path argue itself out of being seen.
        self.assertAsked(bash("sort -m .githooks/pre-commit other"))
        self.assertAsked(bash("python3 -m .github/workflows"))

    def test_a_protected_path_that_is_itself_a_commit_word_asks(self) -> None:
        # `commit-msg` is the standard companion hook to `pre-commit`, so the
        # moment a second hook lands this is a real file. Excluding only the
        # hyphen left it, and any other `commit` inside a path, able to argue
        # the guard out of looking at the command that names it.
        self.assertAsked(bash("sort -m .githooks/commit-msg other"))
        self.assertAsked(bash("cat -m .github/workflows/commit.yml"))

    def test_a_stray_commit_word_does_not_license_the_strip(self) -> None:
        # Asking whether the segment *mentions* a commit was the same mistake
        # twice over: once a path containing the word satisfied it, and once a
        # bare word did. The strip now starts at the subcommand, so a `-m` in
        # front of it — or with no `git commit` at all — is somebody else's.
        self.assertAsked(bash("sort -m .githooks/pre-commit commit"))
        self.assertAsked(bash("git show commit -m .github/workflows/ci.yml"))
        self.assertAsked(bash("git log --format=%s commit -m .githooks/pre-commit"))

    def test_gits_own_options_may_precede_the_subcommand(self) -> None:
        # `commit` has to be the subcommand, but git's own options come first
        # and some of them take a value. Reading those as "not a commit" would
        # put the prompt back on ordinary work.
        self.assertNoDecision(bash('git -c core.quotePath=false commit -m "ci: .github/workflows"'))
        self.assertNoDecision(bash('git --no-pager commit -m "docs: explain -n usage"'))

    def test_a_redirection_after_a_message_is_still_seen(self) -> None:
        # `>` ends a word without being whitespace, so a value that ran to the
        # next space swallowed the redirect target — and the redirection is
        # what truncates the file, not the message.
        self.assertAsked(bash('git commit -m wip>.githooks/pre-commit'))
        self.assertAsked(bash('git commit -m wip>>.github/workflows/ci.yml'))
        self.assertAsked(bash('git commit -m wip<.githooks/pre-commit'))

    def test_an_ordinary_shell_command_does_not_ask(self) -> None:
        self.assertNoDecision(bash("git status --short"))
        self.assertNoDecision(bash("python3 scripts/test_credential_detector.py"))
        self.assertNoDecision(bash("pnpm exec prettier --check ."))

    def test_a_protected_path_in_another_checkout_still_asks(self) -> None:
        # A worktree is a different project root holding the same controls, and
        # this project's agent workflow runs in worktrees. Recognising the
        # controls by their place in the tree rather than by one absolute path
        # is what makes the guard follow them there.
        self.assertAsked(
            (
                "Edit",
                {
                    "file_path": "/home/someone/src/god-mode-code/.claude/worktrees/x/.githooks/pre-commit",
                    "old_string": "before",
                    "new_string": "exit 0",
                },
            )
        )

    def test_a_similarly_named_file_does_not_ask(self) -> None:
        # `.githooks-notes` is not inside `.githooks`, and
        # `test_credential_detector.py` is not `credential_detector.py`.
        self.assertNoDecision(edit(".githooks-notes/README.md", "notes"))
        self.assertNoDecision(edit("scripts/test_credential_detector.py", "# a new fixture"))


class RoutingAroundTheCommitGuardAsks(GuardTest):
    """The other half of the second rule: satisfying the gate, not skipping it.

    `--no-verify` and a force push are the two ways to get past the commit
    guard rather than through it, and an agent told to make CI pass will find
    both without being told about either.
    """

    def test_no_verify_asks(self) -> None:
        self.assertAsked(bash('git commit --no-verify -m "wip"'))

    def test_the_short_form_of_no_verify_asks(self) -> None:
        self.assertAsked(bash('git commit -n -m "wip"'))
        self.assertAsked(bash('git commit -nm "wip"'))

    def test_a_force_push_asks(self) -> None:
        self.assertAsked(bash("git push --force origin main"))
        self.assertAsked(bash("git push -f origin main"))
        self.assertAsked(bash("git push --force-with-lease"))
        self.assertAsked(bash("git push origin +main:main"))

    def test_a_refspec_force_push_without_a_destination_asks(self) -> None:
        # `+main` is the ordinary short form and forces exactly as hard as
        # `+main:main`. A rule that required the colon read the second and
        # waved the first through.
        self.assertAsked(bash("git push origin +main"))
        self.assertAsked(bash("git push origin +refs/heads/main"))

    def test_a_bypass_written_across_a_line_continuation_asks(self) -> None:
        # Segmenting on newlines is what keeps `git push -n` apart from
        # `git commit -n`, and a backslash continuation is the one newline that
        # is not a separator — it put `push` and `--force` in different
        # segments, where no rule anchored on the subcommand could see them.
        self.assertAsked(bash("git push origin main \\\n  --force"))
        self.assertAsked(bash("git commit \\\n  --no-verify \\\n  -m 'wip'"))

    def test_an_abbreviated_no_verify_asks(self) -> None:
        # Git accepts any unambiguous prefix of a long option.
        self.assertAsked(bash('git commit --no-veri -m "wip"'))
        self.assertAsked(bash('git commit --no-verif -m "wip"'))

    def test_gits_other_no_ver_option_does_not_ask(self) -> None:
        # `--no-verbose` is a real git option and has nothing to do with the
        # hooks. Matching it would not just prompt for no reason: it would tell
        # the human their command was skipping the commit hooks, which is a
        # false statement in the one message the rule exists to deliver.
        # `--no-ver` is the prefix where the two stop being distinguishable,
        # and git refuses it as ambiguous rather than running it.
        self.assertNoDecision(bash('git commit --no-verbose -m "wip"'))

    def test_an_abbreviation_shaped_flag_to_something_else_does_not_ask(self) -> None:
        # The abbreviation rule is scoped to git for this reason.
        self.assertNoDecision(bash("pnpm --filter @gmc/web test --no-verbose"))

    def test_a_commit_message_that_talks_about_a_bypass_does_not_ask(self) -> None:
        # The message is on its way to a commit, not to disk. Before the
        # message value was taken out of what these rules read, every one of
        # these prompted — and they are the shape of ordinary commits on a
        # branch that works on the guards.
        self.assertNoDecision(bash('git commit -m "docs: explain -n usage"'))
        self.assertNoDecision(bash('git commit -am "note the --no-verify escape"'))
        self.assertNoDecision(bash("git commit --message='force-push notes'"))

    def test_a_message_value_does_not_swallow_the_next_command(self) -> None:
        # Taking the message out is text deletion, and an unquoted value that
        # ran to the next space deleted past the `&` that ends the command:
        # `curl -m 5&git commit --no-veri` lost the `git` the abbreviation rule
        # is anchored on, and the bypass went through silently. `&` and not `;`
        # because a `;` already splits the segment before any of this runs.
        self.assertAsked(bash("curl -m 5&git commit --no-veri"))
        self.assertAsked(bash("curl -m 5 && git commit --no-verify -m 'wip'"))
        self.assertAsked(bash("curl -m x;git commit --no-veri"))

    def test_a_bypass_bundled_with_the_message_flag_still_asks(self) -> None:
        # `-nm "wip"` is `-n` and `-m` written together. Taking the message out
        # has to leave the `-n` behind, which the first version of it did not.
        self.assertAsked(bash('git commit -nm "wip"'))
        self.assertAsked(bash("git commit -anm 'wip'"))

    def test_a_bypass_outside_the_message_still_asks(self) -> None:
        # Taking the message out must not take the rest of the command with it.
        self.assertAsked(bash('git commit -m "docs: explain -n usage" --no-verify'))
        self.assertAsked(bash('git commit --no-verify -m "note the -n flag"'))

    def test_repointing_the_hooks_directory_asks(self) -> None:
        self.assertAsked(bash("git config core.hooksPath /dev/null"))
        self.assertAsked(bash("git config --unset core.hooksPath"))

    def test_an_administrative_merge_asks(self) -> None:
        self.assertAsked(bash("gh pr merge 36 --admin --squash"))

    def test_an_ordinary_commit_does_not_ask(self) -> None:
        self.assertNoDecision(bash('git commit -m "an ordinary commit"'))
        self.assertNoDecision(bash('git commit -am "another"'))

    def test_an_ordinary_push_does_not_ask(self) -> None:
        self.assertNoDecision(bash("git push origin my-branch"))
        self.assertNoDecision(bash("git push -u origin my-branch"))

    def test_a_dry_run_push_does_not_ask(self) -> None:
        # `-n` is `--no-verify` to `git commit` and `--dry-run` to `git push`.
        # A guard that read them the same way would prompt on the most harmless
        # command in the set.
        self.assertNoDecision(bash("git push -n origin main"))

    def test_a_merge_without_admin_does_not_ask(self) -> None:
        self.assertNoDecision(bash("gh pr merge 36 --squash"))


class WhatTheGuardDoesNotSee(GuardTest):
    """The known gaps, one test each, in the style of `WhatTheHookSees`.

    Written as observation rather than aspiration. Every one of these is a
    route the guard is documented as not covering, and asserting them means
    that if the coverage ever changes a test fails and the comment saying so
    has to follow, rather than quietly rotting into a lie.
    """

    def test_a_protected_path_reached_through_a_glob_is_not_seen(self) -> None:
        # `protected_in_command` matches the path as written. Closing this
        # means expanding the shell, which means running it.
        self.assertNoDecision(bash("rm .githook?/pre-commit"))
        self.assertNoDecision(bash("truncate -s0 .github/work*/ci.yml"))

    def test_a_bypass_assembled_rather_than_written_is_not_seen(self) -> None:
        # The flag never appears as text, so nothing short of running the
        # command would find it.
        self.assertNoDecision(bash('git commit "--no-$(echo verify)" -m "wip"'))

    def test_a_substitution_that_still_spells_it_out_is_seen(self) -> None:
        # The other half of the pair above, and the reason the comment in the
        # guard distinguishes them: this one is caught, but by where the
        # characters happen to land rather than by understanding the shell.
        self.assertAsked(bash('git commit $(echo --no-verify) -m "wip"'))

    def test_what_covers_the_residue_is_written_down(self) -> None:
        # The tests above are only tolerable because something else reads these
        # changes. For a credential that is the commit guard; for the protected
        # paths it is a human reading the diff, since the commit guard reads
        # content rather than which files a change touches. Both are stated in
        # the guard, and this asserts the statement is still there.
        source = (REPO_ROOT / "scripts" / "claude_code_guard.py").read_text()
        self.assertIn("no commit-time backstop", source)


class WhenBothRulesApply(GuardTest):
    def test_a_credential_written_into_a_protected_path_is_denied(self) -> None:
        # Deny outranks ask. Prompting a human to approve writing a credential
        # is offering them a decision they should never be asked to make.
        self.assertDenied(edit(".githooks/pre-commit", f'KEY="{AWS_KEY_ID}"'))


class WhenTheGuardCannotDecide(GuardTest):
    """A guard that fails has to fail towards a human, not towards silence."""

    def test_a_tool_it_does_not_inspect_gets_no_decision(self) -> None:
        # Emitting `allow` here would be the real bug: it approves the call
        # outright, past every permission rule the user has configured. The
        # guard's silence is what leaves the normal flow intact.
        self.assertNoDecision(("Read", {"file_path": f"{CHECKOUT}/README.md"}))
        self.assertNoDecision(("Grep", {"pattern": "AKIA"}))

    def test_the_guard_never_emits_allow(self) -> None:
        for call in (
            write("src/config.ts", "const timeout = 30;\n"),
            write("src/config.ts", f'const key = "{AWS_KEY_ID}";\n'),
            edit(".githooks/pre-commit", "exit 0"),
            ("Read", {"file_path": f"{CHECKOUT}/README.md"}),
        ):
            self.assertNotEqual("allow", decide(*call).kind, call)

    def test_malformed_input_asks_rather_than_passing(self) -> None:
        decision = run_guard("not json at all")
        self.assertEqual("ask", decision.kind, decision)
        self.assertEqual(0, decision.exit_code, decision)

    def test_a_payload_missing_its_tool_input_asks_rather_than_passing(self) -> None:
        decision = run_guard(json.dumps({"tool_name": "Write"}))
        self.assertEqual("ask", decision.kind, decision)

    def test_a_missing_detector_asks_rather_than_passing(self) -> None:
        # The guard is one file away from being disarmed by a rename. If the
        # shared detector is not importable it must say so, because a guard
        # that quietly stops inspecting looks exactly like a guard that found
        # nothing.
        with tempfile.TemporaryDirectory() as directory:
            lonely = Path(directory) / "scripts"
            lonely.mkdir()
            shutil.copy2(GUARD, lonely / GUARD.name)
            decision = decide(*write("src/config.ts", "const timeout = 30;\n"), guard=lonely / GUARD.name)
        self.assertEqual("ask", decision.kind, decision)
        self.assertIn("credential_detector", decision.reason)


class TheSettingsAndTheGuardAgree(unittest.TestCase):
    """Two files that have to be edited together, and one that notices.

    The configuration is what makes the guard exist at all. It is tracked
    rather than local, because an untracked settings file is absent inside the
    worktrees this project's agent workflow uses — which is exactly where agent
    work happens, and its absence there would be indistinguishable from it
    passing.
    """

    def setUp(self) -> None:
        self.settings = json.loads(SETTINGS.read_text())
        matchers = self.settings["hooks"]["PreToolUse"]
        self.assertEqual(1, len(matchers), "one entry, so there is one place to read")
        self.entry = matchers[0]

    def test_the_settings_are_tracked(self) -> None:
        tracked = subprocess.run(
            ["git", "ls-files", "--error-unmatch", str(SETTINGS.relative_to(REPO_ROOT))],
            cwd=REPO_ROOT,
            capture_output=True,
            text=True,
        )
        self.assertEqual(0, tracked.returncode, f"{SETTINGS} is not tracked: {tracked.stderr}")

    def test_the_guard_is_tracked(self) -> None:
        tracked = subprocess.run(
            ["git", "ls-files", "--error-unmatch", str(GUARD.relative_to(REPO_ROOT))],
            cwd=REPO_ROOT,
            capture_output=True,
            text=True,
        )
        self.assertEqual(0, tracked.returncode, f"{GUARD} is not tracked: {tracked.stderr}")

    def test_the_matcher_names_exactly_the_tools_the_guard_inspects(self) -> None:
        configured = set(self.entry["matcher"].split("|"))
        self.assertEqual(
            set(claude_code_guard.INSPECTED_TOOLS),
            configured,
            "the matcher and the guard disagree about which tools are inspected: "
            "a tool the guard reads but the matcher omits is never asked about",
        )

    def test_the_configured_command_is_the_guard_that_exists(self) -> None:
        # The exec form with `args`, which is what the documentation recommends
        # for a `${CLAUDE_PROJECT_DIR}` path and what was verified against
        # Claude Code 2.1.220 by running it: a probe hook configured this way
        # fired, received the expanded path as `argv[1]`, and had its decision
        # honoured. Asserted rather than tolerated, because the failure mode of
        # getting this wrong is a hook that never runs — which is the one
        # failure indistinguishable from a hook that passed.
        (hook,) = self.entry["hooks"]
        self.assertEqual("command", hook["type"])
        self.assertEqual("python3", hook["command"])
        self.assertEqual([f"${{CLAUDE_PROJECT_DIR}}/scripts/{GUARD.name}"], hook["args"])


if __name__ == "__main__":
    unittest.main()
