-- V5 — Issues, and the Typing Runs verified against them.
--
-- ADR-0003 is the whole of this migration. The server hands out a Challenge and
-- writes down who got what and when; on submission it recomputes the metrics
-- from raw data and discards whatever the client claimed. Nothing here stores a
-- number the browser sent.

-- A server's record that a specific Challenge was handed to a specific User at
-- a specific moment. Single-use and short-lived; a Run cannot exist without one.
CREATE TABLE issues (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Deleting a User takes their Issues with them; an Issue against nobody
    -- records nothing.
    user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,

    -- No cascade. A Passage that has been issued cannot simply be deleted --
    -- doing so would rewrite what a recorded Run was a Run *of*. Retiring a
    -- Passage is a state change on the Passage, which is a later ticket's
    -- problem and not a DELETE.
    passage_id uuid NOT NULL REFERENCES passages (id),

    -- Server-owned, both of them. `issued_at` is the lower bound on when a Run
    -- could have started; `expires_at` is the upper bound that stops a player
    -- rehearsing a Passage for an hour and then typing it flawlessly. The
    -- application computes the expiry rather than the default doing it, because
    -- it scales with the Passage's length.
    issued_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL,

    -- Set when a Typing Run is verified against this Issue. This is what makes
    -- it single-use: a replayed submission finds the Issue already consumed.
    consumed_at timestamptz,

    -- Set when the User asks for another Challenge before using this one.
    -- Distinct from consumed on purpose: consumed means a Run exists, superseded
    -- means the player walked away, and collapsing them would make "how often is
    -- a Challenge abandoned" unanswerable.
    superseded_at timestamptz,

    CONSTRAINT issues_expire_after_issue CHECK (expires_at > issued_at),
    CONSTRAINT issues_consumed_after_issue CHECK (consumed_at IS NULL OR consumed_at >= issued_at),

    -- An Issue is settled once or not at all. Both columns set would mean a Run
    -- was verified against a Challenge the player had already abandoned.
    CONSTRAINT issues_settled_once CHECK (consumed_at IS NULL OR superseded_at IS NULL)
);

-- One live Issue per User, enforced here rather than by the application.
--
-- Without it a player can hold several Challenges at once and submit whichever
-- went best (ADR-0003), and no amount of check-then-insert in Java closes that
-- race -- two requests arriving together would both find nothing live. The
-- partial index makes the database the arbiter: issuing supersedes whatever was
-- live and then inserts, and a second session racing it loses on this index.
--
-- Expired-but-unconsumed Issues still occupy the slot, which is correct: they
-- are cleared by the same supersede step, in the same transaction, on the next
-- request.
CREATE UNIQUE INDEX issues_one_live_per_user
    ON issues (user_id)
    WHERE consumed_at IS NULL AND superseded_at IS NULL;

-- A Run against a Passage, measured by WPM and Accuracy. Cannot fail -- it is
-- either completed and recorded or it never happened (ADR-0006: no polymorphic
-- Run, so a Solve Run gets its own table when it lands).
CREATE TABLE typing_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    passage_id uuid NOT NULL REFERENCES passages (id),

    -- UNIQUE is the second half of single use. `consumed_at` on the Issue is the
    -- check the application makes; this is the one the database makes, and it is
    -- the one that holds when two replays of the same submission arrive at once.
    issue_id uuid NOT NULL REFERENCES issues (id),

    -- ---- raw, as submitted and then bounded by verification ----

    -- Total character keystrokes, including the ones that were wrong and later
    -- corrected. Backspaces are not keystrokes for this purpose: Accuracy is
    -- correct keystrokes over total keystrokes, and counting the correction as
    -- well as the mistake would penalise a fixed error twice.
    keystrokes integer NOT NULL,

    -- How many of the Passage's characters the final typed text got right.
    correct_characters integer NOT NULL,

    elapsed_millis integer NOT NULL,

    -- ---- derived, by the server, from the three columns above ----

    -- Stored rather than computed per query because every Leaderboard sorts by
    -- WPM, and a ranking that recomputes the metric for every row cannot use an
    -- index. Both are the server's own arithmetic over the raw columns beside
    -- them; the client's figures never reach this table.
    wpm numeric(6, 1) NOT NULL,
    accuracy numeric(4, 1) NOT NULL,

    -- Generated, because it is a subtraction rather than a formula and a stored
    -- error count that disagreed with the keystrokes beside it would be a bug
    -- nobody could see.
    errors integer NOT NULL GENERATED ALWAYS AS (keystrokes - correct_characters) STORED,

    completed_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT typing_runs_one_per_issue UNIQUE (issue_id),

    -- A Run in no time at all is not a Run. Verification rejects these long
    -- before they reach the table; the constraint is here so that a future code
    -- path that forgets to cannot write one.
    CONSTRAINT typing_runs_elapsed_positive CHECK (elapsed_millis > 0),
    CONSTRAINT typing_runs_keystrokes_positive CHECK (keystrokes > 0),
    CONSTRAINT typing_runs_correct_within_keystrokes
        CHECK (correct_characters BETWEEN 0 AND keystrokes),
    CONSTRAINT typing_runs_accuracy_range CHECK (accuracy BETWEEN 0 AND 100),
    CONSTRAINT typing_runs_wpm_range CHECK (wpm BETWEEN 0 AND 400)
);

-- Two reads are coming: a User's own history, and a Passage's Leaderboard. Both
-- want the fastest Runs first, which is what the descending WPM in each index
-- gives them.
CREATE INDEX typing_runs_by_user ON typing_runs (user_id, wpm DESC);
CREATE INDEX typing_runs_by_passage ON typing_runs (passage_id, wpm DESC);

COMMENT ON COLUMN typing_runs.wpm IS
    'Server-computed: correct characters / 5, over elapsed minutes. Never the client''s figure.';
COMMENT ON COLUMN typing_runs.accuracy IS
    'Server-computed: correct characters over total keystrokes, as a percentage.';
