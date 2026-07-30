#!/usr/bin/env python3
"""
The Claude Code write guard: one rule, firing before the tool runs.

**A credential shape is denied.** The same detector the commit guard uses,
moved one step earlier — the difference between a secret that never touched
disk and one that sits in the tree until a commit is attempted. It also covers
what GitHub's push protection does not, since
`secret_scanning_non_provider_patterns` is disabled on this repository and
anything not matching a known provider format is invisible to it.

That is the whole of it. This is not the control: the commit guard in
`.githooks/pre-commit` is, and CI is what finds the vulnerabilities. This
covers one agent in one checkout and is absent for every human and for every
agent that has never heard of Claude Code (ADR-0013).

There was a second rule, and its removal is the thing most likely to be
mistaken for an oversight. Touching a protected control — the workflows,
`.githooks/`, the detector, this file — used to ask, as did `--no-verify`, a
force push, `core.hooksPath` and `gh pr merge --admin`. ADR-0014 removed it and
is where the reasoning and the accepted exposures live; ADR-0013 still argues
for the layer and carries a pointer to ADR-0014 beside the paragraph that no
longer holds. Read ADR-0014 before restoring any of it.

What follows from having only one rule: nothing here reads the shell. The
command is scanned as raw text and asked only whether a credential is in it,
which is why there is no segment splitter, no reader allowlist and no
commit-message stripping in this file — every one of those existed to stop the
ask rule firing on ordinary work. The gap that leaves is stated plainly: a
credential the command *generates* rather than spells (`python3 gen.py > .env`)
is not visible to a text scan, and is caught by the commit guard on any commit
that does not skip it, and by CI and `pnpm security:sweep` regardless.

`Bash` is inspected alongside the file tools, and that is the difference
between a guard and a speed bump: an agent refused a `Write` will reasonably
reach for `bash -c 'cat > file <<EOF'`, which puts the same bytes down without
touching either file tool.

Two things this file must keep doing:

  **It never emits `allow`.** `allow` approves the call outright, past every
  permission rule the user has configured — a guard that returned it on the
  happy path would silently disable the user's own settings for every write in
  the repository. Nothing to say means say nothing: exit 0 with empty output
  and the normal permission flow proceeds untouched.

  **It fails towards a human.** Malformed input, a missing detector, an
  unexpected exception: all of them ask. A guard that quietly stops inspecting
  looks exactly like a guard that inspected and found nothing, and that is the
  failure this file exists to avoid.

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
import sys
from pathlib import Path
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


def emit(decision: str, reason: str) -> None:
    """The only thing Claude Code reads. Exit 0 or the JSON is ignored."""
    print(
        json.dumps(
            {
                "hookSpecificOutput": {
                    "hookEventName": "PreToolUse",
                    "permissionDecision": decision,
                    "permissionDecisionReason": reason,
                }
            }
        )
    )


class Written(NamedTuple):
    """What a tool call would put on disk.

    A shell command is content and destination at once, and `is_command` is
    what says so. Without it `path` would have to hold a command line for the
    `Bash` case — a field lying about what it holds, which every later reader
    then has to un-lie by asking which tool it came from.
    """

    content: str
    # The file this would be written to. Empty for a shell command, where the
    # destination is wherever the command decides to put it.
    path: str = ""
    is_command: bool = False


def written_by(tool: str, tool_input: dict[str, Any]) -> Iterable[Written]:
    """The content and paths a call would write, per tool.

    A tool that is not recognised yields nothing, which is how the guard stays
    silent for `Read` and `Grep` instead of guessing at them.
    """
    if tool == "Write":
        yield Written(str(tool_input.get("content", "")), str(tool_input["file_path"]))
    elif tool == "Edit":
        yield Written(str(tool_input.get("new_string", "")), str(tool_input["file_path"]))
    elif tool == "MultiEdit":
        path = str(tool_input["file_path"])
        for one in tool_input.get("edits", []):
            yield Written(str(one.get("new_string", "")), path)
    elif tool == "NotebookEdit":
        yield Written(str(tool_input.get("new_source", "")), str(tool_input["notebook_path"]))
    elif tool == "Bash":
        # The whole command, content and destination at once. A credential in a
        # command line is worth refusing wherever in it it appears — including
        # in a commit message, which goes into the repository like anything
        # else.
        yield Written(str(tool_input.get("command", "")), is_command=True)


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

    for written in written_by(tool, tool_input):
        where = "the command" if written.is_command else readable(written.path, cwd)
        findings = credential_detector.scan_text(where, written.content)
        if findings:
            return "deny", denial(findings, credential_detector.ALLOW_MARKER)
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


def main() -> int:
    try:
        payload = json.load(sys.stdin)
        decision = decide(payload)
    except Exception as error:
        # Deliberately every exception, not a named few. Everything unexpected
        # asks, because the alternative is a guard that is absent in a way that
        # looks identical to a guard that passed.
        emit(
            "ask",
            f"The repository's write guard could not run, so this call was not "
            f"inspected: {type(error).__name__}: {error}. Approving it skips the "
            f"credential check.",
        )
        return 0

    if decision:
        emit(*decision)
    return 0


if __name__ == "__main__":
    sys.exit(main())
