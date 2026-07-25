# Runs are verified server-side against a single-use Issue

The client never reports a metric that is trusted. The server hands out a
Challenge, records an Issue (who, what, when, expires when), and on submission
recomputes WPM and Accuracy from raw data — the typed text, the keystroke count,
the timestamps — discarding whatever the client calculated.

Leaderboards are public and shared, which makes client-reported scores worthless;
anyone with devtools could otherwise post a perfect run. The Issue exists because
a server-recorded `issued_at` alone gives only a _lower_ bound on when a Run could
have started. Without an upper bound, a player can request a Passage, rehearse it
in a text editor for an hour, then type it flawlessly — and every measurable
signal looks legitimate. Expiry is that upper bound. Single use (`consumed_at`)
blocks replay, and permitting only one live Issue per User prevents holding
several Challenges and submitting whichever went best.

## Consequences

Expiry must be generous enough not to punish slow typists — scaled to passage
length with a floor of ten minutes — and the client must detect expiry _before_
the player starts typing. Rejecting a submission after four minutes of work is a
bug report, not a security control.
