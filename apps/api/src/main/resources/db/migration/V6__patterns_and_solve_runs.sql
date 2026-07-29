-- V6 — Patterns, and the Solve Runs judged against them.
--
-- The Code Discipline is Pattern puzzles judged by executing Hidden Tests
-- (ADR-0004), not snippets transcribed like a Passage. Nothing here has a
-- target text, which is why nothing here has an accuracy column: a Solve Run
-- has no text to be accurate against (ADR-0006).
--
-- A Solve Run is a separate aggregate from a Typing Run, in its own table, with
-- no shared supertype. What they do share is the integrity model: one Issue
-- records that one Challenge went to one User, and both kinds of Run are
-- verified against it (ADR-0003). That is why this migration widens `issues`
-- rather than giving Patterns an issuing mechanism of their own.

-- A distilled algorithmic technique posed as a puzzle: "store what you've seen,
-- look up what you need" rather than "solve Two Sum".
CREATE TABLE patterns (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    -- The identifier the judge knows this Pattern by. The judge compiles its
    -- catalogue into its binary and has no database (ADR-0005), so this string
    -- is the only thing joining the two halves of a Pattern: everything a
    -- player reads lives here, and the Hidden Tests live over there. A slug
    -- rather than the uuid because the judge's catalogue is hand-written JSON,
    -- and a file named after a uuid is a file nobody can review.
    slug text NOT NULL,

    name text NOT NULL,

    -- Text with a CHECK rather than a PostgreSQL enum, for the same reason
    -- `passages.discipline` is: a ninth Family would need ALTER TYPE ... ADD
    -- VALUE, which cannot be reversed and cannot run inside a transactional
    -- migration on older servers.
    family text NOT NULL,
    seniority text NOT NULL,

    -- The technique, in the player's words. Original prose describing a
    -- technique, never a reproduced problem statement (ADR-0004).
    prompt text NOT NULL,

    -- The read-only lines shown above the editable region, typically the
    -- function signature. The submitted source is assembled from this plus what
    -- the player wrote, so it is also half of every program the judge executes.
    scaffold text NOT NULL,

    -- A solution that is known to work, used for one thing: proving the tests
    -- are correct before this Pattern is ever handed to anybody. Never leaves
    -- the backend — no endpoint reads this column, because an endpoint that did
    -- would be an endpoint that hands out the answer.
    reference_solution text NOT NULL,

    -- Null until the reference solution has been executed against every one of
    -- this Pattern's tests and passed them all. That gate is the only guarantee
    -- the tests are correct, and its absence is what made the superseded design
    -- unworkable: a Pattern whose Hidden Tests are wrong fails every honest
    -- player and there is no way to find out except by being one of them.
    activated_at timestamptz,

    created_at timestamptz NOT NULL DEFAULT now(),

    -- One Pattern per slug, because the slug is what the judge is asked for. Two
    -- rows sharing one would send two different puzzles to the same tests.
    CONSTRAINT patterns_slug_unique UNIQUE (slug),

    -- Lowercase, digits and dashes: it is a filename in the judge's catalogue
    -- and a segment of a URL, and it should be neither surprising as either.
    CONSTRAINT patterns_slug_shape CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),

    CONSTRAINT patterns_family_known CHECK (family IN (
        'HASH_MAP', 'TWO_POINTERS', 'SLIDING_WINDOW', 'STACK',
        'HEAP', 'BINARY_SEARCH', 'GRAPH', 'DYNAMIC_PROGRAMMING'
    )),
    CONSTRAINT patterns_seniority_known CHECK (seniority IN ('JUNIOR', 'SENIOR', 'PRINCIPAL')),

    -- The editable region is four to eight lines (ADR-0004). A Scaffold longer
    -- than the answer is a Pattern that has given itself away.
    CONSTRAINT patterns_scaffold_present CHECK (length(scaffold) > 0),
    CONSTRAINT patterns_reference_solution_present CHECK (length(reference_solution) > 0)
);

-- Browsing is always "the Patterns in this Family", optionally narrowed by
-- Seniority, and never the inactive ones.
CREATE INDEX patterns_browsable ON patterns (family, seniority) WHERE activated_at IS NOT NULL;

-- One assertion a submitted source must satisfy, belonging to one Pattern.
--
-- Both kinds live here, distinguished by `hidden`, but they are stored for two
-- different reasons and only one of them is ever served. Example Tests are shown
-- to the player before they start, so they know the contract they are judged
-- against. Hidden Tests are here so that activation can check the judge is
-- judging against the same set the curator wrote: the judge's own catalogue is
-- compiled into its binary and deployed separately, so the two can skew, and a
-- judge running an older Pattern with fewer tests would quietly pass sources
-- nobody checked. No endpoint reads a hidden row.
CREATE TABLE pattern_tests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Cascade: a test without its Pattern asserts nothing.
    pattern_id uuid NOT NULL REFERENCES patterns (id) ON DELETE CASCADE,

    hidden boolean NOT NULL,

    name text NOT NULL,

    -- A Python expression invoking the entry point, carrying inputs only. The
    -- submitted source is free to read it — it is being asked to compute
    -- exactly this.
    call text NOT NULL,

    -- A Python literal: the answer the call must produce. Kept apart from the
    -- call rather than written as one comparison, so that the expected answer
    -- never has to enter the process running the submitted source.
    expected text NOT NULL,

    -- The order Example Tests are shown in. Two tests that read as a sequence
    -- ("the simple case", "then the awkward one") are a worse contract in a
    -- random order.
    ordinal integer NOT NULL,

    CONSTRAINT pattern_tests_named_once UNIQUE (pattern_id, name),
    CONSTRAINT pattern_tests_ordered UNIQUE (pattern_id, ordinal)
);

CREATE INDEX pattern_tests_by_pattern ON pattern_tests (pattern_id, ordinal);

-- ---------------------------------------------------------------- Issues ----
--
-- An Issue was a Passage going out; it is now a Challenge going out, and a
-- Challenge is either a Passage or a Pattern. Exactly one of the two columns is
-- set, enforced here rather than by whichever service happens to write the row.

ALTER TABLE issues
    ALTER COLUMN passage_id DROP NOT NULL,
    -- No cascade, for the reason `passage_id` has none: deleting a Pattern that
    -- has been issued would rewrite what a recorded Run was a Run *of*.
    ADD COLUMN pattern_id uuid REFERENCES patterns (id),
    ADD CONSTRAINT issues_one_challenge CHECK (
        (passage_id IS NOT NULL AND pattern_id IS NULL)
        OR (passage_id IS NULL AND pattern_id IS NOT NULL)
    );

COMMENT ON COLUMN issues.pattern_id IS
    'Set when the Challenge was a Pattern to solve. Exactly one of passage_id and pattern_id is.';

-- ------------------------------------------------------------ Solve Runs ----

-- A Run against a Pattern, measured by Verdict and duration, with WPM as a
-- secondary reading. Unlike a Typing Run, it can fail — and a failure is a
-- recorded Run, not an absence of one.
CREATE TABLE solve_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    pattern_id uuid NOT NULL REFERENCES patterns (id),

    -- The same second half of single use that typing_runs has: the application
    -- checks `consumed_at`, and this constraint is what holds when two replays
    -- of one submission arrive together.
    issue_id uuid NOT NULL REFERENCES issues (id),

    -- The judge's word, and the only thing that can produce it. Deliberately
    -- not defaulted: a Solve Run without a Verdict is a Solve Run that never
    -- happened.
    verdict text NOT NULL,

    tests_passed integer NOT NULL,
    tests_total integer NOT NULL,

    -- What the player wrote, with the Scaffold excluded — the Scaffold is the
    -- Pattern's and is the same on every Run of it. Stored because a Solve Run
    -- has no target text to be compared against later, so the source is the
    -- only evidence of what was actually judged.
    source text NOT NULL,

    -- Every character key pressed. A four-line answer is trivially pasteable
    -- (ADR-0004), so this is stored beside the source it produced; comparing
    -- the two is a later ticket's defence, and it needs the number to have been
    -- kept from the first Run onwards.
    keystrokes integer NOT NULL,

    elapsed_millis integer NOT NULL,

    -- All typed characters over five, per minute (CONTEXT.md) — every character
    -- rather than only the correct ones, because correctness here is a Verdict
    -- and not a per-character property. Secondary: a Solve Run is ranked by
    -- Verdict and duration, and this is a reading, not the score.
    wpm numeric(6, 1) NOT NULL,

    completed_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT solve_runs_one_per_issue UNIQUE (issue_id),
    CONSTRAINT solve_runs_verdict_known
        CHECK (verdict IN ('PASSED', 'FAILED', 'TIMEOUT', 'ERROR')),
    CONSTRAINT solve_runs_elapsed_positive CHECK (elapsed_millis > 0),
    CONSTRAINT solve_runs_keystrokes_positive CHECK (keystrokes > 0),
    CONSTRAINT solve_runs_tests_counted CHECK (tests_passed BETWEEN 0 AND tests_total),
    -- A Passed Verdict means every test was satisfied. Anything else recorded as
    -- Passed would rank a Solve Run that was not.
    CONSTRAINT solve_runs_passed_means_all_tests
        CHECK (verdict <> 'PASSED' OR tests_passed = tests_total),
    CONSTRAINT solve_runs_wpm_range CHECK (wpm BETWEEN 0 AND 400)
);

-- The two reads coming: a User's own history, and a Pattern's Leaderboard.
-- Only Passed Solve Runs are ranked, and they are ranked by how long they took,
-- so the Leaderboard index carries both.
CREATE INDEX solve_runs_by_user ON solve_runs (user_id, completed_at DESC);
CREATE INDEX solve_runs_by_pattern ON solve_runs (pattern_id, elapsed_millis)
    WHERE verdict = 'PASSED';

COMMENT ON TABLE solve_runs IS
    'A Run against a Pattern. Has a Verdict and can fail; has no Accuracy, because there is no target text (ADR-0006).';
COMMENT ON COLUMN patterns.reference_solution IS
    'Proves the tests are correct at activation time. Never served over any endpoint.';
