#!/usr/bin/env python3
"""
Tests for the whole-repository sweep, and for the two detector modes it rests
on.

`test_credential_detector.py` proves the detector can tell a credential from a
placeholder, and never touches a repository. `test_commit_guard.py` proves the
commit hook refuses what a commit adds. Neither says anything about the two
questions this sweep exists to answer: what is in the tree that no diff has
shown us, and what is in the history that no working tree shows at all.

So every test here builds a throwaway repository, copies in the real files, and
runs them. A file whose credential is planted before the sweep is written into
history, deleted from the tree, and then still has to be found — which is the
whole point, and is not something a fixture over a string can demonstrate.

The sweep's tiers are run with a deliberately reduced `PATH`, holding only the
tools every one of these tests needs. That is not only for speed: the case a
sweep gets wrong is the one where a tool is missing, and the only way to test it
is to take the tool away.

Every fixture is fabricated, and split at a point that breaks the pattern
matching it, for the reason `test_credential_detector.py` gives at length: this
file is committed through the guard it tests.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent

AWS_KEY_ID = "AKIA" + "G1XOLRE4WF6IZD7E"
GITHUB_TOKEN = "ghp_" + "hUHzGgaqG1wBLkvZEqm1DiNBKmK0qVg3wGXN"

# The files under test, copied to the paths they occupy here. The sweep finds
# the detector relative to its own location, so the layout is part of what is
# being tested.
SHIPPED_FILES = ("scripts/credential_detector.py",)

# What the sweep is allowed to find on `PATH` during these tests. Everything
# the shell and git need, and nothing a tier could scan with — so `docker`,
# `trivy` and `go` are absent, and the tiers needing them must say so.
TOOLS_ALLOWED = (
    "bash",
    "sh",
    "env",
    "git",
    "python3",
    "dirname",
    "uname",
    "sed",
    "grep",
    "cat",
    "rm",
    "mktemp",
)


def reduced_path(directory: Path, tools: tuple[str, ...] = TOOLS_ALLOWED) -> str:
    """A `PATH` holding only the named tools, so a missing one is missing."""
    directory.mkdir(parents=True, exist_ok=True)
    for tool in tools:
        found = shutil.which(tool)
        if found and not (directory / tool).exists():
            (directory / tool).symlink_to(found)
    return str(directory)


class Repository:
    """A throwaway git repository, with the sweep and the detector inside it."""

    def __init__(self, directory: Path) -> None:
        self.path = directory
        self.path.mkdir(parents=True, exist_ok=True)
        self.git("init", "-b", "main")
        self.git("config", "user.name", "Fixture")
        self.git("config", "user.email", "fixture@example.com")
        self.git("config", "commit.gpgsign", "false")

        for name in SHIPPED_FILES:
            target = self.path / name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(REPO_ROOT / name, target)
        self.commit_all("the tools under test")

    def run(self, argv: list[str], check: bool = False) -> subprocess.CompletedProcess[str]:
        environment = dict(os.environ)
        environment["PATH"] = reduced_path(self.path.parent / "bin")
        result = subprocess.run(
            argv, cwd=self.path, capture_output=True, text=True, env=environment
        )
        if check and result.returncode != 0:
            raise AssertionError(f"{argv} failed: {result.stdout}\n{result.stderr}")
        return result

    def git(self, *args: str, check: bool = True) -> subprocess.CompletedProcess[str]:
        return self.run(["git", *args], check=check)

    def write(self, name: str, content: str) -> None:
        target = self.path / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content)

    def commit_all(self, message: str) -> str:
        self.git("add", "-A")
        self.git("commit", "-m", message)
        return self.git("rev-parse", "--short", "HEAD").stdout.strip()

    def commit_file(self, name: str, content: str, message: str = "a change") -> str:
        self.write(name, content)
        return self.commit_all(message)

    def delete(self, name: str) -> str:
        self.git("rm", "--quiet", name)
        return self.commit_all(f"remove {name}")

    def detector(self, *args: str) -> subprocess.CompletedProcess[str]:
        return self.run(["python3", "scripts/credential_detector.py", *args])

    def sweep(self, *args: str) -> subprocess.CompletedProcess[str]:
        return self.run(["./scripts/security-sweep.sh", *args])


class RepositoryTest(unittest.TestCase):
    def setUp(self) -> None:
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.repo = Repository(Path(self.directory.name) / "repo")


class TrackedFiles(RepositoryTest):
    """`--tracked` reads what is here, which no diff-scoped check ever will.

    The commit guard reads added lines, so anything committed before the guard
    existed — or through it, with `--no-verify` — has never been read by
    anything of ours. This is the mode that reads it.
    """

    def test_a_credential_no_diff_would_show_is_found(self) -> None:
        self.repo.commit_file("src/config.ts", f'const key = "{AWS_KEY_ID}";\n')
        result = self.repo.detector("--tracked")
        self.assertEqual(1, result.returncode, result.stdout + result.stderr)
        self.assertIn("src/config.ts:1", result.stdout + result.stderr)
        self.assertIn("AWS access key id", result.stdout + result.stderr)

    def test_a_clean_tree_exits_zero(self) -> None:
        self.repo.commit_file("src/config.ts", "const timeout = 30;\n")
        self.assertEqual(0, self.repo.detector("--tracked").returncode)

    def test_an_untracked_file_is_not_the_repository(self) -> None:
        # It is on disk, but nothing has committed it and nothing will push
        # it. Reporting it would train people to ignore the report.
        self.repo.write("scratch.ts", f'const key = "{AWS_KEY_ID}";\n')
        self.assertEqual(0, self.repo.detector("--tracked").returncode)

    def test_a_marked_line_is_still_allowed(self) -> None:
        self.repo.commit_file(
            "src/config.ts", f'const key = "{AWS_KEY_ID}"; // credential-detector: allow\n'
        )
        self.assertEqual(0, self.repo.detector("--tracked").returncode)

    def test_the_scan_says_how_much_it_read(self) -> None:
        # "No findings" over nothing at all reads exactly like "no findings"
        # over everything, and only one of them is worth anything.
        self.repo.commit_file("src/config.ts", "const timeout = 30;\n")
        result = self.repo.detector("--tracked")
        self.assertRegex(result.stderr, r"Read \d+ tracked files")

    def test_a_binary_file_does_not_break_the_scan(self) -> None:
        (self.repo.path / "logo.png").write_bytes(b"\x89PNG\r\n\x1a\n\x00\x01\xff\xfe")
        self.repo.commit_all("a binary file")
        self.assertEqual(0, self.repo.detector("--tracked").returncode)


class History(RepositoryTest):
    """`--history` reads every blob ever committed, which is the only place a
    deleted credential still exists.

    Deleting the file does not remove it: it stays reachable from the commit
    that held it for as long as that commit is reachable, which on a public
    repository means for as long as anyone has cloned it.
    """

    def test_a_credential_deleted_from_the_tree_is_still_in_history(self) -> None:
        planted = self.repo.commit_file("src/leaked.ts", f'const key = "{AWS_KEY_ID}";\n')
        self.repo.delete("src/leaked.ts")

        self.assertEqual(0, self.repo.detector("--tracked").returncode, "tree is clean now")

        result = self.repo.detector("--history")
        output = result.stdout + result.stderr
        self.assertEqual(1, result.returncode, output)
        self.assertIn("src/leaked.ts", output)
        self.assertIn("AWS access key id", output)
        self.assertIn(planted, output)

    def test_a_finding_names_the_commit_that_introduced_it(self) -> None:
        planted = self.repo.commit_file("src/leaked.ts", f'const key = "{AWS_KEY_ID}";\n')
        self.repo.commit_file("src/leaked.ts", f'const key = "{AWS_KEY_ID}"; // moved\n')

        output = self.repo.detector("--history").stdout + self.repo.detector("--history").stderr
        self.assertIn(planted, output, "the commit that first carried it")

    def test_a_credential_edited_out_of_a_file_is_still_in_history(self) -> None:
        planted = self.repo.commit_file("src/config.ts", f'const key = "{AWS_KEY_ID}";\n')
        self.repo.commit_file("src/config.ts", 'const key = process.env.KEY;\n')

        result = self.repo.detector("--history")
        self.assertEqual(1, result.returncode)
        self.assertIn(planted, result.stdout + result.stderr)

    def test_a_credential_on_an_unmerged_branch_is_in_history(self) -> None:
        # A branch nobody merged is still pushed, still cloned, still public.
        self.repo.git("checkout", "-b", "side")
        self.repo.commit_file("src/side.ts", f"GITHUB_TOKEN={GITHUB_TOKEN}\n")
        self.repo.git("checkout", "main")

        result = self.repo.detector("--history")
        self.assertEqual(1, result.returncode)
        self.assertIn("GitHub token", result.stdout + result.stderr)

    def test_a_clean_history_exits_zero(self) -> None:
        self.repo.commit_file("src/config.ts", "const timeout = 30;\n")
        self.repo.delete("src/config.ts")
        self.assertEqual(0, self.repo.detector("--history").returncode)

    def test_a_credential_never_committed_is_not_in_history(self) -> None:
        self.repo.write("scratch.ts", f'const key = "{AWS_KEY_ID}";\n')
        self.assertEqual(0, self.repo.detector("--history").returncode)

    def test_the_scan_says_how_much_it_read(self) -> None:
        self.repo.commit_file("src/config.ts", "const timeout = 30;\n")
        result = self.repo.detector("--history")
        self.assertRegex(result.stderr, r"Read \d+ blobs from \d+ commits")

    def test_the_report_does_not_repeat_the_credential(self) -> None:
        self.repo.commit_file("src/leaked.ts", f'const key = "{AWS_KEY_ID}";\n')
        output = self.repo.detector("--history")
        self.assertNotIn(AWS_KEY_ID, output.stdout + output.stderr)

    def test_the_advice_is_to_rotate_rather_than_to_edit_the_file(self) -> None:
        # Editing the file fixes the tree and changes nothing about the
        # disclosure: the commit is still there, and so is every clone of it.
        self.repo.commit_file("src/leaked.ts", f'const key = "{AWS_KEY_ID}";\n')
        self.assertIn("Rotate it", self.repo.detector("--history").stderr)


if __name__ == "__main__":
    unittest.main()
