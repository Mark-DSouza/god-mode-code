#!/usr/bin/env python3
"""
The Claude Code write guard: two rules, both firing before the tool runs.

This is not the control. The commit guard in `.githooks/pre-commit` is, and CI
is what finds the vulnerabilities; this covers one agent in one checkout and is
absent for every human and for every agent that has never heard of Claude Code
(ADR-0013). It earns its place by being the only one of the three that runs
*before* the bytes exist:

  **A credential shape is denied.** The same detector the commit guard uses,
  moved one step earlier — the difference between a secret that never touched
  disk and one that sits in the tree until a commit is attempted. It also
  covers what GitHub's push protection does not, since
  `secret_scanning_non_provider_patterns` is disabled on this repository and
  anything not matching a known provider format is invisible to it.

  **Touching a control asks.** An agent told to make CI pass can, and will,
  edit the thing that is failing. With a security gate required on the branch,
  "weaken the gate until it goes green" is a plausible route to a green check
  and one nobody plans for. This puts a human in front of it.

Deny for credentials and ask for controls, and the asymmetry is deliberate. A
credential shape is always wrong, and Claude should be told so plainly enough
that it writes a placeholder instead of trying the next tool. A hard deny on
the control files would make them unmaintainable — including by the change that
installed this guard — so ask puts a human in the loop without locking anyone
out.

`Bash` is inspected alongside the file tools, and that is the difference
between a guard and a speed bump: an agent refused a `Write` will reasonably
reach for `bash -c 'cat > file <<EOF'`, which puts the same bytes down without
touching either file tool. The protected paths go the same way.

Two things this file must keep doing:

  **It never emits `allow`.** `allow` approves the call outright, past every
  permission rule the user has configured — a guard that returned it on the
  happy path would silently disable the user's own settings for every write in
  the repository. Nothing to say means say nothing: exit 0 with empty output
  and the normal permission flow proceeds untouched.

  **It fails towards a human.** Malformed input, a missing detector, an
  unexpected exception: all of them ask. A guard that quietly stops inspecting
  looks exactly like a guard that inspected and found nothing, and that is the
  failure this whole ticket exists to avoid.

Configured in `.claude/settings.json`, which is committed rather than local —
an untracked settings file would not exist inside the git worktrees this
project's agent workflow uses, so the guard would be absent exactly where agent
work happens. `scripts/test_claude_code_guard.py` holds the two files to
agreeing about which tools are inspected.

No third-party dependencies and no interpreter but python3, for the same reason
the detector has none: this runs on every mutating tool call, and a guard
people wait on is a guard that gets turned off.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path, PurePosixPath
from typing import Any, Iterable, NamedTuple

# The tools that can put bytes on disk. `scripts/test_claude_code_guard.py`
# asserts that the matcher in `.claude/settings.json` names exactly these — a
# tool this file reads but the matcher omits is a tool the guard is never
# invoked for, and nothing else would notice.
#
# `MultiEdit` is listed for the Claude Code versions that still ship it.
# Naming a tool that does not exist costs nothing; omitting one that does is
# the hole.
INSPECTED_TOOLS = ("Bash", "Edit", "MultiEdit", "NotebookEdit", "Write")


class Protected(NamedTuple):
    """One path whose weakening is worth a prompt, and why it is on the list."""

    path: str
    # A directory protects everything beneath it. A file protects only itself.
    directory: bool
    why: str


# Kept short on purpose. Prompt fatigue is the failure mode of asking too
# often, and a prompt nobody reads is worse than no prompt, so this is the set
# that genuinely weakens the posture rather than everything security-adjacent.
PROTECTED_PATHS: tuple[Protected, ...] = (
    # The whole directory rather than the one security workflow, because a pull
    # request's workflows run as that pull request defines them: CI cannot be
    # relied on to object to being weakened by the change it is running from
    # (ADR-0013). `ci.yml` is also where the credential job lives today.
    Protected(
        ".github/workflows",
        True,
        "the CI definition — the gate, as supplied by the change it is gating",
    ),
    Protected(".github/dependabot.yml", False, "the dependency update configuration"),
    # The invariant that the application accepts no inbound traffic at all,
    # which is what ADR-0013's argument about uncovered container packages
    # rests on. Its sibling tests are not here; only this one is load-bearing.
    Protected(
        "infra/terraform/tests/security.tftest.hcl",
        False,
        "the infrastructure security invariants",
    ),
    Protected(".githooks", True, "the commit-time guard, which is the actual control"),
    # The wrapper without the thing it calls is not a protected control:
    # emptying the shape list disarms all three enforcement points at once.
    Protected("scripts/credential_detector.py", False, "the shared credential detector"),
    # A guard nobody installs guards nothing.
    Protected("scripts/install-git-hooks.sh", False, "the commit guard's installer"),
    Protected(".claude/settings.json", False, "the hook configuration itself"),
    Protected("scripts/claude_code_guard.py", False, "this guard"),
)

# `package.json` is deliberately absent, though its `prepare` entry is what
# runs the installer. It is edited by ordinary dependency work several times a
# ticket, and CI already fails when that line goes missing — see the "install
# lifecycle still runs the installer" step in `.github/workflows/ci.yml`.


class Bypass(NamedTuple):
    """One way to get past the commit guard rather than through it."""

    name: str
    regex: re.Pattern[str]


def _bypass(name: str, regex: str) -> Bypass:
    return Bypass(name, re.compile(regex))


# Read against one shell segment at a time, because `-n` means one thing to
# `git commit` and something else entirely to `git push`, and that distinction
# is lost the moment the whole command line is treated as a bag of words.
#
# None of this survives a determined shell — `git commit $(echo --no-verify)`
# defeats any parse short of running it. It does not have to: this is a
# prompt on the obvious spelling of a thing nobody does by accident, and the
# commit guard is what covers the case where somebody means it.
BYPASSES: tuple[Bypass, ...] = (
    _bypass("skipping the commit hooks", r"--no-verify\b"),
    # The short form, and only for `commit`: `git push -n` is a dry run, which
    # is the most harmless command in the set.
    _bypass("skipping the commit hooks", r"\bcommit\b(?:\s+\S+)*?\s+-[A-Za-z]*n"),
    _bypass("force-pushing", r"\bpush\b(?:\s+\S+)*?\s+(?:--force\b|--force-with-lease\b|-[A-Za-z]*f)"),
    # A leading `+` on a refspec is a force push spelled without a flag.
    _bypass("force-pushing", r"\bpush\b(?:\s+\S+)*?\s+\+\S+:\S+"),
    _bypass("repointing git's hooks directory", r"\bcore\.hooksPath\b"),
    _bypass("merging past the required checks", r"\bmerge\b(?:\s+\S+)*?\s+--admin\b"),
)

# Shell separators, used only to keep the rules above from reading a flag in
# one command as belonging to another.
SEGMENTS = re.compile(r"(?:\|\||&&|[;|\n])")

DECISION_TEMPLATE = "hookSpecificOutput"


def emit(decision: str, reason: str) -> None:
    """The only thing Claude Code reads. Exit 0 or the JSON is ignored."""
    print(
        json.dumps(
            {
                DECISION_TEMPLATE: {
                    "hookEventName": "PreToolUse",
                    "permissionDecision": decision,
                    "permissionDecisionReason": reason,
                }
            }
        )
    )


def _path_regex(entry: Protected) -> re.Pattern[str]:
    """The entry as it appears inside a shell command.

    Bounded on both sides so `.githooks-notes/` is not `.githooks`, and so a
    protected file's name is not matched inside a longer one. The left side
    permits `/`, since an absolute path is the ordinary way to write these.
    """
    return re.compile(r"(?<![\w-])" + re.escape(entry.path) + r"(?![\w.-])")


PROTECTED_IN_COMMAND = tuple((entry, _path_regex(entry)) for entry in PROTECTED_PATHS)


def protected_by(path: str) -> Protected | None:
    """Which control, if any, this path is part of.

    Matched on trailing path segments rather than against one absolute root,
    because a git worktree is a different project root holding the same
    controls — and worktrees are where this project's agent work happens. The
    cost of that choice is a prompt on an unrelated repository's `.githooks`,
    which is a prompt rather than a refusal.
    """
    parts = tuple(part for part in PurePosixPath(path.replace("\\", "/")).parts if part != "/")
    for entry in PROTECTED_PATHS:
        wanted = tuple(PurePosixPath(entry.path).parts)
        for start in range(len(parts) - len(wanted) + 1):
            if parts[start : start + len(wanted)] != wanted:
                continue
            # A file entry has to be the path itself; a directory entry covers
            # everything below it.
            if entry.directory or start + len(wanted) == len(parts):
                return entry
    return None


def protected_in_command(command: str) -> Protected | None:
    """The same set, read out of a shell command.

    Deliberately not an attempt to work out whether the command writes. That
    analysis is exactly what an agent routes around — `python3 -c "open(...)"`
    is not a write to anything watching for redirections — and being asked
    about a `cat` of a protected file is a cheaper mistake than not being asked
    about a `sed -i` of one.
    """
    for entry, regex in PROTECTED_IN_COMMAND:
        if regex.search(command):
            return entry
    return None


def bypass_in_command(command: str) -> Bypass | None:
    for segment in SEGMENTS.split(command):
        for candidate in BYPASSES:
            if candidate.regex.search(segment):
                return candidate
    return None


class Written(NamedTuple):
    """What a tool call would put on disk: some content, at some path."""

    path: str
    content: str


def written_by(tool: str, tool_input: dict[str, Any]) -> Iterable[Written]:
    """The content and paths a call would write, per tool.

    A tool that is not recognised yields nothing, which is how the guard stays
    silent for `Read` and `Grep` instead of guessing at them.
    """
    if tool == "Write":
        yield Written(str(tool_input["file_path"]), str(tool_input.get("content", "")))
    elif tool == "Edit":
        yield Written(str(tool_input["file_path"]), str(tool_input.get("new_string", "")))
    elif tool == "MultiEdit":
        path = str(tool_input["file_path"])
        for one in tool_input.get("edits", []):
            yield Written(path, str(one.get("new_string", "")))
    elif tool == "NotebookEdit":
        yield Written(str(tool_input["notebook_path"]), str(tool_input.get("new_source", "")))
    elif tool == "Bash":
        # The whole command, path and content at once. A credential in a
        # command line is worth refusing wherever in it it appears.
        command = str(tool_input.get("command", ""))
        yield Written(command, command)


def readable(path: str, cwd: str) -> str:
    """The path as a person reading the transcript would write it."""
    try:
        return str(Path(path).relative_to(cwd))
    except ValueError:
        return path


def decide(payload: dict[str, Any]) -> tuple[str, str] | None:
    """The decision, or None to leave the normal permission flow alone."""
    tool = str(payload.get("tool_name", ""))
    if tool not in INSPECTED_TOOLS:
        return None
    tool_input = payload["tool_input"]
    if not isinstance(tool_input, dict):
        raise TypeError(f"tool_input for {tool} is {type(tool_input).__name__}, not an object")

    # Imported here rather than at the top so that its absence becomes an ask
    # rather than a traceback — and a traceback is a non-blocking hook error,
    # which is to say a tool call that proceeds.
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    try:
        import credential_detector
    except ImportError as error:
        raise RuntimeError(f"the shared credential_detector is not importable: {error}") from error

    cwd = str(payload.get("cwd", ""))
    writes = list(written_by(tool, tool_input))

    # Deny outranks ask, and is therefore decided first. Prompting a human to
    # approve writing a credential into the commit guard is offering them a
    # decision nobody should be asked to make.
    for written in writes:
        where = "the command" if tool == "Bash" else readable(written.path, cwd)
        findings = credential_detector.scan_text(where, written.content)
        if findings:
            return "deny", denial(findings, credential_detector.ALLOW_MARKER)

    for written in writes:
        if tool == "Bash":
            bypass = bypass_in_command(written.content)
            if bypass:
                return "ask", routing_around(bypass)
            hit = protected_in_command(written.content)
            named = hit.path if hit else ""
        else:
            hit = protected_by(written.path)
            named = readable(written.path, cwd)
        if hit:
            return "ask", weakening(named, hit)
    return None


def denial(findings: Iterable[Any], allow_marker: str) -> str:
    """What Claude is told, which decides what it does next.

    Naming the shape and the line is what turns this from a refusal into an
    instruction; saying that the other routes are covered too is what stops
    the next move being the same write through a different tool.
    """
    lines = "\n".join(f"  {finding.render()}" for finding in findings)
    return (
        "This would write a credential into the repository, and it is refused:\n"
        f"{lines}\n\n"
        "Do not reach for another tool — the same check runs on Write, on Edit, "
        "on Bash and again at commit time. Write a placeholder instead and read "
        "the real value from the environment. If this is genuinely not a "
        f"credential, mark the line with `{allow_marker}` and say why."
    )


def weakening(named: str, entry: Protected) -> str:
    return (
        f"`{named}` is {entry.why}. Changing it is a decision for a human rather "
        "than a way to make a check pass. Say what the change is and why it does "
        "not weaken the control, and let them approve it."
    )


def routing_around(bypass: Bypass) -> str:
    return (
        f"This command is {bypass.name}, which routes around the commit guard "
        "rather than satisfying it. Fix what the guard is objecting to, or get a "
        "human to approve the bypass."
    )


def main() -> int:
    try:
        payload = json.load(sys.stdin)
        decision = decide(payload)
    except Exception as error:  # noqa: BLE001 — see the module docstring
        # Everything unexpected asks. The alternative is a guard that is absent
        # in a way that looks identical to a guard that passed.
        emit(
            "ask",
            f"The repository's write guard could not run, so this call was not "
            f"inspected: {type(error).__name__}: {error}. Approving it skips the "
            f"credential and control-file checks.",
        )
        return 0

    if decision:
        emit(*decision)
    return 0


if __name__ == "__main__":
    sys.exit(main())
