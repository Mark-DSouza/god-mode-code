#!/usr/bin/env python3
"""
Tests for the commit guard itself, rather than for the detector underneath it.

`test_credential_detector.py` proves the detector can tell a credential from a
placeholder. Nothing in it ever makes a commit, so none of it proves the part a
contributor actually meets: that `pnpm install` wires the hook up, that the hook
then refuses the commit, and that the refusal says which file and which line.

Each test builds a throwaway repository, copies in the three real files — the
installer, the hook and the detector — runs the real installer, and then uses
git normally. Nothing is stubbed, so what passes here is the chain as shipped.

The header of `.githooks/pre-commit` claims which git operations the hook sees
and which it does not, "each tested rather than assumed". `WhatTheHookSees` is
that claim. It is written as observation rather than assertion about internals:
a credential planted with `--no-verify` is refused by any operation the hook
runs on, and travels silently through any operation it does not. If the hook's
coverage ever changes, those tests change with it and the comment has to follow.
"""

from __future__ import annotations

import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent

# Split at a point that breaks the pattern matching it, for the reason given at
# length in `test_credential_detector.py`: this file is committed through the
# guard it tests. Do not join the halves.
AWS_KEY_ID = "AKIA" + "G1XOLRE4WF6IZD7E"

# The three files under test, copied to the same paths they occupy here. The
# hook resolves the detector relative to the top of the working tree, so the
# layout is part of what is being tested.
SHIPPED_FILES = (
    "scripts/install-git-hooks.sh",
    "scripts/credential_detector.py",
    ".githooks/pre-commit",
)


class GuardedRepository:
    """A throwaway git repository with the guard installed the shipped way."""

    def __init__(self, directory: Path) -> None:
        self.path = directory
        self.git("init", "-b", "main")
        self.git("config", "user.name", "Fixture")
        self.git("config", "user.email", "fixture@example.com")
        self.git("config", "commit.gpgsign", "false")

        for name in SHIPPED_FILES:
            source = REPO_ROOT / name
            target = self.path / name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, target)

        # Through the installer rather than through `git config`, so that a
        # broken installer fails these tests too. This is the step that has to
        # work on a machine nobody has set up by hand.
        self.run(["./scripts/install-git-hooks.sh"], check=True)

    def run(
        self, argv: list[str], check: bool = False, env: dict[str, str] | None = None
    ) -> subprocess.CompletedProcess[str]:
        result = subprocess.run(
            argv, cwd=self.path, capture_output=True, text=True, env=env
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

    def stage(self, name: str, content: str) -> None:
        self.write(name, content)
        self.git("add", name)

    def commit(self, *args: str) -> subprocess.CompletedProcess[str]:
        """Commit without --no-verify, so the guard has its say."""
        return self.git("commit", "-m", "fixture", *args, check=False)

    def commit_regardless(self, *args: str) -> None:
        """Commit past the guard, to plant what a later operation will carry."""
        self.git("commit", "--no-verify", "-m", "fixture", *args)


class GuardedRepositoryTest(unittest.TestCase):
    def setUp(self) -> None:
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.repo = GuardedRepository(Path(self.directory.name))

    def assertRefused(self, result: subprocess.CompletedProcess[str]) -> str:
        output = result.stdout + result.stderr
        self.assertNotEqual(0, result.returncode, f"commit was allowed:\n{output}")
        return output


class TheInstalledHook(GuardedRepositoryTest):
    """The chain from `pnpm install` to a refused commit, end to end."""

    def test_the_installer_points_git_at_the_tracked_directory(self) -> None:
        configured = self.repo.git("config", "--local", "--get", "core.hooksPath")
        self.assertEqual(".githooks", configured.stdout.strip())

    def test_a_commit_carrying_a_credential_is_refused(self) -> None:
        self.repo.stage("src/config.ts", f'const key = "{AWS_KEY_ID}";\n')
        self.assertRefused(self.repo.commit())

    def test_an_ordinary_commit_is_not_refused(self) -> None:
        self.repo.stage("src/config.ts", "const timeout = 30;\n")
        result = self.repo.commit()
        self.assertEqual(0, result.returncode, result.stdout + result.stderr)

    def test_the_refusal_names_the_file_the_line_and_the_shape(self) -> None:
        self.repo.stage("src/config.ts", f'const a = 1;\nconst key = "{AWS_KEY_ID}";\n')
        output = self.assertRefused(self.repo.commit())
        self.assertIn("src/config.ts", output)
        self.assertIn(":2:", output)
        self.assertIn("AWS access key id", output)

    def test_the_refusal_does_not_echo_the_credential(self) -> None:
        self.repo.stage("src/config.ts", f'const key = "{AWS_KEY_ID}";\n')
        output = self.assertRefused(self.repo.commit())
        self.assertNotIn(AWS_KEY_ID, output)

    def test_a_missing_python3_refuses_rather_than_waving_the_commit_through(
        self,
    ) -> None:
        # A guard that opens when its interpreter is missing is worse than no
        # guard, because everyone believes it ran. Built by giving the hook a
        # PATH holding only what it needs to reach its own error message.
        restricted = self.repo.path / "restricted-bin"
        restricted.mkdir()
        for tool in ("git", "bash"):
            found = shutil.which(tool)
            if found is None:
                self.skipTest(f"{tool} is not on PATH")
            (restricted / tool).symlink_to(found)

        self.repo.stage("src/config.ts", "const timeout = 30;\n")
        result = self.repo.run(
            [str(self.repo.path / ".githooks/pre-commit")],
            env={"PATH": str(restricted)},
        )
        output = self.assertRefused(result)
        self.assertIn("python3", output)


class WhatTheHookSees(GuardedRepositoryTest):
    """The coverage claims in the hook's own header, one test each.

    Every one plants a credential with `--no-verify` and then asks whether the
    operation under test carries it past the guard or is refused by it.
    """

    def plant_on_a_branch(self, branch: str, name: str, content: str) -> None:
        self.repo.git("checkout", "-b", branch)
        self.repo.stage(name, content)
        self.repo.commit_regardless()
        self.repo.git("checkout", "main")

    def setUp(self) -> None:
        super().setUp()
        self.repo.stage("README.md", "# fixture\n")
        self.repo.commit_regardless()

    def test_an_ordinary_commit_is_read(self) -> None:
        self.repo.stage("src/config.ts", f'const key = "{AWS_KEY_ID}";\n')
        self.assertRefused(self.repo.commit())

    def test_an_amend_is_read(self) -> None:
        self.repo.stage("src/config.ts", "const timeout = 30;\n")
        self.repo.commit()
        self.repo.stage("src/config.ts", f'const key = "{AWS_KEY_ID}";\n')
        self.assertRefused(self.repo.commit("--amend", "--no-edit"))

    def test_an_amend_does_not_re_read_the_commit_it_replaces(self) -> None:
        # The staged diff is taken against the commit being replaced, so what
        # is already inside it is not offered to the hook again.
        self.repo.stage("src/config.ts", f'const key = "{AWS_KEY_ID}";\n')
        self.repo.commit_regardless()
        self.repo.stage("README.md", "# fixture, amended\n")
        result = self.repo.commit("--amend", "--no-edit")
        self.assertEqual(0, result.returncode, result.stdout + result.stderr)

    def test_a_clean_merge_is_not_read(self) -> None:
        # Git writes this commit itself and runs no pre-commit hook, so the
        # planted credential arrives unread. Tolerable only because it was
        # offered to the guard when it was first committed.
        self.plant_on_a_branch("side", "src/side.ts", f'const key = "{AWS_KEY_ID}";\n')
        merge = self.repo.git("merge", "--no-ff", "-m", "merge", "side", check=False)
        self.assertEqual(0, merge.returncode, merge.stdout + merge.stderr)

    def test_a_rebase_is_not_read(self) -> None:
        self.plant_on_a_branch("side", "src/side.ts", f'const key = "{AWS_KEY_ID}";\n')
        self.repo.stage("src/main.ts", "const timeout = 30;\n")
        self.repo.commit()
        self.repo.git("checkout", "side")
        rebase = self.repo.git("rebase", "main", check=False)
        self.assertEqual(0, rebase.returncode, rebase.stdout + rebase.stderr)

    def test_the_commit_that_finishes_a_conflicted_merge_is_read(self) -> None:
        # The other branch's already-committed lines read as additions here,
        # which is why this one is refused where a clean merge is not.
        self.repo.stage("src/config.ts", "const timeout = 30;\n")
        self.repo.commit_regardless()
        self.repo.git("checkout", "-b", "side", "HEAD~1")
        self.repo.stage("src/config.ts", f'const key = "{AWS_KEY_ID}";\n')
        self.repo.commit_regardless()
        self.repo.git("checkout", "main")

        merge = self.repo.git("merge", "side", check=False)
        self.assertNotEqual(0, merge.returncode, "expected a conflict to resolve")

        self.repo.stage("src/config.ts", f'const key = "{AWS_KEY_ID}";\n')
        self.assertRefused(self.repo.commit())


if __name__ == "__main__":
    unittest.main()
