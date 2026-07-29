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

  **The ask rule is gone, and stays gone.** `ControlFilesAreNotAskedAbout`
  asserts the silence rather than merely omitting the tests that used to
  assert the prompts (ADR-0014). A deletion nothing tests for is a deletion the
  next reader of ADR-0013 undoes, since that ADR still argues for the layer.

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
        # A commit message goes into the repository, which is the thing this
        # rule is protecting. The guard reads the raw command and has no notion
        # of a message flag, so this needs nothing special to hold.
        self.assertDenied(bash(f'git commit -m "rotating {AWS_KEY_ID}"'))

    def test_a_credential_in_a_message_heredoc_is_denied(self) -> None:
        # The same point through the flag prose is actually written with. This
        # outlived the rule it was written against: the message-stripping it
        # was defending was ask-rule machinery, and the credential scan never
        # used it.
        self.assertDenied(bash(f"git commit -F - <<'EOF'\nrotate {AWS_KEY_ID}\nEOF"))

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


class ControlFilesAreNotAskedAbout(GuardTest):
    """The rule that used to live here, asserted as gone (ADR-0014).

    The guard once asked before a call touched `.github/workflows`,
    `.githooks/`, the shared detector or its own settings, and before
    `--no-verify`, a force push or `core.hooksPath`. That layer was removed
    deliberately: the prompts cost more than the layer returned, and ADR-0014
    records what is accepted in exchange for the quiet.

    These are assertions rather than the absence of assertions. Without them
    the deletion is invisible, and the next reader of ADR-0013 — which still
    argues at length for an ask rule — would restore it without ever learning
    it had been weighed and dropped.
    """

    def test_editing_a_control_does_not_ask(self) -> None:
        self.assertNoDecision(edit(".github/workflows/security.yml", "on: push"))
        self.assertNoDecision(edit(".githooks/pre-commit", "exit 0"))
        self.assertNoDecision(edit("scripts/credential_detector.py", "SHAPES = ()"))
        self.assertNoDecision(edit("scripts/claude_code_guard.py", "pass"))
        self.assertNoDecision(edit(".claude/settings.json", "{}"))
        self.assertNoDecision(edit("infra/terraform/tests/security.tftest.hcl", "x = 1"))
        self.assertNoDecision(edit(".github/dependabot.yml", "version: 2"))
        self.assertNoDecision(edit("scripts/install-git-hooks.sh", "exit 0"))

    def test_a_shell_command_touching_a_control_does_not_ask(self) -> None:
        self.assertNoDecision(bash("rm .githooks/pre-commit"))
        self.assertNoDecision(bash("sed -i 's/x//' .claude/settings.json"))
        self.assertNoDecision(bash("cat > .githooks/pre-commit <<'EOF'\nx\nEOF"))
        self.assertNoDecision(
            bash("python3 <<'EOF'\nopen('.githooks/pre-commit','w').write('')\nEOF")
        )

    def test_reading_a_control_does_not_ask(self) -> None:
        # Reads were already silent for the nine allowlisted readers. What
        # changed is that the allowlist no longer has to exist for this to
        # hold, which is what took `sed`, `awk` and `find` out of the prompts.
        self.assertNoDecision(bash("cat .githooks/pre-commit"))
        self.assertNoDecision(bash("sed -n '1,50p' scripts/claude_code_guard.py"))
        self.assertNoDecision(bash("awk '{print}' .githooks/pre-commit"))
        self.assertNoDecision(bash("find .github/workflows -name '*.yml'"))

    def test_routing_around_the_commit_guard_does_not_ask(self) -> None:
        # Accepted in ADR-0014 rather than overlooked. The commit guard is
        # skippable in one flag and nothing here objects, which is the sharpest
        # thing given up: a credential that reached disk by a route the text
        # scan below cannot see is then uncovered until CI or the sweep.
        self.assertNoDecision(bash('git commit --no-verify -m "wip"'))
        self.assertNoDecision(bash('git commit -n -m "wip"'))
        self.assertNoDecision(bash("git push --force origin main"))
        self.assertNoDecision(bash("git config core.hooksPath /dev/null"))
        self.assertNoDecision(bash("gh pr merge 61 --admin"))

    def test_a_credential_on_those_same_calls_is_still_denied(self) -> None:
        # The half that stays, and the reason the class above is not simply
        # deleted: silence about the path is not silence about the content.
        self.assertDenied(edit(".githooks/pre-commit", f'KEY="{AWS_KEY_ID}"'))
        self.assertDenied(bash(f'git commit --no-verify -m "rotating {AWS_KEY_ID}"'))


class WhatTheGuardDoesNotSee(GuardTest):
    """The known gaps, written as observation rather than aspiration.

    Each is a route the guard is documented as not covering, asserted so that
    if the coverage ever changes a test fails and the documentation has to
    follow rather than quietly rotting into a lie.
    """

    def test_a_credential_the_command_generates_rather_than_spells_is_not_seen(self) -> None:
        # The guard reads the command as text, so a credential that only exists
        # once the command has run was never visible to it. This was always the
        # case; what changed with ADR-0014 is what sits behind it, since
        # `--no-verify` is no longer asked about. The commit guard still reads
        # the resulting file on any commit that does not skip it.
        self.assertNoDecision(bash("python3 generate_env.py > .env"))
        self.assertNoDecision(bash("aws sts get-session-token > creds.json"))

    def test_what_covers_the_residue_is_written_down(self) -> None:
        # The gap above is only tolerable because something else reads these
        # changes. This asserts the guard still names what that something is,
        # rather than leaving the gap unattributed.
        source = (REPO_ROOT / "scripts" / "claude_code_guard.py").read_text()
        self.assertIn("commit guard", source)


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
