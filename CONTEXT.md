# GOD_MODE_CODE

A speed-typing site with three disciplines. Two of them measure how fast you can
transcribe text; the third measures how fast you can recall an algorithmic
technique. Anyone can play immediately without an account.

## Language

### Playing

**Discipline**:
One of the three ways to play: Quotes, Prose, or Code. Determines what you are
given and how you are judged.
_Avoid_: Mode, category, game type

**Challenge**:
The thing you are asked to do in a single sitting — a Passage to transcribe or a
Pattern to solve. The umbrella term when the Discipline doesn't matter.
_Avoid_: Test, exercise, task

**Passage**:
A fixed piece of text to be transcribed, belonging to the Quotes or Prose
Discipline. Has an attribution.
_Avoid_: Quote, text, snippet, prompt

**Pattern**:
A distilled algorithmic technique posed as a puzzle — "store what you've seen,
look up what you need" rather than "solve Two Sum". The unit of the Code
Discipline. Never abbreviated.
_Avoid_: Problem, question, kata, motif, exercise, technique

**Family**:
The grouping a Pattern belongs to: Hash Map, Two Pointers, Sliding Window,
Stack, Heap, Binary Search, Graph, DP.
_Avoid_: Category, group, topic, tag

**Seniority**:
The difficulty band of a Challenge: Junior, Senior, or Principal.
_Avoid_: Difficulty, level, rank, tier

**Scaffold**:
The read-only lines shown above the editable region of a Pattern — typically the
function signature. Everything below it is the player's to write.
_Avoid_: Stub, template, boilerplate, starter code

### Records

**Run**:
One attempt at one Challenge. The unit of record. Always one of the two concrete
kinds below — there is no polymorphic Run.
_Avoid_: Attempt, session, game, try

**Typing Run**:
A Run against a Passage. Measured by WPM and Accuracy. Cannot fail — it is
either completed or never recorded.
_Avoid_: Transcription run, text run

**Solve Run**:
A Run against a Pattern. Measured by Verdict and duration, with WPM as a
secondary reading. Can fail.
_Avoid_: Code run, submission, attempt

**Verdict**:
The outcome of a Solve Run: Passed, Failed, Timeout, or Error. Only Passed Solve
Runs are ranked.
_Avoid_: Result, status, outcome

**WPM**:
Words per minute, where a word is five characters. Correct characters only for a
Typing Run; all typed characters for a Solve Run.
_Avoid_: Speed, rate

**Accuracy**:
Correct keystrokes divided by total keystrokes. Exists only for Typing Runs — a
Solve Run has no target text to be accurate against.

**Personal Best**:
A User's highest WPM within a Discipline, or fastest Passed Solve Run for a
Pattern. Derived from Runs, never stored.
_Avoid_: High score, record, PB

### People

**User**:
Anyone who has played. Holds a Handle, their Runs, and their settings. Guests and
registered players are the same entity in different states — not two things.
_Avoid_: Player, account, member, profile

**Handle**:
A User's display name. Auto-generated as `GERUND_CREATURE` (e.g.
`PERCOLATING_FERRET`) for an Unclaimed User; chosen on Claiming.
_Avoid_: Username, nickname, display name, alias

**Unclaimed User**:
A User with no credentials attached. Plays, accumulates Runs, and appears on
Leaderboards exactly like anyone else. The state, not a separate kind of person.
_Avoid_: Guest, anonymous user, temporary account

**Claiming**:
Attaching credentials to a User. If the player signs in to a User that already
exists, the Unclaimed User's Runs are merged into it silently and always.
_Avoid_: Signup, registration, conversion, linking

**Recognition Key**:
The opaque secret a browser holds, in a long-lived HttpOnly cookie named
`gmc_recognition`, so the same User is recognised on the next visit. Not a
credential — nobody signs in with it and a User holding one is still Unclaimed;
it is what makes an Unclaimed User's Runs still theirs tomorrow. Never the User's
id, which is public.
_Avoid_: Token, session, device id, anonymous id, identity

### Integrity

**Issue**:
A server's record that a specific Challenge was handed to a specific User at a
specific moment. Single-use and short-lived. A Run cannot exist without one.
_Avoid_: Token, ticket, session, grant

**Verification**:
Recomputing a Run's metrics server-side from raw submitted data, rather than
trusting the numbers the client reports. Every Run is verified.
_Avoid_: Validation, checking, anti-cheat

**Judging**:
Executing a Solve Run's submitted source against a Pattern's hidden tests in an
isolated container to produce a Verdict. The Solve Run equivalent of
Verification.
_Avoid_: Running, evaluating, grading, testing

**Example Test**:
A test case shown to the player alongside the Pattern so they know the contract
they are being judged against. Its failure is revealed in full.
_Avoid_: Sample, visible test, demo case

**Hidden Test**:
A test case the player never sees. Its failure is reported only as a count.
_Avoid_: Secret test, private test

### Ranking

**Leaderboard**:
A ranking of Users by their best result. Exists at two levels: per Challenge (one
Passage, one Pattern) and per Discipline. Never mixes the two levels, and never
ranks across Disciplines.
_Avoid_: Rankings, scoreboard, high scores, top list

**Discipline Ranking**:
A User's standing within a Discipline: the average of their best Run on each of
at least five distinct Challenges. Deliberately not their single best Run, which
would rank whoever found the easiest Challenge.
_Avoid_: Overall score, rating, total
