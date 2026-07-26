-- V3 — Passages.
--
-- A fixed piece of text to be transcribed, belonging to the Quotes or Prose
-- Discipline. The Code Discipline has Patterns rather than Passages (ADR-0004),
-- which is why the check below names only two of the three Disciplines.
--
-- The content itself ships in the next migration rather than a seeding script,
-- so a fresh database is a working one.

CREATE TABLE passages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Text with a CHECK rather than a PostgreSQL enum type. A fourth Discipline
    -- would need ALTER TYPE ... ADD VALUE, which cannot run inside a
    -- transactional migration on older servers and cannot be reversed at all;
    -- a CHECK is an ordinary DDL statement that Flyway can apply and a later
    -- migration can replace.
    discipline text NOT NULL,

    -- `text` is a non-reserved keyword in PostgreSQL, so the domain's word for
    -- this survives as the column name without quoting.
    text text NOT NULL,

    -- Never null and never empty: a Passage without an attribution is a
    -- quotation nobody said, and the Quotes Discipline is built on the
    -- attribution being shown beside the words.
    attribution text NOT NULL,

    -- Generated rather than supplied. The character count is what expiry is
    -- scaled against (ADR-0003) and what a Run's completeness is measured
    -- against, so a stored count that disagreed with the text would silently
    -- mis-time every Run of that Passage.
    character_count integer NOT NULL GENERATED ALWAYS AS (length(text)) STORED,

    created_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT passages_discipline_known CHECK (discipline IN ('QUOTES', 'PROSE')),

    -- Printable ASCII only, space through tilde.
    --
    -- This is a typing test, so every character in a Passage has to be one a
    -- player can produce on an ordinary keyboard. A curly apostrophe or an em
    -- dash pasted in from a source text is unreachable on most layouts and
    -- would make the Passage impossible to complete — and a Run only ends when
    -- the final character is typed. The range also excludes newlines and tabs,
    -- which the Quotes and Prose surfaces do not render as anything typeable.
    CONSTRAINT passages_text_typeable CHECK (text ~ '^[ -~]+$'),
    CONSTRAINT passages_attribution_typeable CHECK (attribution ~ '^[ -~]+$'),

    -- The floor keeps a Run long enough to measure — a dozen words is noise,
    -- not a speed. The ceiling is where a Passage stops fitting the typing
    -- surface without scrolling, which would hide the caret mid-Run.
    CONSTRAINT passages_text_length CHECK (length(text) BETWEEN 120 AND 900),

    -- The same words issued twice under two ids would split a Passage
    -- Leaderboard in half.
    CONSTRAINT passages_text_unique UNIQUE (text)
);

-- Every read of this table is "give me a Passage in this Discipline". The
-- catalogue is small enough that the planner may well sequential-scan it for
-- now; the index is here so that stops being true as the catalogue grows.
CREATE INDEX passages_by_discipline ON passages (discipline);

COMMENT ON COLUMN passages.text IS
    'Printable ASCII only -- every character must be typeable on an ordinary keyboard.';
