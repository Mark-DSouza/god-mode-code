-- V2 — Users and Handles.
--
-- One table, because an Unclaimed User is a User with no credentials attached
-- rather than a separate kind of record (ADR-0007). Claiming sets
-- `credential_subject`; nothing else about the row changes, so no leaderboard
-- query ever has to union two sources and signing in is a state change rather
-- than a data migration.

-- `users`, not `user`: USER is a reserved word in PostgreSQL and `CREATE TABLE
-- user` is a syntax error. USERS is not reserved, so the domain term survives
-- intact without every statement having to quote it.
CREATE TABLE users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    -- citext (V1), so PERCOLATING_FERRET and Percolating_Ferret are the same
    -- Handle. Case-folding at the column means the uniqueness guarantee cannot
    -- be lost by one query that forgot to lower() both sides.
    handle citext NOT NULL,

    -- The federated subject from the identity provider once the User is Claimed
    -- (ADR-0011). NULL is the Unclaimed state, and NULLs do not collide under a
    -- UNIQUE constraint in PostgreSQL — so every Unclaimed User coexists happily
    -- while no two Claimed Users can share an identity.
    credential_subject text,

    -- SHA-256, hex, of the opaque key the browser holds in a cookie. Hashed
    -- rather than stored raw for the same reason a password would be: a leaked
    -- database should not hand over every visitor's identity. It is deliberately
    -- not the id — the id will appear in public Leaderboard payloads, and an
    -- identifier that is also a bearer secret is forgeable the moment it is
    -- published.
    recognition_key_hash text NOT NULL,

    created_at timestamptz NOT NULL DEFAULT now(),

    -- The acceptance criterion that Handles are unique "enforced by the database
    -- rather than by application logic alone" is this line. Generation races
    -- lose here, not in a check-then-insert the application performs.
    CONSTRAINT users_handle_unique UNIQUE (handle),
    CONSTRAINT users_recognition_key_hash_unique UNIQUE (recognition_key_hash),
    CONSTRAINT users_credential_subject_unique UNIQUE (credential_subject),

    -- 22 characters is the width a Handle has to fit in a Leaderboard row at the
    -- narrowest supported viewport; the derivation lives in HandleWords. The cap
    -- is repeated here because the word lists are only one way a Handle can be
    -- set — a rename on Claiming is the other, and it must not be able to
    -- produce a Handle that breaks the layout.
    CONSTRAINT users_handle_length CHECK (length(handle) BETWEEN 3 AND 22),

    -- Deliberately the character set and not the GERUND_CREATURE shape. That
    -- shape is what the *generator* produces, and it stops being true the moment
    -- Claiming lets someone choose their own — a constraint that has to be
    -- dropped by the next feature is a constraint that was describing the wrong
    -- thing. What is true of every Handle forever is that it is one word of
    -- letters, digits and underscores, with nothing in it that a Leaderboard row
    -- has to escape.
    CONSTRAINT users_handle_charset CHECK (handle ~ '^[A-Za-z0-9_]+$')
);

-- Looking a visitor up by the cookie they present is the single hottest read on
-- the site: it happens on every page load. The UNIQUE constraint above already
-- creates the index that serves it, so there is nothing further to add — this
-- comment exists so the next person does not add a redundant one.
COMMENT ON COLUMN users.recognition_key_hash IS
    'SHA-256 (hex) of the opaque key held by the browser. Never the raw key.';
