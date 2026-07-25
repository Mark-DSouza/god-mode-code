-- V1 — baseline.
--
-- The walking skeleton has no domain tables yet: Users and Handles arrive with
-- their own ticket, Runs with theirs. What this migration establishes is the
-- mechanism — that migrations run on startup, that exactly one instance applies
-- them, and that a fresh database is a working one — plus the two extensions
-- every later migration will assume are present.
--
-- Conventions for everything that follows:
--   * one migration per change, never edited after it has been applied anywhere
--   * `V<n>__snake_case_description.sql`
--   * content ships as migrations too, so a fresh database is populated
--   * timestamps are `timestamptz`, always; the site is not in one timezone

-- Case-insensitive text. A Handle is unique regardless of case — nobody should
-- be able to register PERCOLATING_FERRET alongside Percolating_Ferret — and
-- getting that from a column type is far harder to forget than remembering to
-- `lower()` both sides of every comparison forever.
CREATE EXTENSION IF NOT EXISTS citext;

-- Digest and random-bytes helpers, used to hash the raw payloads a Run is
-- verified from. Note that `gen_random_uuid()` is core PostgreSQL since 13 and
-- does not need this.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
