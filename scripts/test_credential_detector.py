#!/usr/bin/env python3
"""
Fixture tests for the credential detector.

Two directions, and the second matters at least as much as the first. A guard
that blocks legitimate work is a guard that gets uninstalled, so the "must not
be caught" half of this file is as load-bearing as the half that proves real
shapes are refused.

Every fixture here is fabricated. None is, or ever was, a live credential —
they are strings of the right shape and length, generated for this file.

They are also written in halves, joined at a point that breaks the pattern that
matches them, so that no source line in this file carries a credential shape.
That is not decoration: this file is committed through the very guard it tests,
and a test suite that can only be committed by bypassing the guard would teach
exactly the wrong habit. Do not "tidy" the halves back together.
"""

from __future__ import annotations

import subprocess
import unittest
from pathlib import Path

import credential_detector as detector

REPO_ROOT = Path(__file__).resolve().parent.parent

# A path with no special meaning to the detector — not an `.example` file, not
# a test fixture. Where a credential is most expensive: ordinary source.
SOURCE_PATH = "apps/web/src/config.ts"

AWS_KEY_ID = "AKIA" + "G1XOLRE4WF6IZD7E"
AWS_SECRET = "txhuvzmWivLuB2gcI+SgeJLPfhYfoaC67+5Q6DZm"
PEM_HEADER = "-----BEGIN RSA " + "PRIVATE KEY-----"
GITHUB_TOKEN = "ghp_" + "hUHzGgaqG1wBLkvZEqm1DiNBKmK0qVg3wGXN"
GITHUB_FINE_GRAINED = (
    "github_pat_" + "mXT3y8ijhPsErZiZ4CD81L_4YaWIOSM4N6wY9TZnugrgrcGE4UoGSt3euiX65o993AAiEYVGpsdzlIZdU0"
)
SLACK_TOKEN = "xoxb-" + "0086989145134-9824019683411-pwx08w5thgoADXWp4kOrDFNB"
SLACK_WEBHOOK = (
    "https://hooks.slack.com/services/" + "T7EZSZ5XPEK/BIGS89YG9QU/TXZ7TQUotNMdsQDfXVdzlWEa"
)
STRIPE_KEY = "sk_live_" + "T3XYsZVxjNkDMFBUXb4ZkmKt"
GOOGLE_API_KEY = "AIza" + "i916RljHIeINtK2FjHcrBFv6HfjTyogLD2c"
OPENAI_KEY = "sk-proj-" + "mSnJjzlKl2bDVzRj1riyn58oni1ihxuXy-FEHz8xM7VWHwB5"
ANTHROPIC_KEY = "sk-ant-" + "api03-Gh5tQxNSEFIGfdtM8_n5lIJP3eaZq99pnt83zr81"
NPM_TOKEN = "npm_" + "dTyoquZqj8OsO97R91w11rjGqIFP1aSGDEWT"
GRAFANA_SERVICE_ACCOUNT = "glsa_" + "kLt79zBQX3B782E96LSxUpNBkmvUyo6s_06649cb4"
GRAFANA_ACCESS_POLICY = "glc_" + "qO2xBqNX2rTFkAeJ7wIRC3jEeAJVLLKK0MGMwmwR"
SENTRY_DSN = "https://" + "3934750e956dd5f057fea693e657a490@o4507.ingest.de.sentry.io/4508"
JWT = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"
    + ".eyJzdWIiOiIxMjM0NTY3ODkwIn0.2-tN9QKj8f2ZRWs6LR1ygRxsdWegBmGm4_CUr76kx4b"
)


# Shapes that must be refused, paired with the name the report has to use, so a
# reader knows what they are looking at without opening this file.
MUST_BE_CAUGHT = [
    ("AWS access key id", f'const key = "{AWS_KEY_ID}";'),
    ("AWS secret access key", f'aws_secret_access_key = "{AWS_SECRET}"'),
    ("private key", PEM_HEADER),
    ("private key", "-----BEGIN " + "PRIVATE KEY-----"),
    ("private key", "-----BEGIN OPENSSH " + "PRIVATE KEY-----"),
    ("private key", "-----BEGIN EC " + "PRIVATE KEY-----"),
    # A Google service account file, flattened into JSON with escaped newlines,
    # which is how one arrives when somebody pastes it into a config.
    ("private key", '{"private_key": "' + PEM_HEADER + '\\nMIIE..."}'),
    ("GitHub token", f"GITHUB_TOKEN={GITHUB_TOKEN}"),
    ("GitHub token", GITHUB_FINE_GRAINED),
    ("Slack token", SLACK_TOKEN),
    ("Slack webhook", SLACK_WEBHOOK),
    ("Stripe live key", STRIPE_KEY),
    ("Google API key", GOOGLE_API_KEY),
    ("OpenAI key", OPENAI_KEY),
    ("Anthropic key", ANTHROPIC_KEY),
    ("npm token", f"//registry.npmjs.org/:_authToken={NPM_TOKEN}"),
    ("Grafana service account token", f'grafana_auth = "{GRAFANA_SERVICE_ACCOUNT}"'),
    ("Grafana Cloud access policy token", GRAFANA_ACCESS_POLICY),
    ("Sentry DSN", f"dsn: '{SENTRY_DSN}'"),
    ("JSON Web Token", f"Authorization: Bearer {JWT}"),
]


# Shapes that must be allowed through. Each one is something that plausibly
# appears in this repository today, or in the next feature somebody writes.
MUST_NOT_BE_CAUGHT = [
    # AWS's own documented example pair. It appears in every tutorial and in a
    # good deal of legitimate documentation.
    ('key = "AKIAIOSFODNN7EXAMPLE"', "AWS's documented example key id"),
    (
        'aws_secret_access_key = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"',
        "AWS's documented example secret",
    ),
    # Sentry's own documented DSN, and the shape a reader writes when
    # describing the environment variable rather than setting it.
    (
        "dsn: 'https://examplePublicKey@o0.ingest.sentry.io/0'",
        "Sentry's documented example DSN",
    ),
    ("VITE_SENTRY_DSN=https://<key>@<org>.ingest.sentry.io/<project>", "an angle-bracket DSN"),
    # Placeholders in the shape people actually write them.
    ('token = "ghp_your_token_here"', "a named placeholder"),
    ('token = "<GITHUB_TOKEN>"', "an angle-bracket placeholder"),
    ('token = "CHANGE-ME"', "a shouted placeholder"),
    ('cloudflare_api_token = "..."', "an elided placeholder"),
    ('token = "${GITHUB_TOKEN}"', "a shell interpolation"),
    ('token = os.environ["GITHUB_TOKEN"]', "reading it from the environment"),
    # Stripe's test keys are published in Stripe's own documentation and are
    # meant to be committed.
    ("sk_test_" + "T3XYsZVxjNkDMFBUXb4ZkmKt", "a Stripe test key"),
    # A JWT-shaped string with a stub signature — what a test fixture holds.
    (
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0In0.signature",
        "a stub-signed JWT in a fixture",
    ),
    # The local stack's password, which is the string `godmodecode` and is
    # written into two committed compose files.
    ("POSTGRES_PASSWORD: godmodecode", "the local stack's password"),
    # Prose about credentials is not a credential.
    ("# The token is a service account token with dashboard write access.", "prose"),
    ("aws_secret_access_key = var.secret", "a Terraform variable reference"),
    # Content-addressed hashes are everywhere in a lockfile and look like
    # nothing else.
    (
        "resolution: {integrity: sha512-Qq7rHy9SVJ0nBUnLmJnBUvYS0hK/JsSqXBLcbxDx1Y0OJcMH0pLpvT3Vs4LDLc0Ag==}",
        "a lockfile integrity hash",
    ),
    ("commit = 32d8652f0a1b9c7d4e5f6a8b9c0d1e2f3a4b5c6d", "a git object id"),
]


class MustBeCaught(unittest.TestCase):
    def test_every_credential_shape_is_reported(self) -> None:
        for expected_rule, line in MUST_BE_CAUGHT:
            with self.subTest(rule=expected_rule, line=line[:24]):
                findings = detector.scan_text(SOURCE_PATH, line)
                self.assertTrue(findings, "nothing matched")
                self.assertEqual(expected_rule, findings[0].rule)


class MustNotBeCaught(unittest.TestCase):
    def test_placeholders_and_ordinary_work_pass(self) -> None:
        for line, description in MUST_NOT_BE_CAUGHT:
            with self.subTest(description=description):
                findings = detector.scan_text(SOURCE_PATH, line)
                self.assertEqual([], findings, f"{description} was flagged")


class ThisRepository(unittest.TestCase):
    """The detector has to be clean against what is already committed here.

    Not a substitute for the whole-repository sweep, which is its own ticket.
    This is narrower and permanent: the files most likely to trip a detector
    are the ones that exist to hold the *shape* of a credential without holding
    one, and if the detector ever starts flagging those it is broken.
    """

    def tracked(self, pattern: str) -> list[Path]:
        """Tracked files matching a pathspec — `git ls-files`, not a filesystem
        glob, so an untracked build directory can never quietly widen this."""
        listing = subprocess.run(
            ["git", "ls-files", "-z", "--", pattern],
            capture_output=True,
            text=True,
            check=True,
            cwd=REPO_ROOT,
        )
        return [REPO_ROOT / name for name in listing.stdout.split("\0") if name]

    def test_every_example_file_is_clean(self) -> None:
        example_files = self.tracked("*.example")
        self.assertTrue(example_files, "no .example files tracked — has the pathspec gone stale?")
        for path in example_files:
            with self.subTest(path=str(path.relative_to(REPO_ROOT))):
                self.assertEqual([], detector.scan_paths([path]))

    def test_the_committed_compose_files_are_clean(self) -> None:
        compose = self.tracked("compose.*.yaml")
        self.assertTrue(compose, "no compose files tracked — has the pathspec gone stale?")
        self.assertEqual([], detector.scan_paths(compose))

    def test_the_detector_and_its_tests_are_clean(self) -> None:
        """The pattern list must not match itself, and this file has to be
        committable through the guard it configures."""
        own_files = self.tracked("scripts/*credential_detector.py")
        self.assertTrue(own_files, "the detector is not tracked yet — stage it before running this")
        self.assertEqual([], detector.scan_paths(own_files))


class ExampleFiles(unittest.TestCase):
    """`*.example` files are held to a stricter rule than source.

    A `.example` file exists to be copied and filled in, so a value in one that
    is *not* a placeholder is a value somebody pasted in by accident. The
    detector cannot know the shape of every credential a future example will
    hold, so here it inverts: anything under a secret-sounding key that does
    not look like a placeholder is reported.
    """

    EXAMPLE_PATH = "infra/terraform/terraform.tfvars.example"

    def test_a_real_value_under_a_secret_key_is_reported(self) -> None:
        content = 'grafana_auth = "hJ3kQz9WmR2vT8xL5nB7cF4dP0sY6gA1"\n'
        findings = detector.scan_text(self.EXAMPLE_PATH, content)
        self.assertEqual(1, len(findings))
        self.assertEqual("filled-in value in an example file", findings[0].rule)

    def test_placeholders_under_secret_keys_pass(self) -> None:
        content = "\n".join(
            [
                "# The token is a service account token with write access.",
                'grafana_auth = "glsa_..."',
                'cloudflare_api_token = "..."',
                'api_key         = "<your-key>"',
                'password = ""',
                'secret = "CHANGE-ME"',
                "token = var.cloudflare_api_token",
                'grafana_url  = "https://<stack>.grafana.net"',
            ]
        )
        self.assertEqual([], detector.scan_text(self.EXAMPLE_PATH, content))

    def test_a_non_secret_key_is_not_held_to_the_rule(self) -> None:
        content = 'bucket = "gmc-terraform-state-3f9a2b7c1d"\n'
        self.assertEqual([], detector.scan_text("infra/terraform/backend.hcl.example", content))

    def test_ordinary_files_are_not_held_to_the_rule(self) -> None:
        content = 'const apiKey = "hJ3kQz9WmR2vT8xL5nB7cF4dP0sY6gA1";\n'
        self.assertEqual([], detector.scan_text(SOURCE_PATH, content))


class AllowMarker(unittest.TestCase):
    """The marker is the answer to a false positive. Bypassing the hook is not.

    It sits on the line itself, so the reason travels with the string and a
    reviewer sees it in the same diff hunk — rather than in a separate ignore
    file that gets appended to until it covers everything.
    """

    def test_a_marked_line_is_not_reported(self) -> None:
        line = f'const key = "{AWS_KEY_ID}"; // {detector.ALLOW_MARKER}'
        self.assertEqual([], detector.scan_text(SOURCE_PATH, line))

    def test_the_marker_only_covers_its_own_line(self) -> None:
        content = "\n".join(
            [
                f'const a = "{AWS_KEY_ID}"; // {detector.ALLOW_MARKER}',
                f'const b = "{AWS_KEY_ID}";',
            ]
        )
        findings = detector.scan_text(SOURCE_PATH, content)
        self.assertEqual(1, len(findings))
        self.assertEqual(2, findings[0].line)


class Reporting(unittest.TestCase):
    def test_a_finding_names_the_file_the_line_and_the_rule(self) -> None:
        content = "\n".join(["const a = 1;", "const b = 2;", f'const key = "{AWS_KEY_ID}";'])
        findings = detector.scan_text(SOURCE_PATH, content)
        self.assertEqual(1, len(findings))
        self.assertEqual(SOURCE_PATH, findings[0].path)
        self.assertEqual(3, findings[0].line)
        self.assertEqual("AWS access key id", findings[0].rule)

    def test_the_report_does_not_repeat_the_credential(self) -> None:
        """A refusal that echoes the secret writes it into a terminal
        scrollback, a CI log and, on a shared runner, an artifact — turning a
        near miss into an actual disclosure."""
        findings = detector.scan_text(SOURCE_PATH, f'const key = "{AWS_KEY_ID}";')
        rendered = findings[0].render()
        self.assertNotIn(AWS_KEY_ID, rendered)
        self.assertIn(f"{SOURCE_PATH}:1", rendered)
        self.assertIn("AWS access key id", rendered)


class AddedLinesOfADiff(unittest.TestCase):
    """The guard reads added lines, not whole files, and the distinction is the
    difference between a guard people keep and one they rip out.

    Scanning whole staged files would mean one pre-existing finding anywhere in
    a file blocks every future commit that touches it — including the commit
    that removes the finding. Judging what is already here is the sweep's job,
    not the hook's.
    """

    DIFF = f"""diff --git a/apps/web/src/config.ts b/apps/web/src/config.ts
index 1234567..89abcde 100644
--- a/apps/web/src/config.ts
+++ b/apps/web/src/config.ts
@@ -4,0 +5,2 @@ export const config = {{
+  region: "ap-south-1",
+  key: "{AWS_KEY_ID}",
@@ -20 +21 @@ export const other = {{
-  removed: "{AWS_KEY_ID}",
+  kept: true,
"""

    def test_added_lines_carry_the_numbers_they_will_have_in_the_file(self) -> None:
        self.assertEqual(
            [
                ("apps/web/src/config.ts", 5, '  region: "ap-south-1",'),
                ("apps/web/src/config.ts", 6, f'  key: "{AWS_KEY_ID}",'),
                ("apps/web/src/config.ts", 21, "  kept: true,"),
            ],
            list(detector.iter_added_lines(self.DIFF)),
        )

    def test_a_removed_credential_is_not_a_finding(self) -> None:
        findings = detector.scan_added_lines(self.DIFF)
        self.assertEqual(1, len(findings))
        self.assertEqual(6, findings[0].line)

    def test_a_rename_takes_the_new_path(self) -> None:
        diff = f"""diff --git a/old.ts b/new.ts
similarity index 90%
rename from old.ts
rename to new.ts
--- a/old.ts
+++ b/new.ts
@@ -1 +1 @@
-const a = 1;
+const key = "{AWS_KEY_ID}";
"""
        findings = detector.scan_added_lines(diff)
        self.assertEqual(1, len(findings))
        self.assertEqual("new.ts", findings[0].path)

    def test_a_deleted_file_contributes_nothing(self) -> None:
        diff = f"""diff --git a/gone.ts b/gone.ts
deleted file mode 100644
--- a/gone.ts
+++ /dev/null
@@ -1 +0,0 @@
-const key = "{AWS_KEY_ID}";
"""
        self.assertEqual([], detector.scan_added_lines(diff))

    def test_a_binary_file_contributes_nothing(self) -> None:
        diff = """diff --git a/logo.png b/logo.png
index 1234567..89abcde 100644
Binary files a/logo.png and b/logo.png differ
"""
        self.assertEqual([], detector.scan_added_lines(diff))


class CommandLine(unittest.TestCase):
    """The exit status is the whole interface for every caller: the commit
    guard, the sweep, and the write guard. Three states, and "could not run"
    must never be mistaken for "found nothing"."""

    def run_detector(self, *args: str, stdin: str = "") -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            ["python3", str(REPO_ROOT / "scripts" / "credential_detector.py"), *args],
            input=stdin,
            capture_output=True,
            text=True,
            cwd=REPO_ROOT,
        )

    def test_clean_content_exits_zero(self) -> None:
        result = self.run_detector("--stdin", "--as", SOURCE_PATH, stdin="const a = 1;\n")
        self.assertEqual(0, result.returncode, result.stderr)

    def test_a_finding_exits_one_and_names_the_rule(self) -> None:
        result = self.run_detector(
            "--stdin", "--as", SOURCE_PATH, stdin=f'const key = "{AWS_KEY_ID}";\n'
        )
        self.assertEqual(1, result.returncode)
        self.assertIn("AWS access key id", result.stdout + result.stderr)

    def test_a_missing_path_exits_two(self) -> None:
        self.assertEqual(2, self.run_detector("no/such/file.ts").returncode)

    def test_no_arguments_exits_two(self) -> None:
        self.assertEqual(2, self.run_detector().returncode)


if __name__ == "__main__":
    unittest.main()
