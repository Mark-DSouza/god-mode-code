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
SHIPPED_FILES = (
    "scripts/credential_detector.py",
    "scripts/security-sweep.sh",
)

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
    "mkdir",
    "chmod",
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

    def run(
        self,
        argv: list[str],
        check: bool = False,
        cwd: Path | None = None,
        path: str | None = None,
    ) -> subprocess.CompletedProcess[str]:
        environment = dict(os.environ)
        environment["PATH"] = path or reduced_path(self.path.parent / "bin")
        result = subprocess.run(
            argv, cwd=cwd or self.path, capture_output=True, text=True, env=environment
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

    def detector(self, *args: str, cwd: Path | None = None) -> subprocess.CompletedProcess[str]:
        detector = str(self.path / "scripts" / "credential_detector.py")
        return self.run(["python3", detector, *args], cwd=cwd)

    def sweep(
        self, *args: str, cwd: Path | None = None, path: str | None = None
    ) -> subprocess.CompletedProcess[str]:
        sweep = str(self.path / "scripts" / "security-sweep.sh")
        return self.run([sweep, *args], cwd=cwd, path=path)


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

    def test_starting_from_a_subdirectory_still_scans_the_repository(self) -> None:
        # `git ls-files` is relative to the working directory, so this is the
        # scan that reads four files, says nothing is wrong, and is believed.
        self.repo.commit_file("src/config.ts", f'const key = "{AWS_KEY_ID}";\n')
        result = self.repo.detector("--tracked", cwd=self.repo.path / "scripts")
        self.assertEqual(1, result.returncode, result.stdout + result.stderr)
        self.assertIn("src/config.ts:1", result.stdout + result.stderr)

    def test_a_file_deleted_from_the_working_tree_is_counted_out_loud(self) -> None:
        # Still tracked, not on disk. Skipping it silently would shrink the
        # scan without shrinking what the report claims to have covered.
        self.repo.commit_file("src/config.ts", "const timeout = 30;\n")
        (self.repo.path / "src/config.ts").unlink()
        result = self.repo.detector("--tracked")
        self.assertEqual(0, result.returncode, result.stdout + result.stderr)
        self.assertIn("1 tracked paths held nothing to read", result.stderr)

    def test_a_symlink_is_read_as_its_target_path(self) -> None:
        # What git stores for a symlink is the target path, so that is what is
        # read. Following it would read a file twice when it points inside the
        # repository, and something outside the repository when it does not.
        self.repo.write("src/config.ts", "const timeout = 30;\n")
        (self.repo.path / "src/link.ts").symlink_to("config.ts")
        self.repo.commit_all("a symlink")
        result = self.repo.detector("--tracked")
        self.assertEqual(0, result.returncode, result.stdout + result.stderr)
        self.assertIn("and 1 symlinks", result.stderr)

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

        result = self.repo.detector("--history")
        self.assertIn(planted, result.stdout + result.stderr, "the commit that first carried it")

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

    def test_a_credential_introduced_by_a_merge_is_found_and_attributed(self) -> None:
        # The case that decided blobs over diffs. `git log -p` shows no diff
        # for a merge commit, so a credential written while resolving a
        # conflict exists in no diff anywhere — and attribution has to be
        # asked the same question the same way, or the finding is reported
        # with nothing to look at.
        self.repo.commit_file("src/config.ts", "const timeout = 30;\n")
        self.repo.git("checkout", "-b", "side")
        self.repo.commit_file("src/config.ts", "const timeout = 60;\n")
        self.repo.git("checkout", "main")
        self.repo.commit_file("src/config.ts", "const timeout = 90;\n")

        conflicted = self.repo.git("merge", "side", check=False)
        self.assertNotEqual(0, conflicted.returncode, "expected a conflict to resolve")
        self.repo.write("src/config.ts", f'const key = "{AWS_KEY_ID}";\n')
        resolved = self.repo.commit_all("resolve the conflict")

        result = self.repo.detector("--history")
        output = result.stdout + result.stderr
        self.assertEqual(1, result.returncode, output)
        self.assertIn(resolved, output)

    def test_the_scan_says_how_much_it_read(self) -> None:
        self.repo.commit_file("src/config.ts", "const timeout = 30;\n")
        result = self.repo.detector("--history")
        self.assertRegex(result.stderr, r"Read \d+ blobs from \d+ commits")

    def test_a_shallow_clone_is_refused_rather_than_reported_clean(self) -> None:
        # The worst output this file can produce: a truncated history scanned
        # in full, reported as clean, and indistinguishable from the real
        # thing. The old commits a shallow clone drops are exactly the ones a
        # sweep exists to read.
        self.repo.commit_file("src/config.ts", "const timeout = 30;\n")
        shallow = self.repo.path.parent / "shallow"
        self.repo.run(
            ["git", "clone", "--depth", "1", f"file://{self.repo.path}", str(shallow)], check=True
        )
        result = self.repo.detector("--history", cwd=shallow)
        self.assertEqual(2, result.returncode, result.stdout + result.stderr)
        self.assertIn("shallow", result.stderr)

    def test_the_report_does_not_repeat_the_credential(self) -> None:
        self.repo.commit_file("src/leaked.ts", f'const key = "{AWS_KEY_ID}";\n')
        output = self.repo.detector("--history")
        self.assertNotIn(AWS_KEY_ID, output.stdout + output.stderr)

    def test_the_advice_is_to_rotate_rather_than_to_edit_the_file(self) -> None:
        # Editing the file fixes the tree and changes nothing about the
        # disclosure: the commit is still there, and so is every clone of it.
        self.repo.commit_file("src/leaked.ts", f'const key = "{AWS_KEY_ID}";\n')
        self.assertIn("Rotate it", self.repo.detector("--history").stderr)


class TheSweep(RepositoryTest):
    """The command itself: what it reports, and what its exit status means.

    Every test here runs it without `docker`, `trivy` or `go`, which is both
    the fast path and the interesting one. A sweep that cannot run a tier and
    does not say so is worse than one that fails outright, because the reader
    believes the part that is missing.
    """

    def test_a_clean_repository_exits_zero(self) -> None:
        self.repo.commit_file("src/config.ts", "const timeout = 30;\n")
        result = self.repo.sweep()
        self.assertEqual(0, result.returncode, result.stdout + result.stderr)

    def test_a_credential_in_the_tree_is_found_and_exits_one(self) -> None:
        self.repo.commit_file("src/config.ts", f'const key = "{AWS_KEY_ID}";\n')
        result = self.repo.sweep()
        self.assertEqual(1, result.returncode, result.stdout + result.stderr)
        self.assertIn("src/config.ts:1", result.stdout + result.stderr)

    def test_a_credential_only_in_history_is_found_and_exits_one(self) -> None:
        self.repo.commit_file("src/leaked.ts", f'const key = "{AWS_KEY_ID}";\n')
        self.repo.delete("src/leaked.ts")
        result = self.repo.sweep()
        self.assertEqual(1, result.returncode, result.stdout + result.stderr)
        self.assertIn("src/leaked.ts", result.stdout + result.stderr)

    def plant_the_tiers_targets(self) -> None:
        """Enough of the shape of this repository for the tool-dependent tiers
        to have something to point at, so what they report is the missing tool
        rather than the missing directory."""
        self.repo.write("infra/terraform/main.tf", 'resource "null_resource" "a" {}\n')
        self.repo.write("apps/judge/go.mod", "module judge\n\ngo 1.26\n")
        self.repo.commit_all("something for each tier to scan")

    def test_a_tier_whose_tooling_is_missing_is_reported_as_not_run(self) -> None:
        self.plant_the_tiers_targets()
        summary = self.summary_of(self.repo.sweep())
        self.assertRegex(summary, r"infrastructure\s+not run — needs trivy")
        self.assertRegex(summary, r"go\s+not run — needs the Go toolchain")

    def test_a_tier_with_nothing_to_scan_says_that_rather_than_blaming_a_tool(self) -> None:
        # The two are different facts and the reader acts on them differently:
        # one is "install Docker", the other is "there is nothing here".
        summary = self.summary_of(self.repo.sweep())
        self.assertRegex(summary, r"infrastructure\s+not run — there is no infra/")

    def test_a_tier_that_did_not_run_is_not_reported_as_clean(self) -> None:
        # The distinction the whole summary exists for. A tier that could not
        # run has found nothing, and so has a tier that ran and was satisfied;
        # only one of those is worth anything to the reader.
        self.repo.commit_file("src/config.ts", "const timeout = 30;\n")
        summary = self.summary_of(self.repo.sweep())
        self.assertRegex(summary, r"tree\s+no findings")
        self.assertRegex(summary, r"infrastructure\s+not run")

    def test_a_missing_tier_alone_does_not_fail_the_run(self) -> None:
        # Exit status answers "did it find something", not "did every tier
        # run" — the second question is answered in words, where the reason
        # can be given. A laptop without Docker is the ordinary case.
        self.repo.commit_file("src/config.ts", "const timeout = 30;\n")
        self.assertEqual(0, self.repo.sweep().returncode)

    def test_it_ends_by_saying_what_it_cannot_check_locally(self) -> None:
        # An unqualified "no problems found" is the misleading output this
        # ticket exists to prevent: parts of the posture only run on GitHub.
        output = self.repo.sweep().stdout + self.repo.sweep().stderr
        self.assertIn("CodeQL", output)
        self.assertIn("Dependabot", output)
        self.assertIn("secret scanning", output.lower())

    def test_a_scan_that_could_not_run_exits_two(self) -> None:
        # Not one, which would say "found something" — and not zero, which
        # would say "found nothing" about a scan that never happened.
        without_python = reduced_path(
            self.repo.path.parent / "bin-no-python",
            tuple(tool for tool in TOOLS_ALLOWED if tool != "python3"),
        )
        result = self.repo.sweep(path=without_python)
        self.assertEqual(2, result.returncode, result.stdout + result.stderr)
        self.assertIn("python3", result.stdout + result.stderr)

    def test_outside_a_repository_it_exits_two(self) -> None:
        outside = self.repo.path.parent / "not-a-repository"
        outside.mkdir()
        result = self.repo.sweep(cwd=outside)
        self.assertEqual(2, result.returncode, result.stdout + result.stderr)

    def with_stub(self, name: str, script: str) -> str:
        """A `PATH` where one tool is a fixture that exits how we say.

        Every tier here reads a tool's exit status and decides from it what to
        tell the reader, and getting that mapping wrong is silent in exactly
        one direction: a vulnerability reported as a tier that never ran. The
        real tools cannot be made to exit on demand; these can.
        """
        directory = self.repo.path.parent / f"bin-{name}"
        path = reduced_path(directory)
        stub = directory / name
        # A stub for a tool that is also on the real `PATH` arrives as a
        # symlink to it, and writing through that symlink would edit the tool.
        stub.unlink(missing_ok=True)
        stub.write_text(f"#!/bin/sh\n{script}\n")
        stub.chmod(0o755)
        return path

    def test_a_tool_that_reports_findings_is_reported_as_findings(self) -> None:
        self.plant_the_tiers_targets()
        # Trivy's documented behaviour with `--exit-code 2`, which is why the
        # sweep asks for 2 rather than 1: 1 is what Trivy itself exits on a
        # fatal error, and the two must not be the same number.
        path = self.with_stub("trivy", "exit 2")
        result = self.repo.sweep(path=path)
        self.assertEqual(1, result.returncode, result.stdout + result.stderr)
        self.assertRegex(self.summary_of(result), r"infrastructure\s+findings")

    def test_a_tool_that_fails_is_not_reported_as_findings(self) -> None:
        # The failure this pairing exists to prevent: a scanner that crashed,
        # printing nothing, recorded as a clean-looking list of no findings —
        # or worse, as findings nobody can see.
        self.plant_the_tiers_targets()
        path = self.with_stub("trivy", "echo 'fatal error' >&2; exit 1")
        result = self.repo.sweep(path=path)
        self.assertEqual(2, result.returncode, result.stdout + result.stderr)
        self.assertRegex(self.summary_of(result), r"infrastructure\s+COULD NOT RUN")

    def test_docker_that_cannot_start_a_container_is_a_tier_that_did_not_run(self) -> None:
        # A stopped daemon says nothing about this repository, and must not
        # fail a sweep whose other tiers were satisfied.
        self.plant_the_tiers_targets()
        path = self.with_stub("docker", "exit 125")
        result = self.repo.sweep(path=path)
        self.assertEqual(0, result.returncode, result.stdout + result.stderr)
        self.assertRegex(self.summary_of(result), r"infrastructure\s+not run")

    def test_a_go_vulnerability_is_reported_as_a_finding(self) -> None:
        # govulncheck exits 3 when it finds something reachable — but only if
        # it is run as a binary. `go run` collapses the program's status into
        # its own 1, which lands a real vulnerability in the "could not run"
        # branch and exits the sweep 0. Hence the install, and hence this test.
        self.plant_the_tiers_targets()
        path = self.with_stub(
            "go",
            'case "$1" in\n'
            'install) mkdir -p "$GOBIN" && printf \'#!/bin/sh\\nexit 3\\n\' '
            '> "$GOBIN/govulncheck" && chmod +x "$GOBIN/govulncheck" ;;\n'
            "*) exit 0 ;;\n"
            "esac",
        )
        result = self.repo.sweep(path=path)
        self.assertEqual(1, result.returncode, result.stdout + result.stderr)
        self.assertRegex(self.summary_of(result), r"go\s+findings")

    def test_the_go_tier_does_not_claim_more_than_govulncheck_said(self) -> None:
        # govulncheck exits 0 with vulnerabilities on the screen when they are
        # in modules the code does not call. "No findings" would overstate
        # that, and the difference matters the day something starts calling
        # the package.
        self.plant_the_tiers_targets()
        path = self.with_stub(
            "go",
            'case "$1" in\n'
            'install) mkdir -p "$GOBIN" && printf \'#!/bin/sh\\nexit 0\\n\' '
            '> "$GOBIN/govulncheck" && chmod +x "$GOBIN/govulncheck" ;;\n'
            "*) exit 0 ;;\n"
            "esac",
        )
        result = self.repo.sweep(path=path)
        self.assertEqual(0, result.returncode, result.stdout + result.stderr)
        self.assertRegex(self.summary_of(result), r"go\s+no reachable vulnerabilities")

    def test_a_detector_that_crashes_is_not_reported_as_findings(self) -> None:
        # The credential tiers read exit 1 as "found something". A detector
        # that died before scanning anything also exits 1 — python does — so
        # the sweep asks it a question it knows the answer to before it
        # believes any of its answers.
        crashing_python = self.with_stub(
            "python3", "echo 'Traceback (most recent call last):' >&2; exit 1"
        )
        result = self.repo.sweep(path=crashing_python)
        output = result.stdout + result.stderr
        self.assertEqual(2, result.returncode, output)
        # Nothing ran, so there is nothing to summarise — and in particular no
        # tier reporting findings that were really a stack trace.
        self.assertNotIn("findings", output)
        self.assertIn("Nothing below would have been trustworthy", output)

    def test_a_scanner_killed_mid_run_is_a_failure_rather_than_a_tier_that_skipped(self) -> None:
        # 137 is Docker reporting the container was killed — out of memory,
        # most likely. It started, so it is not "did not run"; it did not
        # finish, so it is not a result either.
        self.plant_the_tiers_targets()
        path = self.with_stub("docker", "exit 137")
        result = self.repo.sweep(path=path)
        self.assertEqual(2, result.returncode, result.stdout + result.stderr)
        self.assertRegex(self.summary_of(result), r"infrastructure\s+COULD NOT RUN")

    def test_findings_are_still_reported_when_another_tier_broke(self) -> None:
        # Exit 2 wins, because an incomplete sweep must not be read as a
        # complete one — but a credential that was found is still a credential
        # that was found, and swallowing it would be the worse error.
        self.plant_the_tiers_targets()
        self.repo.commit_file("src/config.ts", f'const key = "{AWS_KEY_ID}";\n')
        path = self.with_stub("docker", "exit 1")
        result = self.repo.sweep(path=path)
        output = result.stdout + result.stderr
        self.assertEqual(2, result.returncode, output)
        self.assertRegex(self.summary_of(result), r"tree\s+findings")
        self.assertIn("rotated by a person", output)

    def test_govulncheck_that_cannot_be_fetched_is_a_tier_that_did_not_run(self) -> None:
        self.plant_the_tiers_targets()
        path = self.with_stub("go", "echo 'no network' >&2; exit 1")
        result = self.repo.sweep(path=path)
        self.assertEqual(0, result.returncode, result.stdout + result.stderr)
        self.assertRegex(self.summary_of(result), r"go\s+not run")

    def summary_of(self, result: subprocess.CompletedProcess[str]) -> str:
        output = result.stdout + result.stderr
        self.assertIn("Summary", output, output)
        return output[output.index("Summary") :]


if __name__ == "__main__":
    unittest.main()
