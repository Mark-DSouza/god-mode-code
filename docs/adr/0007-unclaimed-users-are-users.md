# Unclaimed Users are Users

A guest is a `User` row with a null credential reference — not a separate entity,
not a shadow record. Claiming attaches credentials to that same row. If the
player signs in to a User that already exists, the Unclaimed User's Runs are
merged into it silently and always.

Unclaimed Users have Handles, Runs, Personal Bests, and full Leaderboard
placement — everything a registered player has, differing only in whether
credentials are attached. Two entities would force a union into every leaderboard
query and turn signup into a data migration rather than a state change.

The merge is silent because Runs are append-only facts: there is no conflict to
resolve, only a `user_id` to rewrite and a Personal Best to recompute. Discarding
them would destroy player data to save a transaction, and prompting would ask
someone to make a decision where only one answer is ever correct.

## Consequences

Guests appear on all Leaderboards at every time range, so the defence against
Handle-farming is rate limiting, Turnstile, and Verification (ADR-0003) rather
than exclusion. The incentive to sign up is therefore persistence and a chosen
Handle, not access.
