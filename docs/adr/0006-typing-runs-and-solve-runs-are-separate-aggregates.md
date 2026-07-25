# Typing Runs and Solve Runs are separate aggregates

There is no polymorphic `Run` — no shared supertype, no JPA inheritance strategy,
no discriminator column. `TypingRun` and `SolveRun` are unrelated entities in
separate tables.

They share only a User and a timestamp. A Typing Run has Accuracy and an error
count and _cannot fail_; a Solve Run has a Verdict, test counts, and submitted
source, and _can_. Modelling them as one entity leaves half the columns null at
all times, prevents the database from enforcing which are required for which
kind, and grows a `WHERE discipline <> 'CODE'` clause into every leaderboard
query — one of which will eventually be forgotten. They are never dispatched
polymorphically, so inheritance would buy nothing and cost the well-known
surprises of Hibernate inheritance mappings.

The price is that the profile timeline and "all my Runs" issue two queries and
interleave them in the service layer. That is about fifteen lines, written once.
