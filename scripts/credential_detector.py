#!/usr/bin/env python3
"""
The credential detector: one list of shapes, several enforcement points.

Written once, here, because it is about to be consumed in three places — the
commit-time guard in `.githooks/pre-commit`, a whole-repository sweep, and the
Claude Code write guard. Three copies of a shape list is three lists that
drift, and a silent regression in any one of them disables a control without
anyone noticing.

Two properties are deliberate and should survive any change to this file:

  **No third-party dependencies, and no interpreter but python3.** The guard
  runs at the most latency-sensitive moment in the loop, and it has to work for
  a contributor who only ever touches Go or Java and has never installed a
  JavaScript toolchain. Anything that needs a package manager, a network call
  or a container does not belong here.

  **Every shape is unambiguous on sight** — a key id with a vendor prefix, a
  PEM header, a token with a registered prefix — and carries a comment saying
  what it is, so the list can be reviewed rather than trusted. Entropy
  heuristics and "that looks like base64" belong to CodeQL and to GitHub's push
  protection. Here they would block legitimate work, and a guard that blocks
  legitimate work is a guard that gets uninstalled.

`shape` rather than `pattern` throughout: Pattern is a product concept in this
repository's glossary (CONTEXT.md) and means something else entirely.

Usage:

    credential_detector.py --staged             added lines of the staged diff
    credential_detector.py --tracked            every tracked file, in full
    credential_detector.py --history            every blob ever committed
    credential_detector.py PATH [PATH ...]      whole files
    credential_detector.py --stdin --as PATH    content that is not on disk yet

Exit status, which is the whole interface for every caller:

    0   nothing found
    1   something found
    2   the scan could not run
"""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
from pathlib import Path
from typing import Iterable, Iterator, NamedTuple, Sequence

# Written on the offending line itself, so the reason travels with the string
# and a reviewer sees it in the same diff hunk. The alternative — a separate
# ignore file — is a list nobody reads, appended to until it covers everything.
ALLOW_MARKER = "credential-detector: allow"

# How much of a match is shown in a report. A refusal that echoes the secret
# writes it into a terminal scrollback, a CI log and, on a shared runner, an
# artifact — turning a near miss into an actual disclosure.
PREFIX_SHOWN = 4


class Shape(NamedTuple):
    """One credential shape, and the name a report calls it by."""

    name: str
    regex: re.Pattern[str]


def _shape(name: str, regex: str, flags: int = 0) -> Shape:
    return Shape(name, re.compile(regex, flags))


# The shape list. Each entry says what it matches and why that shape is safe to
# refuse outright; anything that cannot be justified in a line does not belong.
CREDENTIAL_SHAPES: tuple[Shape, ...] = (
    # AWS key ids are the one part of an AWS credential pair that is
    # self-identifying: a fixed four-character type prefix and exactly sixteen
    # more characters of base32. Nothing else has this shape.
    _shape(
        "AWS access key id",
        r"\b(?:AKIA|ASIA|ABIA|ACCA|AGPA|AIDA|AIPA|ANPA|ANVA|AROA)[A-Z0-9]{16}\b",
    ),
    # The secret half has no prefix — it is forty characters of base64 and
    # indistinguishable from a hash — so it is only matched next to a key that
    # names it. On its own it would flag every integrity hash in the lockfile.
    _shape(
        "AWS secret access key",
        r"aws_?secret_?access_?key[\"']?\s*[:=]\s*[\"']?([A-Za-z0-9/+=]{40})",
        re.IGNORECASE,
    ),
    # A PEM header. SSH keys, TLS keys and the `private_key` field of a Google
    # service account JSON all carry it, including when the file has been
    # flattened into a JSON string with escaped newlines.
    _shape("private key", r"-----BEGIN(?: [A-Z0-9]+)* PRIVATE KEY-----"),
    # GitHub's tokens: `ghp_` personal, `gho_` OAuth, `ghu_`/`ghs_` app, `ghr_`
    # refresh, all thirty-six characters after the prefix.
    _shape("GitHub token", r"\bgh[pousr]_[A-Za-z0-9]{36}\b"),
    # Fine-grained tokens are much longer and carry a prefix of their own.
    _shape("GitHub token", r"\bgithub_pat_[A-Za-z0-9_]{50,}"),
    # Slack bot, user, app and refresh tokens.
    _shape("Slack token", r"\bxox[abopsr]-[A-Za-z0-9-]{20,}"),
    # An incoming webhook URL is a credential in its own right: anyone holding
    # it can post into the channel.
    _shape(
        "Slack webhook",
        r"https://hooks\.slack\.com/services/T[A-Za-z0-9_]+/B[A-Za-z0-9_]+/[A-Za-z0-9]{20,}",
    ),
    # Stripe live secret and restricted keys. The `sk_test_` and `rk_test_`
    # counterparts are published in Stripe's own documentation and are meant to
    # be committed, which is why `live` is in the shape rather than optional.
    _shape("Stripe live key", r"\b[rs]k_live_[A-Za-z0-9]{20,}\b"),
    # Google API keys: a fixed prefix and thirty-five more characters.
    _shape("Google API key", r"\bAIza[0-9A-Za-z_-]{35}\b"),
    # OpenAI's project, service-account and admin keys.
    _shape("OpenAI key", r"\bsk-(?:proj|svcacct|admin)-[A-Za-z0-9_-]{20,}"),
    # The older undifferentiated form, which is exactly forty-eight characters
    # and so cannot be confused with the `sk-`-prefixed keys above.
    _shape("OpenAI key", r"\bsk-[A-Za-z0-9]{48}\b"),
    # Anthropic keys carry the API version in the prefix; the tail is long
    # enough that the prefix alone is not what makes this confident.
    _shape("Anthropic key", r"\bsk-ant-[A-Za-z0-9_-]{24,}"),
    # An npm automation or publish token, as written into a `.npmrc`.
    _shape("npm token", r"\bnpm_[A-Za-z0-9]{36}\b"),
    # A PyPI upload token. The long fixed middle is the base64 of the macaroon
    # header naming pypi.org, so it is the same for every such token.
    _shape("PyPI token", r"\bpypi-AgEIcHlwaS5vcmc[A-Za-z0-9_-]{50,}"),
    # Grafana Cloud, which this project uses for telemetry (ADR-0008). The
    # service account token writes dashboards and alert rules.
    _shape("Grafana service account token", r"\bglsa_[A-Za-z0-9]{32}_[A-Fa-f0-9]{8}\b"),
    # The access policy token, which is what the collector ships metrics with.
    _shape("Grafana Cloud access policy token", r"\bglc_[A-Za-z0-9+/=_-]{32,}"),
    # A Sentry DSN is an ingestion address rather than a credential — the
    # frontend bundle ships with one visible in it. It is refused because it
    # belongs in `VITE_SENTRY_DSN` and not in source: a hardcoded one names the
    # project's real ingest endpoint and outlives whoever pasted it. Only
    # sentry.io is matched, and the public key has to be longer than the
    # sixteen characters of Sentry's documented `examplePublicKey`. A
    # self-hosted DSN is deliberately out of scope — matching one means
    # matching `https://<something>@<any host>/<number>`, which is not a shape
    # that can be refused on sight.
    _shape("Sentry DSN", r"https://[A-Za-z0-9]{20,}@[A-Za-z0-9.-]*\bsentry\.io/\d+"),
    # Three base64url segments, the first two starting with the encoding of
    # `{"` — which is what makes this a JWT rather than three dotted words. The
    # signature length is what separates a real token from the `.signature`
    # stub a test fixture holds.
    _shape(
        "JSON Web Token",
        r"\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{20,}",
    ),
)


# Words that mark a *matched credential* as a fabrication, tested as plain
# substrings. Deliberately long: every one of these is a string that will not
# occur by chance inside a random token, so a real credential is never dropped
# for containing one. Short words like `test` or `your` are not here for
# exactly that reason — `AKIA…YOUR…` is a live key roughly once in a hundred
# and thirty, and silently ignoring it is the worst failure this file has.
FABRICATION_MARKERS = (
    "example",
    "placeholder",
    "redacted",
    "changeme",
    "change-me",
    "change_me",
    "yourkey",
    "your-key",
    "your_token",
    "yourtoken",
    "notreal",
    "replaceme",
    "replace-me",
    "xxxxxx",
    "dummy",
    "sample",
)

# Words that mark a *whole value in an `.example` file* as a placeholder.
# Shorter and more ordinary than the markers above, and matched on word
# boundaries rather than as substrings — `token` here means the value contains
# the word `token`, not that a live key happened to have those five letters
# somewhere inside it.
PLACEHOLDER_WORDS = re.compile(
    r"\b(?:your|test|fake|todo|tbd|insert|fill|here|none|null|unset|secret|token|password)\b",
    re.IGNORECASE,
)

# The shortest a value can be and still be a credible credential. Below this, a
# value in an `.example` file is somebody's shorthand.
SHORTEST_CREDIBLE_VALUE = 12

# Keys in an `.example` file whose value is expected to be a secret. The rule
# below inverts the usual logic for these — anything that is *not* obviously a
# placeholder is reported — so the list stays narrow on purpose.
SECRET_KEY_WORDS = re.compile(
    r"(?:secret|token|password|passwd|api_?key|auth|credential|private|dsn)",
    re.IGNORECASE,
)

# `key = value` or `key: value`, with the value optionally quoted. Comment
# lines are excluded by the leading character class rather than by stripping,
# because `#` and `//` both introduce comments in the file types this applies
# to and neither ever starts a key.
EXAMPLE_ASSIGNMENT = re.compile(r"^\s*(?P<key>[A-Za-z_][A-Za-z0-9_.\-]*)\s*[:=]\s*(?P<value>.*?)\s*$")

FILLED_IN_EXAMPLE = "filled-in value in an example file"


# NamedTuple rather than a dataclass, and that is a latency decision rather
# than a style one: importing `dataclasses` costs about twelve milliseconds of
# a guard whose whole budget is a tenth of a second.
class Finding(NamedTuple):
    """One credential shape, in one place. Never carries the match in full."""

    path: str
    line: int
    shape: str
    redacted: str
    # Empty for everything that reads the working tree, and the commit that
    # first carried the content for everything that reads history. A finding
    # nobody can locate is a finding nobody acts on, and `git show` needs a
    # commit — the path alone points at a file that may no longer exist.
    commit: str = ""

    def render(self) -> str:
        where = f"{self.commit} " if self.commit else ""
        return f"{where}{self.path}:{self.line}: {self.shape} ({self.redacted})"


def _redact(matched: str) -> str:
    """Enough to recognise the match on the line, never enough to use it."""
    return f"{matched[:PREFIX_SHOWN]}… {len(matched)} chars"


def _is_fabricated(matched: str) -> bool:
    lowered = matched.lower()
    return any(marker in lowered for marker in FABRICATION_MARKERS)


def is_example_file(path: str) -> bool:
    """`terraform.tfvars.example`, `.env.example`, `backend.hcl.example`."""
    return path.endswith(".example")


def looks_like_placeholder(value: str) -> bool:
    """Whether a whole right-hand side in an `.example` file is a stand-in.

    Written as a list of the shapes people actually type. Every `.example` file
    in this repository is covered by it, and the test suite holds them to that.
    """
    value = value.strip().strip("\"'").strip()
    if len(value) < SHORTEST_CREDIBLE_VALUE:
        return True
    if "..." in value or ("<" in value and ">" in value):
        return True
    # Shell, Terraform and template interpolation: the value is a reference to
    # something else, so there is nothing here to leak.
    if "${" in value or "{{" in value or value.startswith("var.") or value.startswith("env."):
        return True
    if len(set(value)) == 1:
        return True
    return _is_fabricated(value) or bool(PLACEHOLDER_WORDS.search(value))


def _scan_one_line(path: str, number: int, line: str) -> list[Finding]:
    if ALLOW_MARKER in line:
        return []

    findings = []
    for shape in CREDENTIAL_SHAPES:
        for match in shape.regex.finditer(line):
            # Group 1 where a shape needed surrounding context to be confident
            # — the report should point at the secret, not at the assignment
            # that led to it.
            matched = match.group(1) if match.groups() else match.group(0)
            if _is_fabricated(matched):
                continue
            findings.append(Finding(path, number, shape.name, _redact(matched)))

    if findings or not is_example_file(path):
        return findings

    assignment = EXAMPLE_ASSIGNMENT.match(line)
    if (
        assignment
        and SECRET_KEY_WORDS.search(assignment.group("key"))
        and not looks_like_placeholder(assignment.group("value"))
    ):
        findings.append(Finding(path, number, FILLED_IN_EXAMPLE, _redact(assignment.group("value"))))
    return findings


def scan_text(path: str, text: str) -> list[Finding]:
    findings = []
    for number, line in enumerate(text.splitlines(), start=1):
        findings.extend(_scan_one_line(path, number, line))
    return findings


def scan_paths(paths: Iterable[Path | str]) -> list[Finding]:
    """Whole files, for the sweep and for scanning a single file on request."""
    findings = []
    for path in paths:
        path = Path(path)
        # `git ls-files` lists a submodule as a directory. It is a pointer to a
        # commit rather than content, so there is nothing here to read — the
        # submodule's own guard is the one that covers it.
        if path.is_dir():
            continue
        # Undecodable bytes mean a binary file, which cannot hold a credential
        # this list would recognise anyway.
        text = path.read_text(encoding="utf-8", errors="replace")
        findings.extend(scan_text(str(path), text))
    return findings


def _git(*args: str, binary: bool = False, stdin: str = "") -> str | bytes:
    """One git command, failing loudly. A sweep that cannot read the
    repository has found nothing, and must never be reported as clean."""
    result = subprocess.run(
        ["git", "-c", "core.quotePath=false", *args],
        input=stdin.encode() if binary else stdin,
        capture_output=True,
        text=not binary,
    )
    if result.returncode != 0:
        stderr = result.stderr.decode(errors="replace") if binary else result.stderr
        raise RuntimeError(stderr.strip() or f"git {args[0]} failed")
    return result.stdout


def tracked_paths() -> list[str]:
    """Every file git is tracking, which is every file that will ever be
    pushed. Deliberately not every file on disk: `node_modules`, build output
    and somebody's scratch file are not the repository, and reporting them
    would teach the reader to skim past the report."""
    listing = _git("ls-files", "-z")
    assert isinstance(listing, str)
    return [path for path in listing.split("\0") if path]


def commit_count() -> int:
    """Reported alongside a history scan, so the reader can tell a sweep of
    this repository from a sweep of a shallow clone that holds one commit."""
    count = _git("rev-list", "--all", "--count")
    assert isinstance(count, str)
    return int(count.strip() or 0)


# How many blobs are read from git in one `cat-file` batch. The whole point of
# batching is that the alternative — one process per blob — turns a scan of a
# few thousand objects into a few thousand process spawns; the chunking is so
# that a repository holding a large binary cannot put all of history in memory
# at once.
BLOBS_PER_BATCH = 256


def history_blobs() -> list[tuple[str, str]]:
    """Every blob reachable from any ref, as `(object id, a path it had)`.

    Blobs rather than diffs, and that is the whole correctness argument. A
    diff-walking scan has to decide what to do about merge commits — `git log
    -p` shows no diff for them at all by default — so a credential introduced
    while resolving a conflict is invisible to it. Every version of every file
    that any commit ever held is a blob, so reading the blobs cannot miss one.

    `--all` covers every branch and tag, not just the checked-out one: a branch
    nobody merged is still pushed, still cloned, and still public.

    The path is the one git happened to name the object by. A blob committed at
    two paths is one object with one of them, which is a cosmetic loss — the
    content is scanned either way.
    """
    listing = _git("rev-list", "--objects", "--all")
    assert isinstance(listing, str)

    # An entry with no path is a commit or a tag; a tree has one, so the type
    # is asked for rather than guessed.
    named: dict[str, str] = {}
    for line in listing.splitlines():
        object_id, _, path = line.partition(" ")
        if path and object_id not in named:
            named[object_id] = path

    kinds = _git("cat-file", "--batch-check=%(objectname) %(objecttype)", stdin="\n".join(named))
    assert isinstance(kinds, str)
    blobs = []
    for line in kinds.splitlines():
        object_id, _, kind = line.partition(" ")
        if kind == "blob":
            blobs.append((object_id, named[object_id]))
    return blobs


def _read_blobs(object_ids: Sequence[str]) -> Iterator[tuple[str, bytes]]:
    """`git cat-file --batch` output, unpacked. One process per batch."""
    stream = _git("cat-file", "--batch", binary=True, stdin="\n".join(object_ids) + "\n")
    assert isinstance(stream, bytes)
    at = 0
    while at < len(stream):
        end_of_header = stream.index(b"\n", at)
        header = stream[at:end_of_header].decode().split()
        # `<oid> missing` — impossible for an object git itself just listed,
        # and skipped rather than crashed on so a concurrent `gc` cannot turn
        # a sweep into an error.
        if len(header) != 3:
            at = end_of_header + 1
            continue
        object_id, size = header[0], int(header[2])
        content_starts = end_of_header + 1
        yield object_id, stream[content_starts : content_starts + size]
        # The batch format writes a newline after the content itself.
        at = content_starts + size + 1


def introducing_commit(object_id: str) -> str:
    """The oldest commit that added this content, for a reader to `git show`.

    Only ever called for a blob that already holds a finding, which is why an
    extra git process per finding is affordable and a per-blob one would not
    be. `--find-object` lists every commit that added or removed the object,
    newest first, so the oldest is the last line.
    """
    log = _git("log", "--all", "--format=%h", f"--find-object={object_id}")
    assert isinstance(log, str)
    commits = log.split()
    return commits[-1] if commits else ""


def scan_history(blobs: Sequence[tuple[str, str]] | None = None) -> list[Finding]:
    """Every blob ever committed, in full.

    History is what a scan of the working tree cannot see and a working tree
    cannot be edited to fix: a credential deleted from a file is still in the
    commit that carried it, reachable by anyone who has ever cloned this
    repository. Findings here are reported, never rewritten out — `main`
    refuses force pushes by policy, and rewriting published history is a
    decision for a person rather than for a scan.
    """
    findings = []
    blobs = history_blobs() if blobs is None else blobs
    paths = dict(blobs)
    object_ids = [object_id for object_id, _ in blobs]

    for start in range(0, len(object_ids), BLOBS_PER_BATCH):
        batch = object_ids[start : start + BLOBS_PER_BATCH]
        for object_id, content in _read_blobs(batch):
            # Undecodable bytes mean a binary file, which cannot hold a
            # credential this list would recognise anyway.
            text = content.decode("utf-8", errors="replace")
            for finding in scan_text(paths[object_id], text):
                findings.append(finding._replace(commit=introducing_commit(object_id)))
    return findings


def iter_added_lines(diff: str) -> Iterator[tuple[str, int, str]]:
    """Added lines of a unified diff, with the line numbers they will have.

    Line numbers come from the hunk headers rather than from counting, so they
    are the numbers a reader sees when they open the file — which is the only
    thing that makes a report actionable.

    The parser tracks whether it is inside a hunk, and that is load-bearing
    rather than tidiness: an added line reading `+++ b/somewhere` is content,
    not a header, and a parser that cannot tell the difference can be steered
    into attributing findings to the wrong file or dropping them entirely.
    """
    path: str | None = None
    number = 0
    in_hunk = False
    for line in diff.splitlines():
        if line.startswith("diff --git "):
            path, in_hunk = None, False
        elif not in_hunk and line.startswith("+++ "):
            target = line[4:]
            # A deletion. Nothing is being added, so nothing to report.
            path = None if target == "/dev/null" else target.removeprefix("b/")
        elif line.startswith("@@"):
            header = re.match(r"@@ -\d+(?:,\d+)? \+(\d+)", line)
            if header:
                number = int(header.group(1))
                in_hunk = True
        elif in_hunk and line.startswith("+"):
            if path is not None:
                yield path, number, line[1:]
                number += 1
        elif in_hunk and line.startswith(" "):
            number += 1
        # Removed lines and the diff's own metadata move nothing: a credential
        # being deleted is the commit we want to encourage, not refuse.


def scan_added_lines(diff: str) -> list[Finding]:
    findings = []
    for path, number, text in iter_added_lines(diff):
        findings.extend(_scan_one_line(path, number, text))
    return findings


def staged_diff() -> str:
    """The staged changes, with no context lines and no colour.

    `--unified=0` because only added lines are read and context costs time to
    produce and to parse. `core.quotePath=false` because a path with a
    non-ASCII character would otherwise arrive escaped and be unopenable.
    """
    diff = _git(
        "diff",
        "--cached",
        "--no-color",
        "--no-ext-diff",
        "--unified=0",
        "--diff-filter=ACMR",
    )
    assert isinstance(diff, str)
    return diff


def report(findings: Sequence[Finding], stream=sys.stderr) -> None:
    for finding in findings:
        print(f"  {finding.render()}", file=stream)
    print(file=stream)
    if any(finding.commit for finding in findings):
        # Deliberately not "remove it from history". A rewrite invalidates
        # every clone and every open pull request, `main` refuses force pushes
        # by policy, and none of that undoes a disclosure that has already
        # happened — the credential was public for as long as the commit was.
        print("A credential in history has been published. Rotate it.", file=stream)
        print("Rewriting history is a decision for a person, and it is not a", file=stream)
        print("substitute for rotating: the clones are already out there.", file=stream)
    else:
        print("Move the value into the environment and leave a placeholder behind.", file=stream)
    print(f"If a line is genuinely not a credential, mark it: {ALLOW_MARKER}", file=stream)


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Refuse content that carries a credential.",
        epilog=f"Mark a false positive on its own line with: {ALLOW_MARKER}",
    )
    parser.add_argument(
        "--staged", action="store_true", help="scan the added lines of the staged diff"
    )
    parser.add_argument(
        "--tracked", action="store_true", help="scan every tracked file in full"
    )
    parser.add_argument(
        "--history", action="store_true", help="scan every blob ever committed, in full"
    )
    parser.add_argument(
        "--stdin",
        action="store_true",
        help="scan content on standard input, for a file that is not on disk yet",
    )
    parser.add_argument(
        "--as",
        dest="as_path",
        metavar="PATH",
        help="the path --stdin content would be written to",
    )
    parser.add_argument("paths", nargs="*", help="files to scan in full")
    args = parser.parse_args(argv)

    if sum([args.staged, args.tracked, args.history, args.stdin, bool(args.paths)]) != 1:
        parser.error(
            "choose exactly one of --staged, --tracked, --history, --stdin, or a list of paths"
        )
    if args.stdin and not args.as_path:
        parser.error("--stdin needs --as PATH, so a finding can name the file")

    try:
        if args.staged:
            findings = scan_added_lines(staged_diff())
        # Both repository-wide modes say how much they read, because "no
        # findings" over nothing at all looks exactly like "no findings" over
        # everything. A caller that quietly scanned an empty list is the
        # failure the sweep above this is written to make visible.
        elif args.tracked:
            paths = tracked_paths()
            findings = scan_paths(paths)
            print(f"Read {len(paths)} tracked files.", file=sys.stderr)
        elif args.history:
            blobs = history_blobs()
            findings = scan_history(blobs)
            print(f"Read {len(blobs)} blobs from {commit_count()} commits.", file=sys.stderr)
        elif args.stdin:
            findings = scan_text(args.as_path, sys.stdin.read())
        else:
            findings = scan_paths(args.paths)
    except (OSError, RuntimeError) as error:
        print(f"credential detector: {error}", file=sys.stderr)
        return 2

    if not findings:
        return 0
    report(findings)
    return 1


if __name__ == "__main__":
    sys.exit(main())
